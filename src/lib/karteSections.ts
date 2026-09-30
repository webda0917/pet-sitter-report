import type { PetType } from '@/types'

export interface KarteSection {
  key: string
  label: string
  // 'all' は全員、'dog' / 'cat' はその種類のペットがいるお客様にだけ表示
  species: 'all' | PetType
  // ヒアリングシートの項目名。空欄に挿入する雛形、兼 AI 読み取り時の振り分け基準
  guide: string
}

// ヒアリングシート（犬・猫）の全項目をセクションに分けたもの
export const KARTE_SECTIONS: KarteSection[] = [
  {
    key: 'basic',
    label: '基本情報',
    species: 'all',
    guide: '住所：\nTEL：\n希望プラン（1日の回数）：\nペット（名前・年齢・性別・種類・誕生日）：',
  },
  {
    key: 'housing',
    label: '住居・近隣対応',
    species: 'all',
    guide: '住宅（一軒家／マンション）：\nペット飼育 可／不可：\n名札：\n管理人・近所の方への対応：',
  },
  {
    key: 'health',
    label: '健康・性格',
    species: 'all',
    guide: '食欲：\n元気：\n健康状態・病歴：\n普段の様子：\n遊び方・好きなおもちゃ：\n抱っこ OK／NG：\n癖・注意点：',
  },
  {
    key: 'catDaily',
    label: '普段の様子（猫）',
    species: 'cat',
    guide:
      '寝る場所：\n隠れる場所：\n好きなおもちゃ／嫌いなおもちゃ：\nなでる・抱っこ（触ってよい場所、抱っこの仕方）：\n嫌がるときの反応（ひっかく／隠れる）：\n猫が入ってはいけない場所：\nシッターが入ってはいけない場所：',
  },
  {
    key: 'training',
    label: 'しつけ（犬）',
    species: 'dog',
    guide: 'しつけ する／しない：\nコマンドと言い方（おすわり・お手・アイコンタクト）：',
  },
  {
    key: 'food',
    label: '食事',
    species: 'all',
    guide:
      '種類（ドライ／缶／手作り）：\n量（1日・1回）：\n食べ物の置き場所：\n食器の置き場所：\n水（水道水／浄水／ミネラルウォーター）と場所：\n残飯・食器の片付け：\n残飯の捨て方：\n缶・パッケージの処理：\n洗う場所：\nスポンジ・洗剤：\nおやつ・サプリ（種類／いつ／置き場所）：',
  },
  {
    key: 'toilet',
    label: '排泄',
    species: 'all',
    guide:
      '場所（室内◯カ所／散歩時のみ）：\nトイレ用品（砂／シート）：\n掃除道具と置き場所：\n使用済みの置き場：\n処理方法（トイレに流す／袋→ゴミ箱の場所）：\n散歩時の処理：',
  },
  {
    key: 'walk',
    label: '散歩（犬）',
    species: 'dog',
    guide:
      '散歩時間：\n散歩コース：\n外までの出方（バッグ／抱っこ／リード）：\nリード・首輪の場所：\nバッグの場所と中身：\n洋服（着せる／どれ／帰宅時）：\n帰宅時の足（洗う／拭く、どこで、何で、片付け）：\n雨天時（行く／行かない、レインコート、タオル、片付け）：\n途中の水：\n草を食べる：\n途中のおやつ：\n散歩時の癖・注意点：\n犬が寄ってきた場合：\nよく会うワンちゃん（名前／犬種／飼主）：\n人・こどもが寄ってきた場合：\nよく会う人：',
  },
  {
    key: 'care',
    label: 'ケア・通院',
    species: 'all',
    guide:
      'ブラッシング（する／しない、ブラシの場所、毛の処理）：\n嘔吐：\n動物病院（名前／TEL／獣医師名）：\n診察券の場所・休診日：\n休診時の対応：\n具合が悪い時の対応：\nキャリー（有無／場所）：',
  },
  {
    key: 'room',
    label: '室内',
    species: 'all',
    guide: '換気（開ける場所）：\n空気清浄機：\n冷暖房（設定・温度）：\n照明（点灯場所）：\nカーテン：',
  },
  {
    key: 'key',
    label: '鍵',
    species: 'all',
    guide:
      '鍵（預かる／預からない）：\n施錠のチェック：\nオートロックの暗証番号：\nセキュリティ（有無／解除方法）：\n鍵を預ける方・連絡先：\n返却方法：',
  },
  {
    key: 'contact',
    label: '駐車場・連絡',
    species: 'all',
    guide: '駐車場・駐輪場：\n報告連絡（要／不要、LINE／メール）：\n飼主様連絡先：\n緊急連絡先：',
  },
  {
    key: 'other',
    label: 'その他要望',
    species: 'all',
    guide: 'その他の要望：\nお支払い方法：',
  },
]

// そのお客様に表示するセクション（ペットの種類で出し分け）
export function getVisibleSections(petTypes: PetType[]): KarteSection[] {
  return KARTE_SECTIONS.filter((s) => s.species === 'all' || petTypes.includes(s.species))
}
