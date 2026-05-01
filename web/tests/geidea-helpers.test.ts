/**
 * Unit tests for Geidea payment helper functions.
 * Pure crypto functions — no Firebase or network calls.
 */
import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  formatGeideaAmount,
  buildCreateSessionSignature,
  buildCallbackSignature,
  extractGeideaCallbackSummary,
  isGeideaPaymentSuccessful,
  getGeideaLanguage,
} from '@/src/lib/geidea';

const PUB_KEY = 'test-pub-key';
const API_PASS = 'test-api-password';

// ─── formatGeideaAmount ────────────────────────────────────────────────────────

describe('formatGeideaAmount', () => {
  it('formats integer to two decimal places', () => {
    expect(formatGeideaAmount(500)).toBe('500.00');
  });

  it('rounds to two decimal places', () => {
    expect(formatGeideaAmount(10.5)).toBe('10.50');
  });

  it('handles zero', () => {
    expect(formatGeideaAmount(0)).toBe('0.00');
  });
});

// ─── buildCreateSessionSignature ──────────────────────────────────────────────

describe('buildCreateSessionSignature', () => {
  it('produces a base64 HMAC-SHA256 string', () => {
    const sig = buildCreateSessionSignature(PUB_KEY, 500, 'EGP', 'ref-123', '2026-04-01T00:00:00Z', API_PASS);
    expect(typeof sig).toBe('string');
    expect(sig.length).toBeGreaterThan(0);
    // Base64 character set check
    expect(/^[A-Za-z0-9+/=]+$/.test(sig)).toBe(true);
  });

  it('is deterministic for the same inputs', () => {
    const args = [PUB_KEY, 500, 'EGP', 'ref-123', '2026-04-01T00:00:00Z', API_PASS] as const;
    expect(buildCreateSessionSignature(...args)).toBe(buildCreateSessionSignature(...args));
  });

  it('matches manual HMAC computation', () => {
    const amount = 250;
    const currency = 'SAR';
    const ref = 'ref-manual';
    const ts = '2026-01-01T12:00:00Z';
    const data = `${PUB_KEY}${formatGeideaAmount(amount)}${currency}${ts}${ref}`;
    const expected = crypto.createHmac('sha256', API_PASS).update(data).digest('base64');
    expect(buildCreateSessionSignature(PUB_KEY, amount, currency, ref, ts, API_PASS)).toBe(expected);
  });
});

// ─── buildCallbackSignature ───────────────────────────────────────────────────

describe('buildCallbackSignature', () => {
  it('produces a verifiable HMAC for known inputs', () => {
    const amount = 750;
    const currency = 'EGP';
    const orderId = 'order-001';
    const status = 'Success';
    const ref = 'ref-001';
    const ts = '2026-04-29T10:00:00Z';
    const sig = buildCallbackSignature(PUB_KEY, amount, currency, orderId, status, ref, ts, API_PASS);
    const data = `${PUB_KEY}${formatGeideaAmount(amount)}${currency}${orderId}${status}${ref}${ts}`;
    const expected = crypto.createHmac('sha256', API_PASS).update(data).digest('base64');
    expect(sig).toBe(expected);
  });
});

// ─── extractGeideaCallbackSummary ─────────────────────────────────────────────

describe('extractGeideaCallbackSummary', () => {
  it('extracts top-level fields', () => {
    const summary = extractGeideaCallbackSummary({
      merchantReferenceId: 'ref-top',
      amount: 100,
      currency: 'EGP',
      status: 'Success',
      responseCode: '000',
      responseMessage: 'Approved',
      detailedResponseCode: '000',
      detailedResponseMessage: 'Transaction Approved',
      signature: 'sig-xyz',
      timeStamp: '2026-04-01T00:00:00Z',
    });
    expect(summary.merchantReferenceId).toBe('ref-top');
    expect(summary.amount).toBe(100);
    expect(summary.currency).toBe('EGP');
    expect(summary.status).toBe('Success');
    expect(summary.responseCode).toBe('000');
  });

  it('falls back to nested order object', () => {
    const summary = extractGeideaCallbackSummary({
      order: {
        merchantReferenceId: 'ref-nested',
        amount: 200,
        currency: 'SAR',
        status: 'Failed',
        codes: {
          responseCode: '111',
          responseMessage: 'Declined',
        },
      },
    });
    expect(summary.merchantReferenceId).toBe('ref-nested');
    expect(summary.amount).toBe(200);
    expect(summary.responseCode).toBe('111');
  });

  it('returns null for missing optional fields', () => {
    const summary = extractGeideaCallbackSummary({});
    expect(summary.merchantReferenceId).toBeNull();
    expect(summary.orderId).toBeNull();
    expect(summary.amount).toBeNull();
  });

  it('handles non-object input gracefully', () => {
    const summary = extractGeideaCallbackSummary(null);
    expect(summary.merchantReferenceId).toBeNull();
  });
});

// ─── isGeideaPaymentSuccessful ────────────────────────────────────────────────

describe('isGeideaPaymentSuccessful', () => {
  const successBase = {
    merchantReferenceId: 'ref',
    orderId: 'order',
    amount: 500,
    currency: 'EGP',
    status: 'Success',
    responseCode: '000',
    detailedResponseCode: '000',
    detailedResponseMessage: 'Approved',
    responseMessage: 'Approved',
    reference: null,
    signature: null,
    timestamp: null,
  };

  it('returns true for a well-formed success response', () => {
    expect(isGeideaPaymentSuccessful(successBase)).toBe(true);
  });

  it('is case-insensitive on status', () => {
    expect(isGeideaPaymentSuccessful({ ...successBase, status: 'success' })).toBe(true);
    expect(isGeideaPaymentSuccessful({ ...successBase, status: 'SUCCESS' })).toBe(true);
  });

  it('returns false when status is not success', () => {
    expect(isGeideaPaymentSuccessful({ ...successBase, status: 'Failed' })).toBe(false);
  });

  it('returns false when responseCode is not 000', () => {
    expect(isGeideaPaymentSuccessful({ ...successBase, responseCode: '001' })).toBe(false);
  });

  it('returns false when detailedResponseCode signals failure', () => {
    expect(isGeideaPaymentSuccessful({ ...successBase, detailedResponseCode: '051' })).toBe(false);
  });

  it('returns true when detailedResponseCode is null (not required)', () => {
    expect(isGeideaPaymentSuccessful({ ...successBase, detailedResponseCode: null })).toBe(true);
  });

  it('returns false when status is null', () => {
    expect(isGeideaPaymentSuccessful({ ...successBase, status: null })).toBe(false);
  });
});

// ─── getGeideaLanguage ────────────────────────────────────────────────────────

describe('getGeideaLanguage', () => {
  it('returns ar for ar input', () => {
    expect(getGeideaLanguage('ar')).toBe('ar');
  });

  it('returns en for en input', () => {
    expect(getGeideaLanguage('en')).toBe('en');
  });

  it('defaults to en for unknown locales', () => {
    expect(getGeideaLanguage('fr')).toBe('en');
    expect(getGeideaLanguage(null)).toBe('en');
    expect(getGeideaLanguage(undefined)).toBe('en');
  });
});
