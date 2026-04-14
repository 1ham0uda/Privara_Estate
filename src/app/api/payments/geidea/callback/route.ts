import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/src/lib/firebase-admin';
import {
  buildCallbackSignature,
  extractGeideaCallbackSummary,
  getGeideaConfig,
  isGeideaPaymentSuccessful,
} from '@/src/lib/geidea';

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
          ? `${clientName} submitted a paid consultation request and selected ${consultantName}.`
          : `${clientName} submitted a paid consultation request without selecting a consultant.`,
        link: `/admin/cases/${caseId}`,
        caseId,
        titleKey: 'notifications.consultation_created.title',
        messageKey: hasSelectedConsultant
          ? 'notifications.consultation_created.message_with_consultant'
          : 'notifications.consultation_created.message_without_consultant',
        messageParams: {
          clientName,
          consultantName,
        },
      }),
    ),
  );

  if (hasSelectedConsultant) {
    await createNotification({
      userId: consultation.consultantId,
      title: 'New consultation assigned to you',
      message: `${clientName} submitted a paid consultation request and selected you.`,
      link: `/consultant/cases/${caseId}`,
      caseId,
      titleKey: 'notifications.consultation_assigned.title',
      messageKey: 'notifications.consultation_assigned.message_consultant',
      messageParams: { clientName },
    });
  }
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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid callback payload' }, { status: 400 });
  }

  const summary = extractGeideaCallbackSummary(payload);
  if (!summary.merchantReferenceId) {
    return NextResponse.json({ error: 'Missing merchantReferenceId' }, { status: 400 });
  }

  if (
    summary.signature &&
    summary.amount !== null &&
    summary.currency &&
    summary.orderId &&
    summary.status &&
    summary.timestamp
  ) {
    const expectedSignature = buildCallbackSignature(
      config.publicKey,
      summary.amount,
      summary.currency,
      summary.orderId,
      summary.status,
      summary.merchantReferenceId,
      summary.timestamp,
      config.apiPassword,
    );

    if (expectedSignature !== summary.signature) {
      return NextResponse.json({ error: 'Invalid callback signature' }, { status: 400 });
    }
  }

  const adminDb = getAdminDb();
  const docRef = adminDb.collection('consultations').doc(summary.merchantReferenceId);
  const consultationSnap = await docRef.get();

  if (!consultationSnap.exists) {
    return NextResponse.json({ error: 'Consultation not found' }, { status: 404 });
  }

  const consultation = consultationSnap.data()!;
  const expectedAmount = Number(consultation.payment?.amount ?? 0);
  const expectedCurrency = consultation.payment?.currency ?? 'EGP';

  if (
    summary.amount !== null &&
    expectedAmount > 0 &&
    Math.abs(summary.amount - expectedAmount) > 0.009
  ) {
    await docRef.set(
      {
        payment: {
          status: 'callback_mismatch',
          mismatchReason: 'amount',
          callbackSummary: summary,
          lastCallbackAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
  }

  if (summary.currency && expectedCurrency !== summary.currency) {
    await docRef.set(
      {
        payment: {
          status: 'callback_mismatch',
          mismatchReason: 'currency',
          callbackSummary: summary,
          lastCallbackAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return NextResponse.json({ error: 'Currency mismatch' }, { status: 400 });
  }

  if (consultation.paymentStatus === 'paid') {
    return NextResponse.json({ received: true, alreadyProcessed: true }, { status: 200 });
  }

  const isSuccess = isGeideaPaymentSuccessful(summary);

  if (isSuccess) {
    await docRef.set(
      {
        paymentStatus: 'paid',
        payment: {
          provider: 'geidea',
          status: 'paid',
          paidAt: FieldValue.serverTimestamp(),
          geideaOrderId: summary.orderId,
          reference: summary.reference,
          responseCode: summary.responseCode,
          responseMessage: summary.responseMessage,
          detailedResponseCode: summary.detailedResponseCode,
          detailedResponseMessage: summary.detailedResponseMessage,
          callbackSummary: summary,
          lastCallbackAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    await notifyOnPaidConsultation(summary.merchantReferenceId, consultation);
    return NextResponse.json({ received: true, status: 'paid' }, { status: 200 });
  }

  await docRef.set(
    {
      payment: {
        provider: 'geidea',
        status: 'failed',
        failedAt: FieldValue.serverTimestamp(),
        geideaOrderId: summary.orderId,
        reference: summary.reference,
        responseCode: summary.responseCode,
        responseMessage: summary.responseMessage,
        detailedResponseCode: summary.detailedResponseCode,
        detailedResponseMessage: summary.detailedResponseMessage,
        callbackSummary: summary,
        lastCallbackAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return NextResponse.json({ received: true, status: 'failed' }, { status: 200 });
}
