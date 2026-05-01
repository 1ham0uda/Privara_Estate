import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, rateLimitResponse } from '@/src/lib/rateLimit';

const SESSION_COOKIE = 'privara-session';
const VERIFIED_COOKIE = 'privara-verified';
// 7-day session — matches typical Firebase token refresh cadence
const MAX_AGE = 60 * 60 * 24 * 7;

/**
 * POST /api/auth/session
 * Called by AuthContext after Firebase client-side sign-in.
 * Sets an httpOnly session-presence cookie so that middleware can
 * redirect unauthenticated visitors before React boots.
 *
 * Actual data-access security is enforced by Firestore security rules;
 * this cookie is a UX-layer guard only.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(`session:${ip}`, 10, 60_000)) return rateLimitResponse();

  // CSRF: reject cross-origin cookie-setting requests.
  // Browsers always send Origin on cross-origin POST; same-origin requests may omit it.
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host) {
    const allowedOrigins = process.env.NEXT_PUBLIC_APP_URL
      ? [process.env.NEXT_PUBLIC_APP_URL]
      : [`http://${host}`, `https://${host}`];
    if (!allowedOrigins.some((o) => origin === o || origin.endsWith(`.${host}`))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  let idToken: string | undefined;
  let emailVerified = false;
  try {
    const body = await req.json();
    idToken = typeof body?.idToken === 'string' ? body.idToken : undefined;
    emailVerified = body?.emailVerified === true;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (!idToken) {
    return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });

  if (emailVerified) {
    res.cookies.set(VERIFIED_COOKIE, '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: MAX_AGE,
      path: '/',
    });
  } else {
    // Ensure stale verified cookie is cleared when re-authenticating unverified
    res.cookies.set(VERIFIED_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
  }

  return res;
}

/**
 * DELETE /api/auth/session
 * Called by AuthContext on sign-out to clear the session cookie.
 */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 0,
    path: '/',
  };
  res.cookies.set(SESSION_COOKIE, '', cookieOpts);
  res.cookies.set(VERIFIED_COOKIE, '', cookieOpts);
  return res;
}
