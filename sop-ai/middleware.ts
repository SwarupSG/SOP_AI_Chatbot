import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Allow public access to login page
  if (request.nextUrl.pathname === '/login') {
    return NextResponse.next();
  }

  // Check for auth token
  const token = request.cookies.get('auth-token');
  
  // If no token and not on login page, redirect to login
  if (!token && request.nextUrl.pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

