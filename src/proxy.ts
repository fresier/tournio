import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Ce contrôle optimise la redirection ; chaque page et API valide la session en base.
  if (!getSessionCookie(request, { cookiePrefix: 'tournio' })) return NextResponse.redirect(new URL('/login', request.url));
  const response = NextResponse.next({ request });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = { matcher: ['/dashboard/:path*'] };
