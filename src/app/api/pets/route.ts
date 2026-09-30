import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'

export async function POST(req: NextRequest) {
  const { clientId, name, type, notes } = (await req.json()) as { clientId?: string; name?: string; type?: string; notes?: string }
  if (!clientId || !name?.trim() || (type !== 'dog' && type !== 'cat')) {
    return NextResponse.json({ error: '入力内容が正しくありません' }, { status: 400 })
  }

  const { data, error } = await getSupabaseServer()
    .from('pets')
    .insert({ client_id: clientId, name, type, notes: notes ?? '' })
    .select('id, name, type, notes')
    .single()
  if (error) {
    console.error('pets POST error:', error)
    return NextResponse.json({ error: 'ペットの登録に失敗しました' }, { status: 500 })
  }
  return NextResponse.json(data)
}
