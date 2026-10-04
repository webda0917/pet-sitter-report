import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer, isKarteImagePath, splitKarte, KARTE_IMAGE_BUCKET } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

// カルテの添付画像。保存先は非公開バケットで、見られるのはログイン済みのスタッフだけ（middleware で保護）

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/webp': 'webp' }
// ブラウザ側で縮小済みのはず。それでも大きいものは断る
const MAX_BYTES = 3 * 1024 * 1024
const SIGNED_URL_SECONDS = 60 * 60

// 画像を表示する：短時間だけ有効な署名付きURLへ転送する
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path')
  if (!isKarteImagePath(path)) return NextResponse.json({ error: '画像が見つかりません' }, { status: 404 })

  const { data, error } = await getSupabaseServer().storage.from(KARTE_IMAGE_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS)
  if (error || !data) {
    console.error('karte image sign error:', error)
    return NextResponse.json({ error: '画像が見つかりません' }, { status: 404 })
  }
  const res = NextResponse.redirect(data.signedUrl, 302)
  // 署名の有効期限より短い時間だけ、その端末に覚えさせる
  res.headers.set('Cache-Control', 'private, max-age=600')
  return res
}

// 画像を保存する（カルテへの反映は、カルテの「保存」で行う）
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  const clientId = form?.get('clientId')
  const file = form?.get('file')
  if (typeof clientId !== 'string' || !/^[A-Za-z0-9-]+$/.test(clientId) || !(file instanceof Blob)) {
    return NextResponse.json({ error: '画像を受け取れませんでした' }, { status: 400 })
  }
  const ext = TYPES[file.type]
  if (!ext) return NextResponse.json({ error: 'この形式の画像は添付できません' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: '画像が大きすぎます' }, { status: 400 })

  const path = `${clientId}/${randomUUID()}.${ext}`
  const { error } = await getSupabaseServer()
    .storage.from(KARTE_IMAGE_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type })
  if (error) {
    console.error('karte image upload error:', error)
    return NextResponse.json({ error: '画像の保存に失敗しました' }, { status: 500 })
  }
  return NextResponse.json({ path })
}

// カルテに保存しなかった画像を消す。保存済みのカルテに載っている画像は消さない
export async function DELETE(req: NextRequest) {
  const { clientId, paths } = (await req.json().catch(() => ({}))) as { clientId?: string; paths?: unknown[] }
  if (typeof clientId !== 'string' || !Array.isArray(paths)) {
    return NextResponse.json({ error: '削除する画像がありません' }, { status: 400 })
  }

  const { data, error } = await getSupabaseServer().from('clients').select('karte').eq('id', clientId).single()
  if (error) {
    console.error('karte image delete read error:', error)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
  const saved = new Set(Object.values(splitKarte(data?.karte).images).flat())
  const targets = paths.filter((p): p is string => isKarteImagePath(p, clientId) && !saved.has(p))
  if (targets.length) {
    const { error: rmError } = await getSupabaseServer().storage.from(KARTE_IMAGE_BUCKET).remove(targets)
    if (rmError) {
      console.error('karte image remove error:', rmError)
      return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
    }
  }
  return NextResponse.json({ ok: true })
}
