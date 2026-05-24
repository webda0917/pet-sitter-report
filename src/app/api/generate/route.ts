import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

const SYSTEM_PROMPT = `あなたはペットシッターサービスの報告書作成アシスタントです。
スタッフが入力した各項目のメモをもとに、お客様向けのお世話報告文を作成してください。

【作成ルール】
- ヘッダー行：「M/D（曜日）HH:MM-HH:MM」形式を1行目に、次の行に「===」
- 3行目から本文を「本日のお世話の様子です！」で開始
- 敬体（です・ます調）で書く
- ペットの名前には必ず「ちゃん」をつけて呼ぶ（例：「ポポちゃん」「ミミちゃん」）。絶対に呼び捨てにしない
- 絵文字は最小限に控える（🐶🐱🙏🏻のみ可）。ハート系の絵文字（💕❤️🩷など）は絶対に使わない
- 「！」を適度に使い明るい雰囲気を出す
- 自然な文章の流れでつなげる（箇条書きにしない）
- 排泄・食事・ケアなどの具体的な情報は必ず本文に盛り込む
- 施錠・退出の記録がある場合は「しっかりと施錠の上、退出いたしました」などの文を本文に自然に含める
- 次回訪問予定がある場合：
  - 本文の最後（締め文の前）に次回訪問の文を入れる
  - 鍵の返却なし：「次回は○月○日（曜日）○時ごろお伺い予定です。」
  - 鍵の返却あり：「次回は○月○日（曜日）○時ごろ、鍵のお返しもかねてお伺い予定です。」
  - 締め文は「本日もありがとうございました🙏🏻」のみ（「またご依頼ございましたら〜」は書かない）
- 次回訪問予定がない場合：
  - 締め文は「本日もありがとうございました🙏🏻\n\nまたご依頼ございましたらお知らせくださいませ🙏🏻」
- 500〜700文字程度が目安
- 空の項目は省略する`

function formatNextVisit(start: string, end?: string): string {
  const d = new Date(start)
  if (isNaN(d.getTime())) return start
  const days = ['日', '月', '火', '水', '木', '金', '土']
  const mo = d.getMonth() + 1
  const day = d.getDate()
  const wd = days[d.getDay()]
  const h = d.getHours()
  const min = d.getMinutes().toString().padStart(2, '0')
  const timeStr = `${h}:${min}`
  return end ? `${mo}月${day}日（${wd}）${timeStr}〜${end}` : `${mo}月${day}日（${wd}）${timeStr}`
}

export async function POST(req: NextRequest) {
  try {
    const { pets, visitDateTime, fields } = (await req.json()) as {
      pets: { name: string; type: 'dog' | 'cat' }[]
      visitDateTime: string
      fields: Record<string, string>
    }

    const hasDog = pets.some((p) => p.type === 'dog')
    const hasCat = pets.some((p) => p.type === 'cat')
    const petType = hasDog && hasCat ? '犬と猫' : hasDog ? '犬' : '猫'
    const petNames = pets.map((p) => p.name).join('と')

    // 排泄情報（0回でも必ず出力）
    const peeCount = Number(fields.peeCount ?? 0)
    const poopCount = Number(fields.poopCount ?? 0)
    const excretionLines: string[] = []
    const peeStatus = fields.peeStatus ? `（${fields.peeStatus}）` : ''
    excretionLines.push(peeCount > 0 ? `オシッコ: ${peeCount}回${peeStatus}` : 'オシッコ: ありませんでした')
    const poopStatus = fields.poopStatus ? `（${fields.poopStatus}）` : ''
    excretionLines.push(poopCount > 0 ? `ウンチ: ${poopCount}回${poopStatus}` : 'ウンチ: ありませんでした')
    if (fields.soiling === 'true') {
      const place = fields.soilingPlace ? `（場所: ${fields.soilingPlace}）` : ''
      excretionLines.push(`粗相あり${place}`)
    }

    // チェック済みケア項目
    const careItems: string[] = []
    if (fields.chkWaterDog === 'true') careItems.push('お水を飲んだ')
    if (fields.chkToilet === 'true') careItems.push('トイレ掃除済み')
    if (fields.chkWaterCat === 'true') careItems.push('お水を交換')
    if (fields.chkFeedRefill === 'true') careItems.push('ゴハン補充')
    if (fields.chkFeedReplace === 'true') careItems.push('ゴハン交換')
    if (fields.chkBrushing === 'true') careItems.push('ブラッシング済み')
    if (fields.chkPlay === 'true') careItems.push('遊び済み')
    const oyatsuCount = Number(fields.oyatsuCount ?? 0)
    if (oyatsuCount > 0) careItems.push(`おやつ: ${oyatsuCount}個`)

    // 次回訪問
    const hasNextVisit = !!fields.nextStart
    const nextVisitStr = hasNextVisit
      ? formatNextVisit(fields.nextStart, fields.nextEnd || undefined)
      : null

    const lines: string[] = [
      `訪問日時: ${visitDateTime}`,
      `ペット名: ${petNames}`,
      `種別: ${petType}`,
    ]
    lines.push(`【排泄】\n${excretionLines.join('\n')}`)
    if (careItems.length > 0) lines.push(`【ケア】\n${careItems.join('\n')}`)
    if (fields.notes?.trim()) lines.push(`【お世話メモ】\n${fields.notes}`)
    if (fields.locked === 'true') lines.push('施錠・退出: 完了')
    if (fields.keyReturn) lines.push(`鍵の返却: ${fields.keyReturn}`)
    if (nextVisitStr) {
      lines.push(`次回訪問予定: ${nextVisitStr}`)
      lines.push('次回訪問予定: あり（締め文は「本日もありがとうございました🙏🏻」のみにすること）')
    } else {
      lines.push('次回訪問予定: なし')
    }

    const userPrompt = `以下の情報をもとに報告文を作成してください。\n\n${lines.join('\n\n')}`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response type' }, { status: 500 })
    }

    return NextResponse.json({ report: content.text })
  } catch (error) {
    console.error('Generate API error:', error)
    return NextResponse.json({ error: '報告文の生成に失敗しました' }, { status: 500 })
  }
}
