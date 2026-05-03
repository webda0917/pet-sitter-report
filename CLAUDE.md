# ペットシッター報告アプリ

## 概要
ストレンジブレイン株式会社のペットシッター事業向け社内Webアプリ。
シッターがお世話内容を音声入力 → AIが報告文に整形 → コピーしてLINE公式アカウントで送信する。

## 使い方フロー
1. 顧客・ペットを選択
2. 訪問日時を入力
3. フォーマットに沿って音声入力でお世話内容を記録
4. AIが丁寧なお客様向け報告文に自動整形
5. タップでコピー → LINEに貼り付けて送信

## 機能要件

### 顧客・ペット管理
- 顧客名（オーナー名）を登録
- ペット名・種類（犬 / 猫）・特記事項を登録
- お世話のたびに選択して呼び出せる

### 報告書作成
- 犬用・猫用のフォーマットテンプレートを切り替え
- 各項目を音声入力（Web Speech API）で入力
- Claude APIで丁寧な報告文に整形
- 生成されたテキストをワンタップでクリップボードにコピー

### 報告フォーマット（犬）
1. 出迎えの様子
2. 天気・準備（雨の場合 カッパ着用など）
3. 散歩コース・エピソード
4. 排泄（オシッコ〇回、ウンチ〇回）
5. 帰宅後：体拭き・ゴハン・水の状況
6. その他ケア（ブラッシング等）
7. ケージ・施錠

### 報告フォーマット（猫）
1. 挨拶の様子
2. トイレ状況（オシッコ〇回・ウンチ〇回）→ 掃除済み
3. 水の状況（交換 / そのまま）
4. ゴハンの減り具合・補充
5. おやつの様子
6. その後の様子
7. 施錠
8. 次回訪問予定（任意）

## 技術スタック
- **フロントエンド**: React + Vite（TypeScript）
- **スタイル**: Tailwind CSS
- **音声入力**: Web Speech API（iOSのSafariで動作）
- **AI整形**: Claude API（claude-haiku-4-5）
- **データ保存**: localStorage（顧客・ペット情報）
- **配布**: Vercelなどにデプロイ、iPhoneのホーム画面に追加（PWA）

## ファイル構成（予定）
```
pet-sitter-report/
├── CLAUDE.md
├── package.json
├── vite.config.ts
├── index.html
├── public/
│   └── manifest.json         # PWA設定
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── api/
    │   └── claude.ts         # Claude API呼び出し
    ├── components/
    │   ├── ClientSelector.tsx # 顧客・ペット選択
    │   ├── ReportForm.tsx     # 報告フォーム（音声入力付き）
    │   ├── ReportPreview.tsx  # 生成された報告文プレビュー
    │   └── ClientManager.tsx  # 顧客・ペット登録管理
    ├── hooks/
    │   └── useSpeechInput.ts  # 音声入力フック
    ├── store/
    │   └── clients.ts         # localStorageとのやり取り
    └── types/
        └── index.ts
```

## 注意事項
- Claude APIキーは環境変数（.env）で管理
- 本番環境ではAPIキーをバックエンドで保持することを推奨
- iOSのSafariはWeb Speech APIに対応（要マイク許可）
