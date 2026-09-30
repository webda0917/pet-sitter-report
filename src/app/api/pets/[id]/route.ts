import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'

type Ctx = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { name, type, notes } = (await req.json()) as { name?: string; type?: string; notes?: string }
  if (!name?.trim() || (type !== 'dog' && type !== 'cat')) {
    return NextResponse.json({ error: '入力内容が正しくありません' }, { status: 400 })
  }

  const { error } = await getSupabaseServer().from('pets').update({ name, type, notes: notes ?? '' }).eq('id', params.id)
  if (error) {
    console.error('pets PATCH error:', error)
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { error } = await getSupabaseServer().from('pets').delete().eq('id', params.id)
  if (error) {
    console.error('pets DELETE error:', error)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
