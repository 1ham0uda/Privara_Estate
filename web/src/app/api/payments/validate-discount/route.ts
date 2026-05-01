import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/src/lib/firebase-admin';
import { checkRateLimit, rateLimitResponse } from '@/src/lib/rateLimit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!checkRateLimit(`discount-validate:${ip}`, 10, 60_000)) return rateLimitResponse();

  let code: string;
  try {
    const body = await req.json();
    code = (body.code ?? '').trim().toUpperCase();
  } catch {
    return NextResponse.json({ valid: false, error: 'invalid_request' }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ valid: false, error: 'code_required' }, { status: 400 });
  }

  const db = getAdminFirestore();

  const snap = await db.collection('discountCodes').where('code', '==', code).limit(1).get();
  if (snap.empty) {
    return NextResponse.json({ valid: false, error: 'not_found' });
  }

  const doc = snap.docs[0];
  const data = doc.data();

  if (!data.active) {
    return NextResponse.json({ valid: false, error: 'inactive' });
  }

  if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
    return NextResponse.json({ valid: false, error: 'expired' });
  }

  if (data.maxUses !== null && data.usedCount >= data.maxUses) {
    return NextResponse.json({ valid: false, error: 'exhausted' });
  }

  return NextResponse.json({
    valid: true,
    discountPercent: data.discountPercent as number,
    code,
  });
}
