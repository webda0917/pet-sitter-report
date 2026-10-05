import { petCallName, type Honorific } from '@/types'

const HONORIFIC_RE = 'ちゃん|くん|君|さん|様'
// 名前のすぐ後にこれが来たら、敬称が抜けていると判断して補う
const AFTER_NAME = new Set(['が', 'は', 'も', 'の', 'を', 'に', 'と', 'へ', 'や', 'で', '、', '。', '！', '!'])
const KATAKANA_OR_KANJI = /[ァ-ヶー\u4e00-\u9fff]/

// AI が敬称を付け替えたり抜かしたりしても、ペット管理で指定した表記に必ず直す
export function fixPetNames(text: string, pets: { name: string; honorific: Honorific }[]): string {
  const named = pets.filter((p) => p.name.trim())
  if (named.length === 0) return text
  // 長い名前から先に照合する（「モモ」と「コモモ」がいても取り違えない）
  const names = Array.from(new Set(named.map((p) => p.name))).sort((a, b) => b.length - a.length)
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})(${HONORIFIC_RE})?`, 'g')
  return text.replace(re, (match, name: string, honorific: string | undefined, offset: number) => {
    // 「スモモ」の中の「モモ」のように、別の単語の一部なら触らない
    const prev = text[offset - 1] ?? ''
    if (KATAKANA_OR_KANJI.test(name[0]) && KATAKANA_OR_KANJI.test(prev)) return match
    const pet = named.find((p) => p.name === name)!
    if (honorific !== undefined) return petCallName(pet)
    if (pet.honorific && AFTER_NAME.has(text[offset + match.length] ?? '')) return petCallName(pet)
    return match
  })
}
