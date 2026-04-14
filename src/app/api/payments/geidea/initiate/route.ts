import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/src/lib/firebase-admin';
import { IntakeData } from '@/src/types';
import {
  buildCreateSessionSignature,
  buildGeideaBasicAuth,
  getGeideaConfig,
  getGeideaLanguage,
} from '@/src/lib/geidea';

interface InitiateRequestBody {
  intake?: IntakeData;
  caseId?: string;
  language?: string;
}

function isValidIntakeData(value: unknown): value is IntakeData {
  if (!value || typeof value !== 'object') return false;
  const intake = value as Record<string, unknown>;
  // notes is present in the type but may be empty — do not require non-empty.
  const requiredNonEmpty = [
    intake.goal,
    intake.preferredArea,
    intake.budgetRange,
    intake.propertyType,
    intake.preferredDeliveryTime,
  ];
  return (
    requiredNonEmpty.every((field) => typeof field === 'string' && field.trim().length > 0) &&
    typeof intake.notes === 'string'
  );
}

export async function POST(request: NextRequest) {
  let config;
  try {
    config = getGeideaConfig();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Geidea is not configured' },
      { status: 500 },
    );
  }

  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(authorization.slice(7));
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  let body: InitiateRequestBody;
  try {
    body = (await request.json()) as InitiateRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const existingCaseId = typeof body.caseId === 'string' && body.caseId.trim() ? body.caseId.trim() : null;
  const requestedIntake = body.intake;
  const checkoutLanguage = getGeideaLanguage(body.language);

  if (!existingCaseId && !isValidIntakeData(requestedIntake)) {
    return NextResponse.json({ error: 'A valid intake payload is required' }, { status: 400 });
  }

  const adminDb = getAdminDb();
  const settingsSnap = await adminDb.collection('settings').doc('system').get();
  const consultationFee = settingsSnap.exists
    ? Number(settingsSnap.data()?.consultationFee ?? 500)
    : 500;
  const currency = 'EGP';

  let caseId = existingCaseId;
  let clientEmail: string | null = null;

  if (caseId) {
    // Retry path: verify case ownership and pending state
    const existingSnap = await adminDb.collection('consultations').doc(caseId).get();
    if (!existingSnap.exists || existingSnap.data()?.clientId !== uid) {
      return NextResponse.json({ error: 'Invalid case for payment retry' }, { status: 400 });
    }
    if (existingSnap.data()?.paymentStatus === 'paid') {
      return NextResponse.json({ error: 'This consultation is already paid', caseId }, { status: 400 });
    }
    // Fetch user email once for the Geidea session (retry path)
    const userSnap = await adminDb.collection('users').doc(uid).get();
    clientEmail = userSnap.data()?.email || null;
  } else {
    // New consultation path: read user once
    const userSnap = await adminDb.collection('users').doc(uid).get();
    const user = userSnap.data() ?? {};
    const clientName: string = user.displayName || user.email || 'Client';
    clientEmail = user.email || null;

    const hasSelectedConsultant = Boolean(
      requestedIntake?.selectedConsultantUid && requestedIntake?.selectedConsultantName,
    );

    const normalizedIntake = {
      ...requestedIntake,
      selectedConsultantUid: hasSelectedConsultant ? requestedIntake!.selectedConsultantUid : null,
      selectedConsultantName: hasSelectedConsultant ? requestedIntake!.selectedConsultantName : null,
    };

    const ref = await adminDb.collection('consultations').add({
      clientId: uid,
      clientName,
      clientAvatarUrl: user.avatarUrl ?? null,
      ...(hasSelectedConsultant
        ? {
            consultantId: requestedIntake!.selectedConsultantUid,
            consultantName: requestedIntake!.selectedConsultantName,
          }
        : {}),
      paymentStatus: 'pending',
      status: hasSelectedConsultant ? 'assigned' : 'new',
      stage: 'intake',
      intake: normalizedIntake,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      reassignmentRequestStatus: 'none',
      payment: {
        provider: 'geidea',
        status: 'initiated',
        amount: consultationFee,
        currency,
        attemptCount: 0,
        initiatedAt: FieldValue.serverTimestamp(),
      },
    });

    caseId = ref.id;
    // No need to re-read the document — we have all data locally
  }

  const merchantReferenceId = caseId!;
  const timestamp = new Date().toISOString();
  const signature = buildCreateSessionSignature(
    config.publicKey,
    consultationFee,
    currency,
    merchantReferenceId,
    timestamp,
    config.apiPassword,
  );

  const geideaRequestBody = {
    amount: Number(consultationFee.toFixed(2)),
    currency,
    timestamp,
    merchantReferenceId,
    signature,
    callbackUrl: config.callbackUrl,
    returnUrl: config.returnUrl,
    paymentOperation: 'Pay',
    language: checkoutLanguage,
    ...(clientEmail ? { customer: { email: clientEmail } } : {}),
    order: {
      items: [
        {
          name: 'Real Estate Consultation',
          description: 'Privara Estate consultation fee',
          count: 1,
          price: Number(consultationFee.toFixed(2)),
        },
      ],
    },
  };

  let geideaResponse: Response;
  try {
    geideaResponse = await fetch(config.sessionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: buildGeideaBasicAuth(config.publicKey, config.apiPassword),
      },
      body: JSON.stringify(geideaRequestBody),
      cache: 'no-store',
    });
  } catch (error) {
    // Use update() with dot notation — set(merge:true) would overwrite the payment map
    await adminDb.collection('consultations').doc(caseId!).update({
      'payment.status': 'session_failed',
      'payment.lastError': 'Could not reach payment provider',
      'payment.lastInitiatedAt': FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(
      { error: 'Could not reach payment provider', caseId },
      { status: 502 },
    );
  }

  let geideaData: any = null;
  try {
    geideaData = await geideaResponse.json();
  } catch {
    geideaData = null;
  }

  if (!geideaResponse.ok || geideaData?.responseCode !== '000' || !geideaData?.session?.id) {
    await adminDb.collection('consultations').doc(caseId!).update({
      'payment.status': 'session_failed',
      'payment.lastError':
        geideaData?.detailedResponseMessage ||
        geideaData?.responseMessage ||
        'Payment session creation failed',
      'payment.responseCode': geideaData?.responseCode ?? null,
      'payment.detailedResponseCode':
        geideaData?.detailedResponseCode ?? geideaData?.detailResponseCode ?? null,
      'payment.lastInitiatedAt': FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(
      {
        error:
          geideaData?.detailedResponseMessage ||
          geideaData?.responseMessage ||
          'Payment session creation failed',
        caseId,
      },
      { status: 502 },
    );
  }

  const sessionId = geideaData.session.id as string;

  // update() with dot notation preserves all existing payment subfields (amount, currency,
  // initiatedAt, provider, etc.) and correctly handles FieldValue.increment.
  await adminDb.collection('consultations').doc(caseId!).update({
    'payment.status': 'session_created',
    'payment.geideaSessionId': sessionId,
    'payment.responseCode': geideaData.responseCode,
    'payment.responseMessage': geideaData.responseMessage ?? null,
    'payment.reference': geideaData.reference ?? null,
    'payment.lastInitiatedAt': FieldValue.serverTimestamp(),
    'payment.attemptCount': FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({
    sessionId,
    caseId,
    checkoutScriptUrl: config.checkoutScriptUrl,
  });
}
