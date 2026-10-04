import { NextRequest, NextResponse } from 'next/server'
import {
  getSupabaseServer,
  isKarteImagePath,
  splitKarte,
  KARTE_IMAGE_BUCKET,
  KARTE_IMAGES_FIELD,
  MAX_IMAGES_PER_SECTION,
} from '@/lib/supabaseServer'

type Ctx = { params: { id: string } }

// 顧客の基本情報、またはカルテを更新する（送られてきた項目だけ）
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const body = (await req.json()) as {
    name?: string
    furigana?: string
    reportExample?: string
    karte?: Record<string, string>
    karteImages?: Record<string, string[]>
  }

  const update: Record<string, unknown> = {}
  if (body.name !== undefined) {
    if (!body.name.trim()) return NextResponse.json({ error: 'お客様名を入力してください' }, { status: 400 })
    update.name = body.name
  }
  if (body.furigana !== undefined) update.furigana = body.furigana
  if (body.reportExample !== undefined) update.report_example = body.reportExample

  // カルテを保存するときは、画像の一覧も一緒に組み立てる。外した画像は保存後に Storage から消す
  let removedImages: string[] = []
  if (body.karte !== undefined) {
    const { data: current, error: readError } = await getSupabaseServer()
      .from('clients')
      .select('karte')
      .eq('id', params.id)
      .single()
    if (readError) {
      console.error('clients PATCH read error:', readError)
      return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 })
    }
    const oldImages = splitKarte(current?.karte).images

    // 画像の一覧が送られてこなかったときは、今の画像をそのまま残す
    let images = oldImages
    if (body.karteImages !== undefined) {
      images = {}
      for (const [key, paths] of Object.entries(body.karteImages)) {
        const valid = (Array.isArray(paths) ? paths : []).filter((p) => isKarteImagePath(p, params.id))
        if (valid.length) images[key] = valid.slice(0, MAX_IMAGES_PER_SECTION)
      }
    }

    const text: Record<string, string> = {}
    for (const [k, v] of Object.entries(body.karte)) if (k !== KARTE_IMAGES_FIELD && typeof v === 'string') text[k] = v

    const kept = new Set(Object.values(images).flat())
    removedImages = Object.values(oldImages).flat().filter((p) => !kept.has(p))

    update.karte = Object.keys(images).length ? { ...text, [KARTE_IMAGES_FIELD]: images } : text
    update.karte_updated_at = new Date().toISOString()
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: '更新内容がありません' }, { status: 400 })

  const { data, error } = await getSupabaseServer()
    .from('clients')
    .update(update)
    .eq('id', params.id)
    .select('karte_updated_at')
    .single()
  if (error) {
    console.error('clients PATCH error:', error)
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 })
  }

  if (removedImages.length) {
    const { error: rmError } = await getSupabaseServer().storage.from(KARTE_IMAGE_BUCKET).remove(removedImages)
    if (rmError) console.error('karte image remove error:', rmError)
  }
  return NextResponse.json({ ok: true, karteUpdatedAt: data?.karte_updated_at ?? null })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { error } = await getSupabaseServer().from('clients').delete().eq('id', params.id)
  if (error) {
    console.error('clients DELETE error:', error)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }

  // カルテの添付画像もまとめて消す（失敗しても顧客の削除は完了扱い）
  const bucket = getSupabaseServer().storage.from(KARTE_IMAGE_BUCKET)
  const { data: files } = await bucket.list(params.id, { limit: 100 })
  if (files?.length) {
    const { error: rmError } = await bucket.remove(files.map((f) => `${params.id}/${f.name}`))
    if (rmError) console.error('karte image remove error:', rmError)
  }
  return NextResponse.json({ ok: true })
}
