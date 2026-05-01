import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { getAdminAuth, getAdminDb } from '@/src/lib/firebase-admin';
import { writeAuditLog } from '@/src/lib/auditLog';
import { sendConsultantAssignedEmail } from '@/src/lib/emailService';

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse('Unauthorized', 'unauthorized', 401);
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth.verifyIdToken(idToken);

    const actorDoc = await adminDb.collection('users').doc(decoded.uid).get();
    if (!actorDoc.exists || actorDoc.data()?.role !== 'admin') {
      return errorResponse('Forbidden', 'forbidden', 403);
    }

    const body = await req.json();
    const caseId: string = typeof body.caseId === 'string' ? body.caseId.trim() : '';
    const staffId: string = typeof body.staffId === 'string' ? body.staffId.trim() : '';
    const role: 'consultant' | 'quality' = body.role === 'quality' ? 'quality' : 'consultant';
    const staffName: string = typeof body.staffName === 'string' ? body.staffName.trim() : '';

    if (!caseId || !staffId || !staffName) {
      return errorResponse('Missing required fields', 'missing-fields', 400);
    }

    const consultationRef = adminDb.collection('consultations').doc(caseId);
    const consultationSnap = await consultationRef.get();
    if (!consultationSnap.exists) {
      return errorResponse('Consultation not found', 'not-found', 404);
    }
    const consultationData = consultationSnap.data()!;

    const now = admin.firestore.FieldValue.serverTimestamp();

    if (role === 'consultant') {
      await consultationRef.update({
        consultantId: staffId,
        consultantName: staffName,
        status: 'assigned',
        updatedAt: now,
      });

      const batch = adminDb.batch();

      batch.set(adminDb.collection('notifications').doc(), {
        userId: consultationData.clientId,
        title: 'Consultant assigned',
        message: `${staffName} has been assigned to your consultation.`,
        link: `/client/cases/${caseId}`,
        actorId: decoded.uid,
        eventType: 'consultation_assigned',
        caseId,
        ticketId: null,
        previousConsultantId: null,
        titleKey: 'notifications.consultation_assigned.title',
        messageKey: 'notifications.consultation_assigned.message_client',
        messageParams: { consultantName: staffName },
        read: false,
        createdAt: now,
      });

      batch.set(adminDb.collection('notifications').doc(), {
        userId: staffId,
        title: 'New consultation assigned to you',
        message: `${consultationData.clientName || 'Client'} has been assigned to you.`,
        link: `/consultant/cases/${caseId}`,
        actorId: decoded.uid,
        eventType: 'consultation_assigned',
        caseId,
        ticketId: null,
        previousConsultantId: null,
        titleKey: 'notifications.consultation_assigned.title',
        messageKey: 'notifications.consultation_assigned.message_consultant',
        messageParams: { clientName: consultationData.clientName || 'Client' },
        read: false,
        createdAt: now,
      });

      await batch.commit();

      if (consultationData.clientEmail) {
        void sendConsultantAssignedEmail({
          toEmail: consultationData.clientEmail,
          toName: consultationData.clientName || 'Client',
          consultantName: staffName,
          caseId,
        }).catch((err) => console.error('[email] consultant assigned failed:', err));
      }
    } else {
      await consultationRef.update({
        qualitySpecialistId: staffId,
        qualitySpecialistName: staffName,
        updatedAt: now,
      });

      await adminDb.collection('notifications').add({
        userId: staffId,
        title: 'New quality review assignment',
        message: `You were assigned to review case ${caseId.substring(0, 8)}.`,
        link: `/quality/cases/${caseId}`,
        actorId: decoded.uid,
        eventType: 'quality_assigned',
        caseId,
        ticketId: null,
        previousConsultantId: null,
        titleKey: 'notifications.quality_assigned.title',
        messageKey: 'notifications.quality_assigned.message',
        messageParams: { caseNumber: caseId.substring(0, 8) },
        read: false,
        createdAt: now,
      });
    }

    writeAuditLog({
      action: 'case_assigned',
      actorUid: decoded.uid,
      targetId: caseId,
      metadata: { staffId, staffName, role },
      ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[assign-case]', error);
    return errorResponse(error.message || 'Unexpected server error', 'server-error', 500);
  }
}
