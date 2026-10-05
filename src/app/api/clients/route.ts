import { NextRequest, NextResponse } from 'next/server'
import { CLIENT_COLUMNS, getSupabaseServer, toClient } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

async function loadClients(columns: string) {
  const { data, error } = await getSupabaseServer().from('clients').select(columns).order('created_at', { ascending: true })
  return { data: (data ?? []) as unknown as Record<string, unknown>[], error }
}

export async function GET() {
  let { data, error } = await loadClients(CLIENT_COLUMNS)
  // 列（pets.honorific など）の追加が済んでいなくても、一覧だけは読めるようにする
  if (error?.code === '42703') {
    console.error('clients GET missing column, retrying without it:', error.message)
    ;({ data, error } = await loadClients(CLIENT_COLUMNS.replace(', honorific', '')))
  }
  if (error) {
    console.error('clients GET error:', error)
    return NextResponse.json({ error: '顧客の読み込みに失敗しました' }, { status: 500 })
  }
  return NextResponse.json(data.map((row) => toClient(row)))
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
