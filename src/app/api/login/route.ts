import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken, verifyPassword } from '@/lib/session'

export async function POST(req: NextRequest) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string }

  if (typeof password !== 'string' || !(await verifyPassword(password))) {
    // 総当たりを遅くする
    await new Promise((r) => setTimeout(r, 800))
    return NextResponse.json({ error: 'パスワードが違います' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return res
}
