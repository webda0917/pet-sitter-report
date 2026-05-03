export type PetType = 'dog' | 'cat'

export interface Pet {
  id: string
  name: string
  type: PetType
  notes?: string
}

export interface Client {
  id: string
  name: string
  pets: Pet[]
}

export interface DogFormFields {
  greeting: string
  weather: string
  walkRoute: string
  excretion: string
  returnCare: string
  otherCare: string
  locking: string
  nextVisit: string
}

export interface CatFormFields {
  greeting: string
  toilet: string
  water: string
  food: string
  treat: string
  behavior: string
  locking: string
  nextVisit: string
}

export const DOG_FIELD_DEFS: { key: keyof DogFormFields; label: string; placeholder: string; required?: boolean }[] = [
  { key: 'greeting', label: '出迎え・挨拶の様子', placeholder: '例：ドアを開けたらすぐに来てくれた、最初は少し警戒していた' },
  { key: 'weather', label: '天気・散歩の準備', placeholder: '例：雨だったのでカッパを着用、晴れで気持ちよさそうだった' },
  { key: 'walkRoute', label: '散歩コース・エピソード', placeholder: '例：いつもの公園コース、他の犬に会ってはしゃいでいた' },
  { key: 'excretion', label: '排泄の状況', placeholder: '例：オシッコ2回・ウンチ1回（普通の硬さ）' },
  { key: 'returnCare', label: '帰宅後のケア（体拭き・ゴハン・お水）', placeholder: '例：体を拭いてゴハンをあげた、よく食べてくれた' },
  { key: 'otherCare', label: 'その他ケア（任意）', placeholder: '例：ブラッシングした、だっこしてあげた' },
  { key: 'locking', label: '施錠・退出', placeholder: '例：窓と玄関を確認して施錠、ケージに入ってもらった' },
  { key: 'nextVisit', label: '次回訪問予定（任意）', placeholder: '例：明日10時ごろ' },
]

export const CAT_FIELD_DEFS: { key: keyof CatFormFields; label: string; placeholder: string; required?: boolean }[] = [
  { key: 'greeting', label: '挨拶・様子', placeholder: '例：ミャオと鳴いて迎えてくれた、ソファの下に隠れていた' },
  { key: 'toilet', label: 'トイレの状況（個数・掃除）', placeholder: '例：オシッコ3回・ウンチ1回、すべて掃除済み' },
  { key: 'water', label: 'お水の状況', placeholder: '例：少し減っていたので交換、そのままで問題なかった' },
  { key: 'food', label: 'ゴハンの状況', placeholder: '例：半分くらい減っていて補充した、全部なくなっていて交換' },
  { key: 'treat', label: 'おやつ（任意）', placeholder: '例：ちゅーるを1本あげた、目をまん丸にして喜んでくれた' },
  { key: 'behavior', label: 'その後の様子', placeholder: '例：机の上でゴロゴロしていた、膝の上に乗ってきた' },
  { key: 'locking', label: '施錠・退出', placeholder: '例：窓と玄関を確認して施錠' },
  { key: 'nextVisit', label: '次回訪問予定（任意）', placeholder: '例：明日10時ごろ' },
]
