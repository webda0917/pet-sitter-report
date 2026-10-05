import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { toHonorific } from '@/types'

let _client: SupabaseClient | null = null

// サーバー専用。ブラウザからは呼ばない（APIルート経由でだけ使う）
export function getSupabaseServer(): SupabaseClient {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // service role キーが未設定のあいだは公開キーで接続する（RLS 有効化前の移行期間用）
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase 環境変数が設定されていません。')
  _client = createClient(url, key, { auth: { persistSession: false } })
  return _client
}

// カルテの添付画像を置く非公開バケット
export const KARTE_IMAGE_BUCKET = 'karte-images'
export const MAX_IMAGES_PER_SECTION = 2

// 画像パスは「顧客ID/ランダムID.拡張子」。これ以外の形は受け付けない
const IMAGE_PATH_RE = /^[A-Za-z0-9-]+\/[0-9a-f-]{36}\.(jpg|webp)$/

export function isKarteImagePath(path: unknown, clientId?: string): path is string {
  return typeof path === 'string' && IMAGE_PATH_RE.test(path) && (!clientId || path.startsWith(`${clientId}/`))
}

// karte（jsonb）の中では、本文はセクションのキーごとの文字列、画像は `_images` にまとめて持つ
export const KARTE_IMAGES_FIELD = '_images'

export function splitKarte(raw: unknown): { karte: Record<string, string>; images: Record<string, string[]> } {
  const karte: Record<string, string> = {}
  const images: Record<string, string[]> = {}
  if (!raw || typeof raw !== 'object') return { karte, images }
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (k === KARTE_IMAGES_FIELD && v && typeof v === 'object') {
      for (const [sk, paths] of Object.entries(v as Record<string, unknown>)) {
        const valid = Array.isArray(paths) ? paths.filter((p) => isKarteImagePath(p)) : []
        if (valid.length) images[sk] = valid
      }
    } else if (typeof v === 'string') {
      karte[k] = v
    }
  }
  return { karte, images }
}

export const CLIENT_COLUMNS = 'id, name, furigana, report_example, karte, karte_updated_at, pets(id, name, type, notes, honorific)'

// DBの行をアプリの Client 型に変換する
export function toClient(row: Record<string, unknown>) {
  const { karte, images } = splitKarte(row.karte)
  return {
    id: row.id as string,
    name: row.name as string,
    furigana: (row.furigana as string) ?? '',
    reportExample: (row.report_example as string) ?? '',
    karte,
    karteImages: images,
    karteUpdatedAt: (row.karte_updated_at as string) ?? null,
    pets: ((row.pets as { id: string; name: string; type: 'dog' | 'cat'; notes?: string; honorific?: string }[]) ?? []).map(
      (p) => ({ ...p, honorific: toHonorific(p.honorific) }),
    ),
  }
}
