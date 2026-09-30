import { createClient, SupabaseClient } from '@supabase/supabase-js'

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

export const CLIENT_COLUMNS = 'id, name, furigana, report_example, karte, karte_updated_at, pets(id, name, type, notes)'

// DBの行をアプリの Client 型に変換する
export function toClient(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    furigana: (row.furigana as string) ?? '',
    reportExample: (row.report_example as string) ?? '',
    karte: (row.karte as Record<string, string>) ?? {},
    karteUpdatedAt: (row.karte_updated_at as string) ?? null,
    pets: (row.pets as { id: string; name: string; type: 'dog' | 'cat'; notes?: string }[]) ?? [],
  }
}
