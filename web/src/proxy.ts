import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME, getExpectedSessionToken } from '@/lib/auth'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Lewati aset statis dan rute publik
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/api/leads/ingest') || // Jalur Ingestion memakai Bearer Token
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/login')
  ) {
    return NextResponse.next()
  }

  // 2. Periksa session cookie
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const expectedToken = getExpectedSessionToken()

  const isAuthenticated = sessionToken && sessionToken === expectedToken

  // 3. Jika belum login dan mengakses halaman web -> Redirect ke /login
  if (!isAuthenticated) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized: Harap login terlebih dahulu' }, { status: 401 })
    }

    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // 4. Jika sudah login dan mencoba mengakses /login -> Redirect ke /
  if (isAuthenticated && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

