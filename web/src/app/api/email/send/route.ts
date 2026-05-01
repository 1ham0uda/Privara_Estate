import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/src/lib/firebase-admin';
import { sendReportUploadedEmail, sendRatingReminderEmail } from '@/src/lib/emailService';

type EmailType = 'report_uploaded' | 'rating_reminder';

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse('Unauthorized', 401);
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth.verifyIdToken(idToken);

    const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
    const callerRole = callerDoc.data()?.role;
    if (!callerDoc.exists || !['admin', 'consultant'].includes(callerRole)) {
      return errorResponse('Forbidden', 403);
    }

    const body = await req.json();
    const emailType: EmailType = body.type;
    const caseId: string = typeof body.caseId === 'string' ? body.caseId.trim() : '';

    if (!emailType || !caseId) {
      return errorResponse('Missing required fields: type, caseId', 400);
    }

    const consultationSnap = await adminDb.collection('consultations').doc(caseId).get();
    if (!consultationSnap.exists) {
      return errorResponse('Consultation not found', 404);
    }

    const consultation = consultationSnap.data()!;
    const clientEmail: string = consultation.clientEmail || '';
    const clientName: string = consultation.clientName || 'Client';
    const consultantName: string = consultation.consultantName || 'Your consultant';

    if (!clientEmail) {
      return NextResponse.json({ ok: true, skipped: 'no_client_email' });
    }

    if (emailType === 'report_uploaded') {
      await sendReportUploadedEmail({ toEmail: clientEmail, toName: clientName, consultantName, caseId });
    } else if (emailType === 'rating_reminder') {
      await sendRatingReminderEmail({ toEmail: clientEmail, toName: clientName, consultantName, caseId });
    } else {
      return errorResponse(`Unknown email type: ${emailType}`, 400);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[email/send]', error);
    return errorResponse(error.message || 'Unexpected server error', 500);
  }
}
