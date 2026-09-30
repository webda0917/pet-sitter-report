import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'

type Ctx = { params: { id: string } }

// 顧客の基本情報、またはカルテを更新する（送られてきた項目だけ）
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const body = (await req.json()) as {
    name?: string
    furigana?: string
    reportExample?: string
    karte?: Record<string, string>
  }

  const update: Record<string, unknown> = {}
  if (body.name !== undefined) {
    if (!body.name.trim()) return NextResponse.json({ error: 'お客様名を入力してください' }, { status: 400 })
    update.name = body.name
  }
  if (body.furigana !== undefined) update.furigana = body.furigana
  if (body.reportExample !== undefined) update.report_example = body.reportExample
  if (body.karte !== undefined) {
    update.karte = body.karte
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
  return NextResponse.json({ ok: true, karteUpdatedAt: data?.karte_updated_at ?? null })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { error } = await getSupabaseServer().from('clients').delete().eq('id', params.id)
  if (error) {
    console.error('clients DELETE error:', error)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
