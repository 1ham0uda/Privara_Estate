/**
 * Firestore security rules integration tests.
 * Requires the Firestore emulator: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
 * Run: firebase emulators:start --only firestore && npx vitest run tests/firestore-rules.test.ts
 *
 * These tests are automatically skipped in CI when the emulator is not available.
 * Set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 to enable them.
 */
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { describe, it, beforeAll, afterAll, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const [EMULATOR_ADDR, EMULATOR_PORT] = EMULATOR_HOST.split(':');
const EMULATOR_AVAILABLE = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

let testEnv: RulesTestEnvironment;

const PROJECT_ID = 'test-project';
const RULES_PATH = path.resolve(__dirname, '../firestore.rules');

beforeAll(async () => {
  if (!EMULATOR_AVAILABLE) return;
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(RULES_PATH, 'utf-8'),
      host: EMULATOR_ADDR,
      port: Number(EMULATOR_PORT),
    },
  });
});

afterEach(async () => {
  if (!EMULATOR_AVAILABLE) return;
  await testEnv.clearFirestore();
});

afterAll(async () => {
  if (!EMULATOR_AVAILABLE) return;
  await testEnv.cleanup();
});

// ─── Users collection ──────────────────────────────────────────────────────────

const describeWithEmulator = EMULATOR_AVAILABLE ? describe : describe.skip;

describeWithEmulator('users collection', () => {
  it('allows an authenticated user to read their own profile', async () => {
    const uid = 'user-alice';
    const ctx = testEnv.authenticatedContext(uid);
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env.firestore().collection('users').doc(uid).set({ uid, role: 'client', email: 'alice@example.com' });
    });
    await assertSucceeds(ctx.firestore().collection('users').doc(uid).get());
  });

  it('denies reading another user profile when not admin', async () => {
    const alice = 'user-alice';
    const bob = 'user-bob';
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env.firestore().collection('users').doc(alice).set({ uid: alice, role: 'client', email: 'alice@test.com' });
    });
    const ctx = testEnv.authenticatedContext(bob, { role: 'client' });
    await assertFails(ctx.firestore().collection('users').doc(alice).get());
  });

  it('prevents a user from self-promoting their role', async () => {
    const uid = 'user-charlie';
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env.firestore().collection('users').doc(uid).set({
        uid,
        role: 'client',
        email: 'charlie@test.com',
        displayName: 'Charlie',
        createdAt: new Date(),
        totalConsultations: 0,
        activeConsultations: 0,
        completedConsultations: 0,
      });
    });
    const ctx = testEnv.authenticatedContext(uid);
    await assertFails(
      ctx.firestore().collection('users').doc(uid).update({ role: 'admin' })
    );
  });
});

// ─── Consultations collection ──────────────────────────────────────────────────

describeWithEmulator('consultations collection', () => {
  it('allows a client to read their own consultation', async () => {
    const clientId = 'client-1';
    const caseId = 'case-abc';
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env.firestore().collection('users').doc(clientId).set({ uid: clientId, role: 'client', email: 'c@test.com' });
      await env.firestore().collection('consultations').doc(caseId).set({ clientId, status: 'active', paymentStatus: 'paid' });
    });
    const ctx = testEnv.authenticatedContext(clientId);
    await assertSucceeds(ctx.firestore().collection('consultations').doc(caseId).get());
  });

  it('denies an unrelated client from reading another client case', async () => {
    const clientId = 'client-1';
    const otherId = 'client-2';
    const caseId = 'case-secret';
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env.firestore().collection('users').doc(clientId).set({ uid: clientId, role: 'client', email: 'c1@test.com' });
      await env.firestore().collection('users').doc(otherId).set({ uid: otherId, role: 'client', email: 'c2@test.com' });
      await env.firestore().collection('consultations').doc(caseId).set({ clientId, status: 'active' });
    });
    const ctx = testEnv.authenticatedContext(otherId);
    await assertFails(ctx.firestore().collection('consultations').doc(caseId).get());
  });

  it('denies an unauthenticated read of consultations', async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(ctx.firestore().collection('consultations').get());
  });
});

// ─── Notifications collection ──────────────────────────────────────────────────

describeWithEmulator('notifications collection', () => {
  it('allows a user to read their own notifications', async () => {
    const uid = 'notif-user';
    const notifId = 'notif-1';
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env.firestore().collection('users').doc(uid).set({ uid, role: 'client', email: 'n@test.com' });
      await env.firestore().collection('notifications').doc(notifId).set({ recipientId: uid, type: 'consultation_created' });
    });
    const ctx = testEnv.authenticatedContext(uid);
    await assertSucceeds(ctx.firestore().collection('notifications').doc(notifId).get());
  });

  it('denies reading another user notification', async () => {
    const owner = 'notif-owner';
    const stranger = 'notif-stranger';
    const notifId = 'notif-2';
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env.firestore().collection('users').doc(owner).set({ uid: owner, role: 'client', email: 'o@test.com' });
      await env.firestore().collection('users').doc(stranger).set({ uid: stranger, role: 'client', email: 's@test.com' });
      await env.firestore().collection('notifications').doc(notifId).set({ recipientId: owner, type: 'consultation_created' });
    });
    const ctx = testEnv.authenticatedContext(stranger);
    await assertFails(ctx.firestore().collection('notifications').doc(notifId).get());
  });
});
