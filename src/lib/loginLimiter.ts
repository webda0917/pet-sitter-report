import { createHmac } from 'crypto'
import type { NextRequest } from 'next/server'
import { getSupabaseServer } from './supabaseServer'

// パスワードの総当たり対策。login_attempts テーブルに試行を記録して数える。
// 表が無い・読めないときは制限なしで通す（ログインそのものを止めないため）。その状態は /diagnostics で分かる

const WINDOW_MINUTES = 15
// 同じ回線からの試行の上限（正しく入れば記録は消える）
export const MAX_ATTEMPTS_PER_IP = 10
// 回線を変えながらの総当たりに備えた、全体の上限
export const MAX_ATTEMPTS_TOTAL = 200

// IP アドレスはそのまま保存せず、元に戻せない値にして記録する
function ipKey(req: NextRequest): string {
  // Vercel では x-real-ip / x-forwarded-for の先頭が接続元で、利用者側からは偽装できない
  const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  return createHmac('sha256', process.env.SESSION_SECRET ?? 'login-limiter').update(ip).digest('hex').slice(0, 32)
}

export interface LoginAttempt {
  key: string
  blocked: boolean
}

// 試行を先に記録してから数える（同時に大量に送られても、数え漏れが増えないようにするため）
export async function recordLoginAttempt(req: NextRequest): Promise<LoginAttempt> {
  const key = ipKey(req)
  try {
    const sb = getSupabaseServer()
    const { error: insertError } = await sb.from('login_attempts').insert({ ip_hash: key })
    if (insertError) throw insertError

    const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()
    const [mine, total] = await Promise.all([
      // head: true（件数だけの問い合わせ）はエラーが握りつぶされることがあるため使わない
      sb.from('login_attempts').select('id', { count: 'exact' }).eq('ip_hash', key).gte('created_at', since).limit(1),
      sb.from('login_attempts').select('id', { count: 'exact' }).gte('created_at', since).limit(1),
    ])
    if (mine.error || total.error) throw mine.error ?? total.error
    if (mine.count === null || total.count === null) throw new Error('count unavailable')

    return { key, blocked: (mine.count ?? 0) > MAX_ATTEMPTS_PER_IP || (total.count ?? 0) > MAX_ATTEMPTS_TOTAL }
  } catch (e) {
    console.error('login limiter unavailable:', e)
    return { key, blocked: false }
  }
}

// 正しく入れた回線の記録を消す。ついでに古い記録も片付ける
export async function clearLoginAttempts(key: string): Promise<void> {
  try {
    const sb = getSupabaseServer()
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    await Promise.all([
      sb.from('login_attempts').delete().eq('ip_hash', key),
      sb.from('login_attempts').delete().lt('created_at', dayAgo),
    ])
  } catch (e) {
    console.error('login limiter cleanup failed:', e)
  }
}

// 診断用：回数制限が使える状態か
export async function isLoginLimiterReady(): Promise<boolean> {
  try {
    const { error } = await getSupabaseServer().from('login_attempts').select('id').limit(1)
    return !error
  } catch {
    return false
  }
}
