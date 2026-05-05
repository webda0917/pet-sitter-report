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
- 「次回訪問予定」がある場合は本文の最後に次回訪問の文を入れる
  - 鍵の返却がない場合：「次回は○月○日（曜日）○時ごろお伺い予定です。」
  - 鍵の返却がある場合：「次回は○月○日（曜日）○時ごろ、鍵のお返しもかねてお伺い予定です。」
- 締め文は必ず「本日もありがとうございました🙏🏻\n\nまたご依頼ございましたらお知らせくださいませ🙏🏻」
- 500〜700文字程度が目安
- 空の項目は省略する`

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

    const labelMap: Record<string, string> = {
      notes: 'お世話メモ',
      locked: '施錠・退出',
      nextStart: '次回訪問開始日時',
      nextEnd: '次回訪問終了時刻',
      keyReturn: '鍵の返却',
    }

    const fieldLines = Object.entries(fields)
      .filter(([, v]) => v?.trim())
      .map(([k, v]) => `${labelMap[k] ?? k}: ${v}`)
      .join('\n')

    const userPrompt = `以下の情報をもとに報告文を作成してください。

訪問日時: ${visitDateTime}
ペット名: ${petNames}
種別: ${petType}

【お世話内容メモ】
${fieldLines}`

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
