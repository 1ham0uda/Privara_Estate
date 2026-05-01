/**
 * Unit tests for the in-memory rate limiter.
 * Pure module — no Firebase or Next.js dependencies.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit, rateLimitResponse } from '@/src/lib/rateLimit';

// The module uses a module-level Map. Re-import fresh each suite by faking time.
describe('checkRateLimit', () => {
  beforeEach(() => {
    // Advance time by enough to expire all existing entries
    vi.setSystemTime(new Date(Date.now() + 120_000));
  });

  it('allows the first request', () => {
    expect(checkRateLimit('test:ip-1', 5, 60_000)).toBe(true);
  });

  it('allows requests up to the limit', () => {
    const key = 'test:ip-2';
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 60_000)).toBe(true);
    }
  });

  it('blocks requests over the limit within the window', () => {
    const key = 'test:ip-3';
    for (let i = 0; i < 5; i++) checkRateLimit(key, 5, 60_000);
    expect(checkRateLimit(key, 5, 60_000)).toBe(false);
  });

  it('resets after the window expires', () => {
    const key = 'test:ip-4';
    for (let i = 0; i < 5; i++) checkRateLimit(key, 5, 60_000);
    expect(checkRateLimit(key, 5, 60_000)).toBe(false);

    // Advance past the window
    vi.setSystemTime(new Date(Date.now() + 61_000));
    expect(checkRateLimit(key, 5, 60_000)).toBe(true);
  });

  it('tracks different keys independently', () => {
    const keyA = 'test:ip-5a';
    const keyB = 'test:ip-5b';
    for (let i = 0; i < 3; i++) checkRateLimit(keyA, 3, 60_000);
    expect(checkRateLimit(keyA, 3, 60_000)).toBe(false);
    expect(checkRateLimit(keyB, 3, 60_000)).toBe(true);
  });

  it('a limit of 1 allows exactly one request then blocks', () => {
    const key = 'test:ip-6';
    expect(checkRateLimit(key, 1, 60_000)).toBe(true);
    expect(checkRateLimit(key, 1, 60_000)).toBe(false);
  });
});

describe('rateLimitResponse', () => {
  it('returns HTTP 429', () => {
    const res = rateLimitResponse();
    expect(res.status).toBe(429);
  });

  it('includes Retry-After header', () => {
    const res = rateLimitResponse();
    expect(res.headers.get('Retry-After')).toBe('60');
  });

  it('body is valid JSON with error field', async () => {
    const res = rateLimitResponse();
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
  });
});
