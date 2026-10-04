import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { KARTE_IMAGE_BUCKET } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

// 専用キー（service role）が効いているかの診断。
// 顧客・ペットの表には触れず、非公開の Storage バケットにテスト画像を保存→読み出し→削除する。
// キーの値そのものは返さない（種類・空白の有無などの判定結果だけ）

type KeyKind = 'missing' | 'empty' | 'secret' | 'service_role_jwt' | 'publishable' | 'anon_jwt' | 'unknown'

function classifyKey(raw: string | undefined): KeyKind {
  if (raw === undefined) return 'missing'
  const v = raw.trim()
  if (!v) return 'empty'
  if (v.startsWith('sb_secret_')) return 'secret'
  if (v.startsWith('sb_publishable_')) return 'publishable'
  if (v.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(Buffer.from(v.split('.')[1], 'base64url').toString('utf8'))
      if (payload.role === 'service_role') return 'service_role_jwt'
      if (payload.role === 'anon') return 'anon_jwt'
    } catch {
      // 読めない JWT は unknown 扱い
    }
  }
  return 'unknown'
}

// 1×1 の透明 PNG
const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

export async function GET() {
  const raw = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL

  const key = {
    kind: classifyKey(raw),
    hasSurroundingWhitespace: raw !== undefined && raw !== raw.trim(),
    sameAsPublicKey: !!raw && !!anon && raw.trim() === anon,
  }

  // 名前の打ち間違いを見つけるため、似た名前の環境変数を「名前だけ」列挙する
  const similarEnvNames = Object.keys(process.env)
    .filter((n) => /SUPABASE|SERVICE|ROLE/i.test(n))
    .sort()

  const storage: { ran: boolean; steps: { label: string; ok: boolean; detail?: string }[] } = { ran: false, steps: [] }

  if (url && raw && raw.trim()) {
    storage.ran = true
    const step = (label: string, ok: boolean, detail?: string) => storage.steps.push({ label, ok, detail })
    try {
      // アプリ本体と同じく、登録された値をそのまま使う
      const sb = createClient(url, raw, { auth: { persistSession: false } })

      const got = await sb.storage.getBucket(KARTE_IMAGE_BUCKET)
      if (got.data) {
        step('画像用の保存場所がある', true)
        step('保存場所が非公開になっている', !got.data.public, got.data.public ? '公開設定になっています' : undefined)
      } else {
        const created = await sb.storage.createBucket(KARTE_IMAGE_BUCKET, {
          public: false,
          fileSizeLimit: '5MB',
          allowedMimeTypes: ['image/jpeg', 'image/webp', 'image/png'],
        })
        step('画像用の保存場所を作成（非公開）', !created.error, created.error?.message)
      }

      const path = `_diagnostics/check-${Date.now()}.png`
      const up = await sb.storage.from(KARTE_IMAGE_BUCKET).upload(path, TEST_PNG, { contentType: 'image/png' })
      step('テスト画像を保存', !up.error, up.error?.message)

      if (!up.error) {
        const down = await sb.storage.from(KARTE_IMAGE_BUCKET).download(path)
        const same = !!down.data && Buffer.from(await down.data.arrayBuffer()).equals(TEST_PNG)
        step('テスト画像を読み出し', same, down.error?.message ?? (same ? undefined : '中身が一致しません'))

        const rm = await sb.storage.from(KARTE_IMAGE_BUCKET).remove([path])
        step('テスト画像を削除', !rm.error, rm.error?.message)
      }
    } catch (e) {
      storage.steps.push({ label: '接続', ok: false, detail: e instanceof Error ? e.message : String(e) })
    }
  }

  const keyOk = key.kind === 'secret' || key.kind === 'service_role_jwt'
  const storageOk = storage.ran && storage.steps.every((s) => s.ok)

  return NextResponse.json({ ok: keyOk && storageOk, key, similarEnvNames, storage })
}
