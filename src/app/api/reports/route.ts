import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer, REPORT_COLUMNS, MAX_REPORT_LENGTH, toReport } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

// 送った報告文の履歴。次回以降の報告文の作成時に、直近の数件を AI に渡す

// お客様ごとの履歴（新しい順）
export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'お客様が指定されていません' }, { status: 400 })

  const { data, error } = await getSupabaseServer()
    .from('reports')
    .select(REPORT_COLUMNS)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) {
    console.error('reports GET error:', error)
    return NextResponse.json({ error: '報告履歴の読み込みに失敗しました' }, { status: 500 })
  }
  return NextResponse.json((data ?? []).map((r) => toReport(r as Record<string, unknown>)))
}

// 「テキストをコピー」を押したときに保存する
export async function POST(req: NextRequest) {
  const { clientId, visitLabel, body } = (await req.json().catch(() => ({}))) as {
    clientId?: string
    visitLabel?: string
    body?: string
  }
  if (!clientId || !body?.trim()) return NextResponse.json({ error: '保存する内容がありません' }, { status: 400 })

  const { data, error } = await getSupabaseServer()
    .from('reports')
    .insert({ client_id: clientId, visit_label: (visitLabel ?? '').slice(0, 100), body: body.trim().slice(0, MAX_REPORT_LENGTH) })
    .select('id')
    .single()
  if (error) {
    console.error('reports POST error:', error)
    return NextResponse.json({ error: '報告履歴の保存に失敗しました' }, { status: 500 })
  }
  return NextResponse.json({ id: data.id })
}
