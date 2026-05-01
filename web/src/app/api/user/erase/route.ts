import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/src/lib/firebase-admin';
import { checkRateLimit, rateLimitResponse } from '@/src/lib/rateLimit';
import { FieldValue } from 'firebase-admin/firestore';

// Commit a batch and reset it; Firestore batches cap at 500 ops.
async function flushBatch(db: FirebaseFirestore.Firestore, ops: FirebaseFirestore.WriteBatch) {
  await ops.commit();
}

export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let uid: string;
  let email: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(authHeader.slice(7));
    uid = decoded.uid;
    email = decoded.email ?? '';
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (!checkRateLimit(`user-erase:${uid}`, 2, 60 * 60_000)) return rateLimitResponse();

  let body: { confirmEmail?: string } = {};
  try { body = await req.json(); } catch { /* no body */ }

  if (!body.confirmEmail || body.confirmEmail.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json(
      { error: 'Provide your email address as confirmEmail to verify erasure.' },
      { status: 400 },
    );
  }

  const db = getAdminDb();

  // 1. Anonymize profile document (keep uid for relational integrity).
  await db.collection('users').doc(uid).set(
    {
      displayName: '[Deleted]',
      email: `deleted-${uid.slice(0, 8)}@erased.invalid`,
      phoneNumber: FieldValue.delete(),
      location: FieldValue.delete(),
      avatarUrl: FieldValue.delete(),
      status: 'deactivated',
    },
    { merge: true },
  );

  // 2. Anonymize messages sent by this user.
  const messagesSnap = await db.collection('messages').where('senderId', '==', uid).get();
  let batch = db.batch();
  let batchCount = 0;
  for (const msgDoc of messagesSnap.docs) {
    batch.update(msgDoc.ref, {
      text: '[Content removed]',
      senderName: '[Deleted]',
      imageUrl: FieldValue.delete(),
      audioUrl: FieldValue.delete(),
    });
    batchCount++;
    if (batchCount === 499) {
      await flushBatch(db, batch);
      batch = db.batch();
      batchCount = 0;
    }
  }
  if (batchCount > 0) await flushBatch(db, batch);

  // 3. Anonymize consultation records where this user is the client (keep for business/legal records).
  const consultationsSnap = await db.collection('consultations').where('clientId', '==', uid).get();
  batch = db.batch();
  batchCount = 0;
  for (const cDoc of consultationsSnap.docs) {
    batch.update(cDoc.ref, {
      clientName: '[Deleted]',
      clientAvatarUrl: FieldValue.delete(),
    });
    batchCount++;
    if (batchCount === 499) {
      await flushBatch(db, batch);
      batch = db.batch();
      batchCount = 0;
    }
  }
  if (batchCount > 0) await flushBatch(db, batch);

  // 4. Delete notifications.
  const notificationsSnap = await db.collection('notifications').where('userId', '==', uid).get();
  batch = db.batch();
  batchCount = 0;
  for (const nDoc of notificationsSnap.docs) {
    batch.delete(nDoc.ref);
    batchCount++;
    if (batchCount === 499) {
      await flushBatch(db, batch);
      batch = db.batch();
      batchCount = 0;
    }
  }
  if (batchCount > 0) await flushBatch(db, batch);

  // 5. Delete support messages.
  const supportSnap = await db.collection('supportMessages').where('userId', '==', uid).get();
  batch = db.batch();
  batchCount = 0;
  for (const sDoc of supportSnap.docs) {
    batch.delete(sDoc.ref);
    batchCount++;
    if (batchCount === 499) {
      await flushBatch(db, batch);
      batch = db.batch();
      batchCount = 0;
    }
  }
  if (batchCount > 0) await flushBatch(db, batch);

  // 6. Delete Firebase Auth account (must be last — token becomes invalid after this).
  await getAdminAuth().deleteUser(uid);

  return NextResponse.json({ ok: true, message: 'Your data has been erased. Your account has been deleted.' });
}
