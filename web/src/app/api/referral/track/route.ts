import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/src/lib/firebase-admin';
import { checkRateLimit, rateLimitResponse } from '@/src/lib/rateLimit';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!checkRateLimit(`referral-track:${ip}`, 5, 60_000)) return rateLimitResponse();

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let referredUid: string;
  try {
    const token = authHeader.slice(7);
    const decoded = await getAdminAuth().verifyIdToken(token);
    referredUid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let referralCode: string;
  try {
    const body = await req.json();
    referralCode = (body.referralCode ?? '').trim().toUpperCase();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  if (!referralCode) {
    return NextResponse.json({ error: 'code_required' }, { status: 400 });
  }

  const db = getAdminFirestore();

  // Resolve referrer by code
  const referrerSnap = await db
    .collection('users')
    .where('referralCode', '==', referralCode)
    .limit(1)
    .get();

  if (referrerSnap.empty) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const referrerId = referrerSnap.docs[0].id;

  if (referrerId === referredUid) {
    return NextResponse.json({ error: 'self_referral' }, { status: 400 });
  }

  // Idempotency: bail if this user was already referred
  const existingSnap = await db
    .collection('referrals')
    .where('referredUid', '==', referredUid)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    return NextResponse.json({ ok: true, already_tracked: true });
  }

  const batch = db.batch();

  // Write referral record
  const refRef = db.collection('referrals').doc();
  batch.set(refRef, {
    referrerId,
    referredUid,
    referralCode,
    createdAt: FieldValue.serverTimestamp(),
    credited: false,
  });

  // Tag referred user
  batch.update(db.collection('users').doc(referredUid), { referredBy: referralCode });

  // Increment referrer's count
  batch.update(db.collection('users').doc(referrerId), {
    referralCount: FieldValue.increment(1),
  });

  await batch.commit();

  return NextResponse.json({ ok: true });
}
