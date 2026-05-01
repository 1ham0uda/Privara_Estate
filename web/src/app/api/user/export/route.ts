import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/src/lib/firebase-admin';
import { checkRateLimit, rateLimitResponse } from '@/src/lib/rateLimit';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(authHeader.slice(7));
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (!checkRateLimit(`user-export:${uid}`, 3, 60 * 60_000)) return rateLimitResponse();

  const db = getAdminDb();

  const [
    userSnap,
    consultationsSnap,
    messagesSnap,
    notificationsSnap,
    supportSnap,
  ] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('consultations').where('clientId', '==', uid).get(),
    db.collection('messages').where('senderId', '==', uid).orderBy('createdAt', 'desc').limit(500).get(),
    db.collection('notifications').where('userId', '==', uid).orderBy('createdAt', 'desc').limit(200).get(),
    db.collection('supportMessages').where('userId', '==', uid).orderBy('createdAt', 'desc').get(),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    profile: userSnap.exists ? userSnap.data() : null,
    consultations: consultationsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    messages: messagesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    notifications: notificationsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    supportMessages: supportSnap.docs.map(d => ({ id: d.id, ...d.data() })),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="real-real-estate-data-${uid.slice(0, 8)}.json"`,
    },
  });
}
