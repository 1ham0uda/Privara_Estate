import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/src/lib/firebase-admin';
import { writeAuditLog } from '@/src/lib/auditLog';
import {
  buildCallbackSignature,
  extractGeideaCallbackSummary,
  getGeideaConfig,
  isGeideaPaymentSuccessful,
} from '@/src/lib/geidea';
import { sendPaymentReceiptEmail } from '@/src/lib/emailService';

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

async function notifyOnPaidConsultation(
  caseId: string,
  consultation: FirebaseFirestore.DocumentData,
) {
  const adminDb = getAdminDb();
  const clientName = consultation.clientName || 'Client';
  const consultantName = consultation.consultantName || '';
  const hasSelectedConsultant = Boolean(consultation.consultantId && consultantName);

  const adminSnapshot = await adminDb
    .collection('users')
    .where('role', '==', 'admin')
    .get();

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
        messageParams: { clientName, consultantName },
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
  // ── 1. Load config ─────────────────────────────────────────────────────────
  let config;
  try {
    config = getGeideaConfig();
  } catch (error) {
    console.error('[geidea/callback] Config error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Gateway not configured' }, { status: 500 });
  }

  // ── 2. Parse payload ───────────────────────────────────────────────────────
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const summary = extractGeideaCallbackSummary(payload);

  if (!summary.merchantReferenceId) {
    console.error('[geidea/callback] Missing merchantReferenceId');
    return NextResponse.json({ error: 'Missing merchantReferenceId' }, { status: 400 });
  }

  // ── 3. Signature verification (mandatory) ─────────────────────────────────
  // Always require a signature. If fields needed to verify are missing we cannot
  // confirm authenticity — log and abort; Geidea will retry which is the correct
  // behaviour for a genuinely malformed callback.
  if (!summary.signature) {
    console.error('[geidea/callback] Missing signature — ref:', summary.merchantReferenceId);
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  if (
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
      console.error(
        '[geidea/callback] Signature mismatch — ref:',
        summary.merchantReferenceId,
        'expected:',
        expectedSignature,
        'got:',
        summary.signature,
      );
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
  } else {
    // Signature present but verification fields incomplete — cannot confirm authenticity.
    // Return 400 so Geidea retries with a complete payload.
    console.error(
      '[geidea/callback] Incomplete payload for signature verification — ref:',
      summary.merchantReferenceId,
      'missing:',
      {
        amount: summary.amount,
        currency: summary.currency,
        orderId: summary.orderId,
        status: summary.status,
        timestamp: summary.timestamp,
      },
    );
    return NextResponse.json({ error: 'Incomplete callback payload' }, { status: 400 });
  }

  // ── 4. Look up consultation ────────────────────────────────────────────────
  const adminDb = getAdminDb();
  const docRef = adminDb.collection('consultations').doc(summary.merchantReferenceId);
  const consultationSnap = await docRef.get();

  if (!consultationSnap.exists) {
    console.error('[geidea/callback] Consultation not found — ref:', summary.merchantReferenceId);
    return NextResponse.json({ error: 'Consultation not found' }, { status: 404 });
  }

  const consultation = consultationSnap.data()!;

  // ── 5. Idempotency — check BEFORE any validation that might produce false mismatches ──
  if (consultation.paymentStatus === 'paid') {
    return NextResponse.json({ received: true, alreadyProcessed: true }, { status: 200 });
  }

  // ── 6. Amount and currency validation ─────────────────────────────────────
  const expectedAmount = Number(consultation.payment?.amount ?? 0);
  const expectedCurrency: string = consultation.payment?.currency ?? 'EGP';

  if (expectedAmount > 0 && Math.abs(summary.amount - expectedAmount) > 0.009) {
    console.error(
      '[geidea/callback] Amount mismatch — ref:',
      summary.merchantReferenceId,
      'expected:',
      expectedAmount,
      'got:',
      summary.amount,
    );
    // Return 200 to stop retries — this is a data integrity issue to investigate manually.
    await docRef.update({
      'payment.status': 'callback_mismatch',
      'payment.mismatchReason': `amount: expected ${expectedAmount}, received ${summary.amount}`,
      'payment.callbackSummary': summary,
      'payment.lastCallbackAt': FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    writeAuditLog({
      action: 'payment_mismatch',
      actorUid: null,
      targetId: summary.merchantReferenceId,
      metadata: { reason: 'amount_mismatch', expected: expectedAmount, received: summary.amount },
    });
    return NextResponse.json({ received: true, status: 'mismatch_amount' }, { status: 200 });
  }

  if (summary.currency && expectedCurrency !== summary.currency) {
    console.error(
      '[geidea/callback] Currency mismatch — ref:',
      summary.merchantReferenceId,
      'expected:',
      expectedCurrency,
      'got:',
      summary.currency,
    );
    await docRef.update({
      'payment.status': 'callback_mismatch',
      'payment.mismatchReason': `currency: expected ${expectedCurrency}, received ${summary.currency}`,
      'payment.callbackSummary': summary,
      'payment.lastCallbackAt': FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    writeAuditLog({
      action: 'payment_mismatch',
      actorUid: null,
      targetId: summary.merchantReferenceId,
      metadata: { reason: 'currency_mismatch', expected: expectedCurrency, received: summary.currency },
    });
    return NextResponse.json({ received: true, status: 'mismatch_currency' }, { status: 200 });
  }

  // ── 7. Process payment outcome ─────────────────────────────────────────────
  const isSuccess = isGeideaPaymentSuccessful(summary);

  if (isSuccess) {
    // update() with dot notation preserves all existing payment subfields
    await docRef.update({
      paymentStatus: 'paid',
      'payment.status': 'paid',
      'payment.paidAt': FieldValue.serverTimestamp(),
      'payment.geideaOrderId': summary.orderId,
      'payment.reference': summary.reference,
      'payment.responseCode': summary.responseCode,
      'payment.responseMessage': summary.responseMessage,
      'payment.detailedResponseCode': summary.detailedResponseCode,
      'payment.detailedResponseMessage': summary.detailedResponseMessage,
      'payment.callbackSummary': summary,
      'payment.lastCallbackAt': FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    writeAuditLog({
      action: 'payment_success',
      actorUid: consultation.clientId ?? null,
      targetId: summary.merchantReferenceId,
      metadata: { amount: summary.amount, currency: summary.currency, orderId: summary.orderId },
    });
    // Fire-and-forget notifications & email — do not block the 200 response to Geidea
    void notifyOnPaidConsultation(summary.merchantReferenceId, consultation);
    if (consultation.clientEmail) {
      void sendPaymentReceiptEmail({
        toEmail: consultation.clientEmail,
        toName: consultation.clientName || 'Client',
        caseId: summary.merchantReferenceId,
        amount: String(summary.amount),
        currency: summary.currency || 'EGP',
        transactionId: summary.orderId || summary.reference || summary.merchantReferenceId,
      }).catch((err) => console.error('[email] payment receipt failed:', err));
    }
    return NextResponse.json({ received: true, status: 'paid' }, { status: 200 });
  }

  // Payment failed or still in progress
  console.warn(
    '[geidea/callback] Non-success callback — ref:',
    summary.merchantReferenceId,
    'status:',
    summary.status,
    'code:',
    summary.responseCode,
    'detail:',
    summary.detailedResponseCode,
  );

  await docRef.update({
    'payment.status': 'failed',
    'payment.failedAt': FieldValue.serverTimestamp(),
    'payment.geideaOrderId': summary.orderId,
    'payment.reference': summary.reference,
    'payment.responseCode': summary.responseCode,
    'payment.responseMessage': summary.responseMessage,
    'payment.detailedResponseCode': summary.detailedResponseCode,
    'payment.detailedResponseMessage': summary.detailedResponseMessage,
    'payment.callbackSummary': summary,
    'payment.lastCallbackAt': FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  writeAuditLog({
    action: 'payment_failed',
    actorUid: consultation.clientId ?? null,
    targetId: summary.merchantReferenceId,
    metadata: { responseCode: summary.responseCode, detailedResponseCode: summary.detailedResponseCode },
  });

  return NextResponse.json({ received: true, status: 'failed' }, { status: 200 });
}
