import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer, MAX_REPORT_LENGTH } from '@/lib/supabaseServer'
import { requireSession } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

// 同じ訪問の報告文を直してコピーし直したときは、1件として上書きする
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const denied = await requireSession()
  if (denied) return denied

  const { id } = await params
  const { body } = (await req.json().catch(() => ({}))) as { body?: string }
  if (!body?.trim()) return NextResponse.json({ error: '保存する内容がありません' }, { status: 400 })

  const { error } = await getSupabaseServer().from('reports').update({ body: body.trim().slice(0, MAX_REPORT_LENGTH) }).eq('id', id)
  if (error) {
    console.error('reports PATCH error:', error)
    return NextResponse.json({ error: '報告履歴の保存に失敗しました' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const denied = await requireSession()
  if (denied) return denied

  const { id } = await params
  const { error } = await getSupabaseServer().from('reports').delete().eq('id', id)
  if (error) {
    console.error('reports DELETE error:', error)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
