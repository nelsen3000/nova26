import { NextRequest, NextResponse } from 'next/server';

// Routes that require authentication
const PROTECTED_PREFIXES = ['/dashboard'];

// Routes that authenticated users should not see
const AUTH_ROUTES = ['/sign-in', '/sign-up'];

// Routes that are always public
const PUBLIC_ROUTES = ['/', '/api'];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * Check authentication status by reading the session cookie.
 * Adjust the cookie name to match your auth provider.
 */
function getSessionToken(request: NextRequest): string | null {
  // Check common session cookie names
  return (
    request.cookies.get('nova26-session')?.value ??
    request.cookies.get('__session')?.value ??
    null
  );
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const sessionToken = getSessionToken(request);
  const isAuthenticated = !!sessionToken;

  // Allow public routes and static assets unconditionally
  if (PUBLIC_ROUTES.some((r) => pathname === r)) {
    return NextResponse.next();
  }

  // Authenticated users hitting auth routes → send to dashboard
  if (isAuthRoute(pathname) && isAuthenticated) {
    const redirect = searchParams.get('redirect') ?? '/dashboard';
    return NextResponse.redirect(new URL(redirect, request.url));
  }

  // Unauthenticated users hitting protected routes → send to sign-in
  if (isProtected(pathname) && !isAuthenticated) {
    const destination = encodeURIComponent(
      pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '')
    );
    return NextResponse.redirect(
      new URL(`/sign-in?redirect=${destination}`, request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
