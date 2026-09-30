import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getVisibleSections } from '@/lib/karteSections'
import type { PetType } from '@/types'

// 手書きの読み取りは報告文の生成より時間がかかる
export const maxDuration = 60

const MAX_IMAGES = 6

const client = new Anthropic()

const SYSTEM_PROMPT = `あなたはペットシッターサービスの事務アシスタントです。
記入済みのヒアリングシートや、お客様宅のメモ・写真の画像を読み取り、「お世話カルテ」のセクションごとに内容を整理してください。

【ルール】
- 画像に書かれている内容だけを書く。書かれていないことを推測で補わない
- 各セクションは「項目名：内容」の形で1項目1行にする。項目名は下のセクション一覧の雛形に合わせる
- 選択式の項目（例：ドライ・缶・手作り）は、丸や印がついている選択肢だけを書く
- チェック（□）がついていない項目、空欄の項目は出力しない。雛形の項目名だけを並べない
- 読めない文字は推測せず「（読み取れず）」と書く。電話番号・暗証番号・住所は特に、1文字でも不確かなら該当箇所を「（読み取れず）」にする
- 雛形にない情報（余白のメモなど）も、内容に合うセクションに「項目名：内容」の形で入れる。合うセクションがなければ「その他要望」に入れる
- ペットが複数いて内容が違う場合は「ポポ：…／モモ：…」のように名前で書き分ける
- 画像から読み取れる内容がないセクションは空文字にする
- 敬語や説明文は不要。スタッフが現場で素早く読める簡潔な書き方にする`

export async function POST(req: NextRequest) {
  try {
    const { images, petTypes } = (await req.json()) as { images?: string[]; petTypes?: PetType[] }

    if (!Array.isArray(images) || images.length === 0 || images.some((i) => typeof i !== 'string')) {
      return NextResponse.json({ error: '写真を選んでください' }, { status: 400 })
    }
    if (images.length > MAX_IMAGES) {
      return NextResponse.json({ error: `写真は1回に${MAX_IMAGES}枚までです` }, { status: 400 })
    }

    const types = (petTypes ?? []).filter((t): t is PetType => t === 'dog' || t === 'cat')
    const sections = getVisibleSections(types.length > 0 ? types : ['dog', 'cat'])

    const sectionGuide = sections
      .map((s) => `■ ${s.key}（${s.label}）\n${s.guide}`)
      .join('\n\n')

    const message = await client.messages.create({
      model: 'claude-sonnet-5-5',
      max_tokens: 16000,
      output_config: {
        effort: 'medium',
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: Object.fromEntries(sections.map((s) => [s.key, { type: 'string', description: s.label }])),
            required: sections.map((s) => s.key),
            additionalProperties: false,
          },
        },
      },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            ...images.map((data) => ({
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data },
            })),
            {
              type: 'text' as const,
              text: `上の画像を読み取り、次のセクションごとに整理してください。\n\n【セクション一覧（キー・名称・項目名の雛形）】\n${sectionGuide}`,
            },
          ],
        },
      ],
    })

    if (message.stop_reason === 'refusal' || message.stop_reason === 'max_tokens') {
      console.error('Karte extract stop_reason:', message.stop_reason)
      return NextResponse.json({ error: '読み取りに失敗しました' }, { status: 500 })
    }

    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
    const parsed = JSON.parse(text) as Record<string, unknown>

    // 定義済みのセクションだけを、空でないものに限って返す
    const karte: Record<string, string> = {}
    for (const s of sections) {
      const v = parsed[s.key]
      if (typeof v === 'string' && v.trim()) karte[s.key] = v.trim()
    }

    return NextResponse.json({ karte })
  } catch (error) {
    console.error('Karte extract API error:', error)
    return NextResponse.json({ error: '読み取りに失敗しました' }, { status: 500 })
  }
}
