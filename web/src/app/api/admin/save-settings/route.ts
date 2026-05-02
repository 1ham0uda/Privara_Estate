import { NextRequest, NextResponse } from 'next/server';
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
    const consultationFee = Number(body.consultationFee);
    const standardFee = Number(body.standardFee ?? consultationFee);
    const proFee = Number(body.proFee ?? standardFee);
    const consultantRevenueSharePercent = Number(body.consultantRevenueSharePercent ?? 80);
    const allowRegistrations = Boolean(body.allowRegistrations);
    const maintenanceMode = Boolean(body.maintenanceMode);

    if (!Number.isFinite(consultationFee) || consultationFee < 0 || !Number.isFinite(standardFee) || standardFee < 0 || !Number.isFinite(proFee) || proFee < 0) {
      return errorResponse('Invalid consultation fee', 'invalid-fee', 400);
    }
    if (!Number.isFinite(consultantRevenueSharePercent) || consultantRevenueSharePercent <= 0 || consultantRevenueSharePercent > 100) {
      return errorResponse('Invalid consultant revenue share', 'invalid-share', 400);
    }

    await adminDb.collection('settings').doc('system').set(
      { consultationFee, standardFee, proFee, consultantRevenueSharePercent, allowRegistrations, maintenanceMode },
      { merge: true }
    );

    writeAuditLog({
      action: 'settings_updated',
      actorUid: decoded.uid,
      targetId: 'system',
      metadata: { consultationFee, standardFee, proFee, consultantRevenueSharePercent, allowRegistrations, maintenanceMode },
      ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[save-settings]', error);
    return errorResponse(error.message || 'Unexpected server error', 'server-error', 500);
  }
}
