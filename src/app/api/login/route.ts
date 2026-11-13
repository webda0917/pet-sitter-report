import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken, verifyPassword } from '@/lib/session'
import { clearLoginAttempts, recordLoginAttempt } from '@/lib/loginLimiter'

export async function POST(req: NextRequest) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string }

  // 続けて間違えた回線は、パスワードが合っているかどうかを確かめる前に断る
  const attempt = await recordLoginAttempt(req)
  if (attempt.blocked) {
    return NextResponse.json(
      { error: 'パスワードの入力を続けて間違えたため、一時的に受け付けを止めています。15分ほど待ってからお試しください。' },
      { status: 429 },
    )
  }

  if (typeof password !== 'string' || !(await verifyPassword(password))) {
    // 総当たりを遅くする
    await new Promise((r) => setTimeout(r, 800))
    return NextResponse.json({ error: 'パスワードが違います' }, { status: 401 })
  }

  await clearLoginAttempts(attempt.key)

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
