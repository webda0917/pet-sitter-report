import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'

// ビルド済みの JS・CSS 以外は、すべてここを通す
export const config = {
  matcher: ['/((?!_next/static/).*)'],
}

// ログインせずに開けるのは、ログイン画面・ログインAPI・アイコン類だけ（完全一致）
const PUBLIC_PATHS = new Set(['/login', '/api/login', '/favicon.ico', '/icon.png', '/logo.svg', '/manifest.json'])

export async function middleware(req: NextRequest) {
  if (PUBLIC_PATHS.has(req.nextUrl.pathname)) return NextResponse.next()

  const ok = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)
  if (ok) return NextResponse.next()

  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }
  return NextResponse.redirect(new URL('/login', req.url))
}
