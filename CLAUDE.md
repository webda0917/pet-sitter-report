# ハピフリ 報告書アプリ（pet-sitter-report）

## 概要
ペットシッター事業「ハピフリ」のスタッフ用Webアプリ。iPhoneのホーム画面に追加して使う。

- **報告書作成**：お世話の内容を音声入力 → AIがお客様向けの報告文に整形 → コピーしてLINEで送信
- **顧客・ペット管理**：お客様名・ふりがな・ペット・報告書の参考例文を登録
- **お世話カルテ**：お客様ごとのお世話のやり方・注意事項・鍵の受け渡しなどをスタッフ全員で共有。記入済みヒアリングシートの写真から自動入力できる。各項目に画像を2枚まで添付できる

本番：https://pet-sitter-report.vercel.app （共通パスワードでログイン）

## 使い方フロー
1. パスワードでログイン（端末ごとに30日間有効）
2. 「新しい報告書を作成」→ お客様を検索して選ぶ（名前・ふりがな・ペット名）
3. 必要なら「カルテを見る」でお世話のやり方を確認
4. 訪問日時・基本確認・お世話の様子（音声入力）・退出を入力
5. 「AIで報告文を生成」→ 内容を確認してコピー → LINEに貼り付け

カルテの記入は「顧客・ペット管理」→ 各お客様の「カルテ」から。

## 技術構成
- Next.js 14（App Router）+ TypeScript + Tailwind CSS
- データ：Supabase（`clients`・`pets` テーブル）。ブラウザからは直接つながず、必ず `/api/*` を経由する
- 添付画像：Supabase Storage の非公開バケット `karte-images`。パスは `clients.karte._images` に持つ
- AI：Claude API（`claude-sonnet-5-5`）。報告文は effort low、カルテ読み取りは effort medium
- 配布：GitHub（webda0917/pet-sitter-report、公開リポジトリ）の main に push すると Vercel が自動デプロイ

## ファイル構成
```
pet-sitter-report/
├── CLAUDE.md              このファイル
├── DESIGN.md              カルテ・アクセス制限の設計書
├── hearing-sheets/        ヒアリングシートの雛形（git管理外）
└── src/
    ├── middleware.ts      全ページ・APIのログイン保護
    ├── app/
    │   ├── page.tsx               ホーム・画面の切り替え
    │   ├── login/page.tsx         ログイン画面
    │   ├── diagnostics/page.tsx   専用キーの診断（ログイン後に開く）
    │   └── api/
    │       ├── login/             パスワード確認・クッキー発行
    │       ├── clients/           顧客の取得・登録・更新（カルテ含む）・削除
    │       ├── pets/              ペットの登録・更新・削除
    │       ├── generate/          報告文の生成（AIへの指示文はここ）
    │       ├── karte/extract/     写真からカルテを読み取る
    │       ├── karte/images/      カルテの添付画像（保存・表示・削除）
    │       └── diagnostics/storage/  専用キーの診断
    ├── components/
    │   ├── ReportForm.tsx         報告書フォーム
    │   ├── ReportPreview.tsx      生成結果のプレビュー・コピー
    │   ├── ClientSearch.tsx       顧客の検索・サジェスト
    │   ├── ClientManager.tsx      顧客・ペット管理
    │   └── KarteView.tsx          カルテの表示・編集・写真読み取り
    └── lib/
        ├── storage.ts             ブラウザ側のAPI呼び出し・日時ユーティリティ
        ├── supabaseServer.ts      サーバー専用のSupabase接続
        ├── session.ts             ログインのクッキー署名・検証
        └── karteSections.ts       カルテのセクション定義（ヒアリングシートの項目）
```

## 環境変数（Vercel）
| 名前 | 内容 |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API キー |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase のプロジェクトURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 公開キー（service role 未設定時の予備） |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバー専用キー（Supabase の Secret keys、`sb_secret_`）。画像添付と RLS 有効化後に必須。正しく効いているかは `/diagnostics` で確認 |
| `APP_PASSWORD` | スタッフ共通のパスワード。変えると全端末がログアウトされる |
| `SESSION_SECRET` | クッキー署名用のランダム文字列 |

## 報告文のルール（AIへの指示）
`src/app/api/generate/route.ts` の `SYSTEM_PROMPT` に書く。主なもの：
- ペット名は「ちゃん」付け。ペットの動作に尊敬語を使わない
- 文末に「〜よ！」をつけない
- メモにない出来事を創作しない。メモにある出来事は気持ちを添えて温かく書く

## 注意事項
- このフォルダは iCloud 同期下にあり、ここで `npm run build` すると非常に遅い。検証は同期されない場所にコピーして行う
- リポジトリは公開設定。顧客情報を含むファイルをコミットしない
- データベースの列を増やすときは、Supabase で列を追加してからアプリを公開する（逆だと顧客一覧が読めなくなる）

## よく使うプロンプト例
```
「報告文で〇〇という言い回しをやめたい」
「カルテに〇〇のセクションを追加して」
「スタッフ用パスワードを変えたいので手順を教えて」
```
