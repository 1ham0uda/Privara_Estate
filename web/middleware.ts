import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'privara-session';
const VERIFIED_COOKIE = 'privara-verified';

/**
 * Protected path prefixes.
 * Requests to these paths require both an active session AND a verified email.
 */
const PROTECTED_PREFIXES = [
  '/admin',
  '/consultant',
  '/client',
  '/quality',
  '/cases',
  '/profile',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) return NextResponse.next();

  const session = request.cookies.get(SESSION_COOKIE);
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Logged in but email not verified → send to verification gate
  const verified = request.cookies.get(VERIFIED_COOKIE);
  if (!verified) {
    return NextResponse.redirect(new URL('/verify-email', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next.js internals, static assets, and public API routes.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
