import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'

// ログイン画面・ログインAPI・静的ファイル以外はすべてログイン必須
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|logo.svg|manifest.json|login|api/login).*)'],
}

export async function middleware(req: NextRequest) {
  const ok = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)
  if (ok) return NextResponse.next()

  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }
  return NextResponse.redirect(new URL('/login', req.url))
}
