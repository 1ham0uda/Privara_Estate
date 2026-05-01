import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { getAdminAuth, getAdminDb } from '@/src/lib/firebase-admin';
import { writeAuditLog } from '@/src/lib/auditLog';

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
    const uid: string = typeof body.uid === 'string' ? body.uid.trim() : '';
    const newStatus: string = body.newStatus;

    if (!uid || (newStatus !== 'active' && newStatus !== 'deactivated')) {
      return errorResponse('Missing or invalid fields', 'invalid-fields', 400);
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    const userRef = adminDb.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return errorResponse('User not found', 'not-found', 404);
    }

    await userRef.update({ status: newStatus, updatedAt: now });

    const consultantSnap = await adminDb.collection('consultantProfiles').doc(uid).get();
    if (consultantSnap.exists) {
      await adminDb.collection('consultantProfiles').doc(uid).update({ status: newStatus });
    }

    writeAuditLog({
      action: 'staff_status_changed',
      actorUid: decoded.uid,
      targetId: uid,
      metadata: { newStatus },
      ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
    });

    return NextResponse.json({ ok: true, newStatus });
  } catch (error: any) {
    console.error('[toggle-user-status]', error);
    return errorResponse(error.message || 'Unexpected server error', 'server-error', 500);
  }
}
