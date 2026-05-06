import * as admin from 'firebase-admin';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { v1 as firestoreAdmin } from '@google-cloud/firestore';

admin.initializeApp();

const db = admin.firestore();

// ─── R1.9 / B7: Aggregate counters ───────────────────────────────────────────

/**
 * When a new consultation is created, increment the client's
 * totalConsultations and activeConsultations counters.
 */
export const onConsultationCreate = onDocumentCreated(
  'consultations/{caseId}',
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const clientId = data.clientId as string | undefined;
    if (!clientId) return;

    await db.collection('users').doc(clientId).update({
      totalConsultations: admin.firestore.FieldValue.increment(1),
      activeConsultations: admin.firestore.FieldValue.increment(1),
    });
  }
);

/**
 * When a consultation is updated:
 *   1. If status changed to "completed" → move counter from active → completed on the client.
 *   2. If a rating was added → recompute the consultant's average rating and
 *      completedConsultations count on consultantProfiles.
 *   3. If consultantId was first assigned → no counter change needed here (already handled
 *      by the status transition to "assigned").
 */
export const onConsultationUpdate = onDocumentUpdated(
  'consultations/{caseId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const promises: Promise<unknown>[] = [];

    // 1. Status → completed: move active → completed for the client
    if (before.status !== 'completed' && after.status === 'completed') {
      const clientId = after.clientId as string | undefined;
      if (clientId) {
        promises.push(
          db.collection('users').doc(clientId).update({
            activeConsultations: admin.firestore.FieldValue.increment(-1),
            completedConsultations: admin.firestore.FieldValue.increment(1),
          })
        );
      }
    }

    // 2. Rating added: recompute consultant average from all their rated consultations
    const hadRating = typeof before.rating === 'number' && before.rating > 0;
    const hasRating = typeof after.rating === 'number' && after.rating > 0;
    if (!hadRating && hasRating) {
      const consultantId = after.consultantId as string | undefined;
      if (consultantId) {
        promises.push(recomputeConsultantRating(consultantId));
      }
    }

    await Promise.all(promises);
  }
);

async function recomputeConsultantRating(consultantId: string): Promise<void> {
  const snap = await db
    .collection('consultations')
    .where('consultantId', '==', consultantId)
    .where('rating', '>', 0)
    .get();

  if (snap.empty) return;

  const ratings = snap.docs
    .map((d) => d.data().rating as number)
    .filter((r) => typeof r === 'number' && r > 0);

  if (ratings.length === 0) return;

  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const rounded = Math.round(avg * 10) / 10;

  await db.collection('consultantProfiles').doc(consultantId).update({
    rating: rounded,
    completedConsultations: ratings.length,
  });
}

/**
 * When a user's displayName changes, fan out the new name to all denormalized
 * fields across the consultations collection:
 *   - clientName  (if user is the client on those consultations)
 *   - consultantName (if user is the assigned consultant)
 * Also updates consultantProfiles.name for consultant accounts.
 *
 * Batches writes in groups of 499 to respect Firestore's batch limit.
 */
export const onUserDisplayNameUpdate = onDocumentUpdated(
  'users/{uid}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    if (before.displayName === after.displayName) return;

    const uid = event.params.uid as string;
    const newName = after.displayName as string;

    const fanOutPromises: Promise<void>[] = [];

    // Fan out clientName on consultations where this user is the client
    fanOutPromises.push(
      fanOutField(
        db.collection('consultations').where('clientId', '==', uid),
        'clientName',
        newName
      )
    );

    // Fan out consultantName on consultations where this user is the consultant
    fanOutPromises.push(
      fanOutField(
        db.collection('consultations').where('consultantId', '==', uid),
        'consultantName',
        newName
      )
    );

    // Keep consultantProfiles.name in sync
    if (after.role === 'consultant') {
      fanOutPromises.push(
        db
          .collection('consultantProfiles')
          .doc(uid)
          .update({ name: newName })
          .then(() => undefined)
          .catch(() => undefined) // profile may not exist yet; safe to ignore
      );
    }

    await Promise.all(fanOutPromises);
  }
);

async function fanOutField(
  query: admin.firestore.Query,
  field: string,
  value: string
): Promise<void> {
  const snap = await query.limit(500).get();
  if (snap.empty) return;

  const chunks: admin.firestore.QueryDocumentSnapshot[][] = [];
  for (let i = 0; i < snap.docs.length; i += 499) {
    chunks.push(snap.docs.slice(i, i + 499));
  }

  await Promise.all(
    chunks.map((chunk) => {
      const batch = db.batch();
      chunk.forEach((doc) => batch.update(doc.ref, { [field]: value }));
      return batch.commit();
    })
  );
}

// ─── R1.10: Storage lifecycle cleanup ────────────────────────────────────────

const TWELVE_MONTHS_MS = 12 * 30 * 24 * 60 * 60 * 1000;
const TWENTY_FOUR_MONTHS_MS = 24 * 30 * 24 * 60 * 60 * 1000;

/**
 * Daily scheduled job that deletes Storage objects past their retention window:
 *   - calls/**  (call recordings)   → 12 months
 *   - chat/**   (chat media/voice)  → 24 months
 *
 * Run: every day at 03:00 UTC.
 */
export const scheduledStorageCleanup = onSchedule(
  { schedule: 'every 24 hours', timeZone: 'UTC' },
  async () => {
    const bucket = admin.storage().bucket();
    const now = Date.now();

    const prefixWindows: Array<{ prefix: string; maxAgeMs: number }> = [
      { prefix: 'calls/', maxAgeMs: TWELVE_MONTHS_MS },
      { prefix: 'chat/', maxAgeMs: TWENTY_FOUR_MONTHS_MS },
    ];

    let totalDeleted = 0;

    for (const { prefix, maxAgeMs } of prefixWindows) {
      const [files] = await bucket.getFiles({ prefix });
      const stale = files.filter((f) => {
        const updated = f.metadata.updated
          ? new Date(f.metadata.updated as string).getTime()
          : 0;
        return now - updated > maxAgeMs;
      });

      await Promise.all(stale.map((f) => f.delete().catch(() => null)));
      totalDeleted += stale.length;

      console.log(
        `[storageCleanup] prefix=${prefix} stale=${stale.length} total=${files.length}`
      );
    }

    console.log(`[storageCleanup] done — deleted ${totalDeleted} objects`);
  }
);

// ─── R1.11: Scheduled Firestore backup ───────────────────────────────────────

/**
 * Daily scheduled Firestore export to GCS.
 *
 * Prerequisites (one-time Console setup):
 *   1. Create a GCS bucket named  <projectId>-firestore-backups
 *   2. Grant the Cloud Functions service account  roles/storage.admin  on that bucket.
 *   3. Enable the Cloud Firestore API in GCP Console.
 *
 * Run: every day at 02:00 UTC.
 */
export const scheduledFirestoreBackup = onSchedule(
  { schedule: '0 2 * * *', timeZone: 'UTC' },
  async () => {
    const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId) {
      console.error('[firestoreBackup] GCLOUD_PROJECT env var not set — aborting');
      return;
    }

    const client = new firestoreAdmin.FirestoreAdminClient();
    const databaseName = client.databasePath(projectId, '(default)');
    const outputPrefix = `gs://${projectId}-firestore-backups/${new Date()
      .toISOString()
      .split('T')[0]}`;

    try {
      const [operation] = await client.exportDocuments({
        name: databaseName,
        outputUriPrefix: outputPrefix,
        collectionIds: [], // empty array = export all collections
      });

      console.log(
        `[firestoreBackup] export started → ${outputPrefix}  operation=${operation.name}`
      );
    } catch (err) {
      console.error('[firestoreBackup] export failed:', err);
      throw err; // rethrow so Cloud Functions marks the invocation as failed
    }
  }
);

// ─── R2.24: FCM push notifications ───────────────────────────────────────────

/**
 * When a new in-app notification document is created, look up the recipient's
 * FCM tokens and send a push notification.  Best-effort — failures are logged
 * but do not affect the calling flow.
 */
export const onNotificationCreate = onDocumentCreated(
  'notifications/{notifId}',
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const userId: string = data.userId;
    const title: string = data.title || 'Privara Estate';
    const body: string = data.message || '';
    const link: string = data.link || '/';

    if (!userId) return;

    const userSnap = await db.collection('users').doc(userId).get();
    const tokens: string[] = userSnap.data()?.fcmTokens ?? [];
    if (tokens.length === 0) return;

    const messaging = admin.messaging();
    const results = await Promise.allSettled(
      tokens.map((token) =>
        messaging.send({
          token,
          notification: { title, body },
          data: { link },
          webpush: {
            notification: {
              title,
              body,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              requireInteraction: false,
            },
            fcmOptions: { link },
          },
        }),
      ),
    );

    // Remove stale tokens (registration-token-not-registered, invalid-registration-token)
    const staleTokens = tokens.filter((_, i) => {
      const result = results[i];
      if (result.status === 'rejected') {
        const code = (result.reason as any)?.errorInfo?.code ?? '';
        return (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        );
      }
      return false;
    });

    if (staleTokens.length > 0) {
      const remaining = tokens.filter((t) => !staleTokens.includes(t));
      await db.collection('users').doc(userId).update({ fcmTokens: remaining });
    }
  },
);

// ─── B7: One-time backfill callable ──────────────────────────────────────────

/**
 * Admin-only callable function that recomputes all user consultation counters
 * and all consultant ratings from the current state of the consultations collection.
 *
 * Run once after deploying functions to fix stale 0/0/0 counters on existing accounts.
 * Safe to call multiple times — it is fully idempotent.
 *
 * Call from the admin dashboard "Backfill Counters" button.
 */
export const backfillCounters = onCall({ enforceAppCheck: false }, async (request) => {
  // Must be called by an authenticated admin
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const callerDoc = await db.collection('users').doc(request.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Admin role required.');
  }

  const consultationsSnap = await db.collection('consultations').get();

  // Aggregate per-client counters
  const clientCounters = new Map<
    string,
    { total: number; active: number; completed: number }
  >();

  // Aggregate per-consultant: all ratings, completed count
  const consultantRatings = new Map<string, number[]>();

  for (const doc of consultationsSnap.docs) {
    const data = doc.data();
    const clientId = data.clientId as string | undefined;
    const consultantId = data.consultantId as string | undefined;
    const status = data.status as string | undefined;
    const rating = data.rating as number | undefined;

    if (clientId) {
      const cur = clientCounters.get(clientId) ?? { total: 0, active: 0, completed: 0 };
      cur.total += 1;
      if (status === 'completed') {
        cur.completed += 1;
      } else {
        cur.active += 1;
      }
      clientCounters.set(clientId, cur);
    }

    if (consultantId && typeof rating === 'number' && rating > 0) {
      const existing = consultantRatings.get(consultantId) ?? [];
      existing.push(rating);
      consultantRatings.set(consultantId, existing);
    }
  }

  // Write client counters in batches
  let userBatch = db.batch();
  let userOps = 0;
  const userBatches: admin.firestore.WriteBatch[] = [];

  for (const [uid, counters] of clientCounters) {
    if (userOps > 0 && userOps % 499 === 0) {
      userBatches.push(userBatch);
      userBatch = db.batch();
    }
    userBatch.update(db.collection('users').doc(uid), {
      totalConsultations: counters.total,
      activeConsultations: counters.active,
      completedConsultations: counters.completed,
    });
    userOps++;
  }
  userBatches.push(userBatch);
  await Promise.all(userBatches.map((b) => b.commit()));

  // Write consultant ratings in batches
  let consultantBatch = db.batch();
  let consultantOps = 0;
  const consultantBatches: admin.firestore.WriteBatch[] = [];

  for (const [consultantId, ratings] of consultantRatings) {
    if (consultantOps > 0 && consultantOps % 499 === 0) {
      consultantBatches.push(consultantBatch);
      consultantBatch = db.batch();
    }
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    consultantBatch.update(db.collection('consultantProfiles').doc(consultantId), {
      rating: Math.round(avg * 10) / 10,
      completedConsultations: ratings.length,
    });
    consultantOps++;
  }
  if (consultantOps > 0) {
    consultantBatches.push(consultantBatch);
    await Promise.all(consultantBatches.map((b) => b.commit()));
  }

  console.log(
    `[backfillCounters] updated ${clientCounters.size} users, ` +
      `${consultantRatings.size} consultant profiles`
  );

  return {
    usersUpdated: clientCounters.size,
    consultantsUpdated: consultantRatings.size,
  };
});
