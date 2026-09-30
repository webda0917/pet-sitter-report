import { NextRequest, NextResponse } from 'next/server'
import { CLIENT_COLUMNS, getSupabaseServer, toClient } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await getSupabaseServer()
    .from('clients')
    .select(CLIENT_COLUMNS)
    .order('created_at', { ascending: true })
  if (error) {
    console.error('clients GET error:', error)
    return NextResponse.json({ error: '顧客の読み込みに失敗しました' }, { status: 500 })
  }
  return NextResponse.json((data ?? []).map((row) => toClient(row as Record<string, unknown>)))
}

export async function POST(req: NextRequest) {
  const { name, furigana, reportExample } = (await req.json()) as { name?: string; furigana?: string; reportExample?: string }
  if (!name?.trim()) return NextResponse.json({ error: 'お客様名を入力してください' }, { status: 400 })

  const { data, error } = await getSupabaseServer()
    .from('clients')
    .insert({ name, furigana: furigana ?? '', report_example: reportExample ?? '' })
    .select(CLIENT_COLUMNS)
    .single()
  if (error) {
    console.error('clients POST error:', error)
    return NextResponse.json({ error: '顧客の登録に失敗しました' }, { status: 500 })
  }
  return NextResponse.json(toClient(data as Record<string, unknown>))
}
