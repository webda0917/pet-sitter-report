import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from './session'

// middleware に加えて、各 API の入口でもログインを確かめる。
// middleware が何らかの理由で効かなかったときも、データを素通しにしないための二重の備え
export async function requireSession(): Promise<NextResponse | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (await verifySessionToken(token)) return null
  return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
}
