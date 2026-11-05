// AI の出力から、お客様に送る報告文だけを取り出す。
// AI が下書きのあとに「補足」や「修正版」を書き足すことがあるため、
// ・ヘッダー（「11/5（木）16:20-17:20」の次の行が「===」）が複数あれば最後のものから使う
// ・締め文より後ろに続く注釈は切り落とす
const HEADER_RE = /^\d{1,2}\/\d{1,2}（.）[^\n]*\n===/gm
const CLOSINGS = ['お知らせくださいませ🙏🏻', '本日もありがとうございました🙏🏻']

export function extractReport(raw: string, hasNextVisit: boolean): string {
  let text = raw.trim()

  const starts = Array.from(text.matchAll(HEADER_RE), (m) => m.index ?? 0)
  if (starts.length > 0) text = text.slice(starts[starts.length - 1])

  // 次回訪問ありなら「本日もありがとうございました🙏🏻」、なしなら「お知らせくださいませ🙏🏻」で終わる
  const closing = hasNextVisit ? CLOSINGS[1] : CLOSINGS[0]
  const end = text.lastIndexOf(closing)
  if (end >= 0) text = text.slice(0, end + closing.length)

  return text.trim()
}
