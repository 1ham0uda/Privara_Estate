import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { checkRateLimit, rateLimitResponse } from '@/src/lib/rateLimit';
import { getAdminAuth, getAdminDb } from '@/src/lib/firebase-admin';
import { IntakeData } from '@/src/types';
import { writeAuditLog } from '@/src/lib/auditLog';

interface InitiateRequestBody {
  intake?: IntakeData;
  caseId?: string;
  discountCode?: string;
}

function isValidIntakeData(value: unknown): value is IntakeData {
  if (!value || typeof value !== 'object') return false;
  const intake = value as Record<string, unknown>;
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

async function createNotification(data: {
  userId: string;
  title: string;
  message: string;
  link: string;
  caseId: string;
  titleKey: string;
  messageKey: string;
  messageParams?: Record<string, string>;
}) {
  const adminDb = getAdminDb();
  await adminDb.collection('notifications').add({
    ...data,
    read: false,
    eventType: 'consultation_created',
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function notifyOnPaidConsultation(caseId: string, consultation: FirebaseFirestore.DocumentData) {
  const adminDb = getAdminDb();
  const clientName = consultation.clientName || 'Client';
  const consultantName = consultation.consultantName || '';
  const hasSelectedConsultant = Boolean(consultation.consultantId && consultantName);

  const adminSnapshot = await adminDb.collection('users').where('role', '==', 'admin').get();
  await Promise.all(
    adminSnapshot.docs.map((adminDoc) =>
      createNotification({
        userId: adminDoc.id,
        title: 'New consultation request',
        message: hasSelectedConsultant
          ? `${clientName} submitted a consultation request and selected ${consultantName}.`
          : `${clientName} submitted a consultation request without selecting a consultant.`,
        link: `/admin/cases/${caseId}`,
        caseId,
        titleKey: 'notifications.consultation_created.title',
        messageKey: hasSelectedConsultant
          ? 'notifications.consultation_created.message_with_consultant'
          : 'notifications.consultation_created.message_without_consultant',
        messageParams: { clientName, consultantName },
      }),
    ),
  );

  if (hasSelectedConsultant) {
    await createNotification({
      userId: consultation.consultantId,
      title: 'New consultation assigned to you',
      message: `${clientName} submitted a consultation request and selected you.`,
      link: `/consultant/cases/${caseId}`,
      caseId,
      titleKey: 'notifications.consultation_assigned.title',
      messageKey: 'notifications.consultation_assigned.message_consultant',
      messageParams: { clientName },
    });
  }
}

export async function POST(request: NextRequest) {
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

  if (!checkRateLimit(`pay-initiate:${uid}`, 10, 5 * 60_000)) return rateLimitResponse();

  let body: InitiateRequestBody;
  try {
    body = (await request.json()) as InitiateRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const existingCaseId = typeof body.caseId === 'string' && body.caseId.trim() ? body.caseId.trim() : null;
  const requestedIntake = body.intake;

  if (!existingCaseId && !isValidIntakeData(requestedIntake)) {
    return NextResponse.json({ error: 'A valid intake payload is required' }, { status: 400 });
  }

  const adminDb = getAdminDb();
  const settingsSnap = await adminDb.collection('settings').doc('system').get();
  const settingsData = settingsSnap.data() ?? {};
  const standardFee = settingsData.standardFee
    ? Number(settingsData.standardFee)
    : Number(settingsData.consultationFee ?? 500);
  const proFee = settingsData.proFee ? Number(settingsData.proFee) : standardFee;

  const selectedConsultantUid = requestedIntake?.selectedConsultantUid ?? null;
  let consultationFee = standardFee;
  if (selectedConsultantUid) {
    const consultantSnap = await adminDb.collection('consultantProfiles').doc(selectedConsultantUid).get();
    if (consultantSnap.exists && consultantSnap.data()?.feeTier === 'pro') {
      consultationFee = proFee;
    }
  }

  let caseId = existingCaseId;

  if (caseId) {
    const existingSnap = await adminDb.collection('consultations').doc(caseId).get();
    if (!existingSnap.exists || existingSnap.data()?.clientId !== uid) {
      return NextResponse.json({ error: 'Invalid case for payment retry' }, { status: 400 });
    }
    if (existingSnap.data()?.paymentStatus === 'paid') {
      return NextResponse.json({ error: 'This consultation is already paid', caseId }, { status: 400 });
    }
  } else {
    const userSnap = await adminDb.collection('users').doc(uid).get();
    const user = userSnap.data() ?? {};
    const clientName: string = user.displayName || user.email || 'Client';
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
        currency: 'EGP',
        attemptCount: 0,
        initiatedAt: FieldValue.serverTimestamp(),
      },
    });
    caseId = ref.id;
  }

  // Temporary fallback mode: immediately confirm payment without external gateway.
  const ref = adminDb.collection('consultations').doc(caseId!);
  await ref.update({
    paymentStatus: 'paid',
    'payment.status': 'paid',
    'payment.provider': 'manual_temp',
    'payment.responseMessage': 'Temporary payment fallback accepted',
    'payment.paidAt': FieldValue.serverTimestamp(),
    'payment.lastInitiatedAt': FieldValue.serverTimestamp(),
    'payment.attemptCount': FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const paidSnap = await ref.get();
  if (paidSnap.exists) {
    void notifyOnPaidConsultation(caseId!, paidSnap.data()!);
  }

  writeAuditLog({
    action: 'payment_success',
    actorUid: uid,
    targetId: caseId!,
    metadata: { mode: 'temporary_fallback', amount: consultationFee, currency: 'EGP' },
  });

  return NextResponse.json({
    caseId,
    mode: 'temporary_fallback',
  });
}

