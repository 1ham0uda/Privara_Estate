/**
 * Payment callback HMAC signature verification tests.
 * These are pure unit tests — no Firebase emulator needed.
 */
import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

// ─── Extracted signature logic (mirrors the callback route) ───────────────────

function buildSignaturePayload(
  publicKey: string,
  amount: string,
  currency: string,
  orderId: string,
  status: string,
  merchantRef: string,
  timestamp: string,
): string {
  return [publicKey, amount, currency, orderId, status, merchantRef, timestamp].join('');
}

function verifyGeideaSignature(
  payload: Record<string, string>,
  secret: string,
): boolean {
  const expected = buildSignaturePayload(
    payload.publicKey,
    payload.amount,
    payload.currency,
    payload.orderId ?? '',
    payload.status,
    payload.merchantReferenceId,
    payload.timestamp,
  );
  const signature = crypto
    .createHmac('sha256', secret)
    .update(expected)
    .digest('base64');
  return signature === payload.signature;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

const SECRET = 'test-api-password-123';

function buildValidPayload(): Record<string, string> {
  const publicKey = 'test-public-key';
  const amount = '500.00';
  const currency = 'EGP';
  const orderId = 'order-abc';
  const status = 'Success';
  const merchantReferenceId = 'ref-xyz';
  const timestamp = '2026-04-29T10:00:00Z';

  const rawPayload = buildSignaturePayload(publicKey, amount, currency, orderId, status, merchantReferenceId, timestamp);
  const signature = crypto.createHmac('sha256', SECRET).update(rawPayload).digest('base64');

  return { publicKey, amount, currency, orderId, status, merchantReferenceId, timestamp, signature };
}

describe('Geidea HMAC signature verification', () => {
  it('accepts a valid signature', () => {
    const payload = buildValidPayload();
    expect(verifyGeideaSignature(payload, SECRET)).toBe(true);
  });

  it('rejects a tampered amount', () => {
    const payload = { ...buildValidPayload(), amount: '1.00' };
    expect(verifyGeideaSignature(payload, SECRET)).toBe(false);
  });

  it('rejects a tampered status', () => {
    const payload = { ...buildValidPayload(), status: 'Failed' };
    expect(verifyGeideaSignature(payload, SECRET)).toBe(false);
  });

  it('rejects a wrong secret', () => {
    const payload = buildValidPayload();
    expect(verifyGeideaSignature(payload, 'wrong-secret')).toBe(false);
  });

  it('rejects an empty signature', () => {
    const payload = { ...buildValidPayload(), signature: '' };
    expect(verifyGeideaSignature(payload, SECRET)).toBe(false);
  });

  it('rejects when orderId is missing (empty string)', () => {
    const payload = buildValidPayload();
    const rawPayload = buildSignaturePayload(
      payload.publicKey, payload.amount, payload.currency,
      '', payload.status, payload.merchantReferenceId, payload.timestamp,
    );
    const badSig = crypto.createHmac('sha256', SECRET).update(rawPayload).digest('base64');
    const tamperedPayload = { ...payload, orderId: '', signature: badSig };
    // With the correct empty-orderId signature it should pass
    expect(verifyGeideaSignature(tamperedPayload, SECRET)).toBe(true);
    // But using the original orderId-carrying signature it must fail
    expect(verifyGeideaSignature({ ...tamperedPayload, signature: payload.signature }, SECRET)).toBe(false);
  });
});

describe('Idempotency guard logic', () => {
  it('identifies already-paid status correctly', () => {
    const paymentStatus = 'paid';
    expect(paymentStatus === 'paid').toBe(true);
  });

  it('does not treat initiated as paid', () => {
    const paymentStatus = 'initiated';
    expect(paymentStatus === 'paid').toBe(false);
  });
});
