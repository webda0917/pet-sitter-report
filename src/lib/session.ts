// 共通パスワード方式のセッション。middleware（Edge）でも動くよう Web Crypto だけで実装する

export const SESSION_COOKIE = 'hf_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30日

// パスワードを変えると署名鍵も変わり、全端末がログアウトされる
function getSecret(): string | null {
  const secret = process.env.SESSION_SECRET
  const password = process.env.APP_PASSWORD
  if (!secret || !password) return null
  return `${secret}:${password}`
}

async function hmacHex(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifyPassword(input: string): Promise<boolean> {
  const password = process.env.APP_PASSWORD
  if (!password) return false
  // 長さの違いを漏らさないよう、ハッシュ同士を比較する
  const [a, b] = await Promise.all([hmacHex(input, 'pw'), hmacHex(password, 'pw')])
  return safeEqual(a, b)
}

export async function createSessionToken(): Promise<string> {
  const secret = getSecret()
  if (!secret) throw new Error('APP_PASSWORD / SESSION_SECRET が設定されていません')
  const exp = String(Date.now() + SESSION_MAX_AGE * 1000)
  return `${exp}.${await hmacHex(exp, secret)}`
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  const secret = getSecret()
  if (!secret || !token) return false
  const [exp, sig] = token.split('.')
  if (!exp || !sig || !/^\d+$/.test(exp)) return false
  if (Number(exp) < Date.now()) return false
  return safeEqual(sig, await hmacHex(exp, secret))
}
