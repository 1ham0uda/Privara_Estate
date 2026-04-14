import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'privara-session';

/**
 * Protected path prefixes.
 * Any request whose pathname starts with one of these will be redirected to
 * /login if the session cookie is absent.
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

  return NextResponse.next();
}

export const config = {
  // Skip Next.js internals, static assets, and public API routes.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
