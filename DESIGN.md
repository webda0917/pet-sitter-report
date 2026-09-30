# お世話カルテ・アクセス制限 設計書

2026-09-30 作成。ハピフリ報告書アプリへの追加機能。

## 目的
各お客様のお世話のやり方・注意事項・鍵の受け渡しなどを、スタッフ全員で共有する。
鍵や在宅に関わる情報を扱うため、先にアクセス制限を入れる。

## 1. アクセス制限（共通パスワード）

- `/login` でパスワードを入力。正しければ署名付きクッキー（`hf_session`、30日）を発行する
- `src/middleware.ts` が全ページ・全APIを保護する。未ログインはページなら `/login` へ、APIなら 401
- クッキーの署名鍵は `SESSION_SECRET` と `APP_PASSWORD` を連結したもの。パスワードを変えると全端末がログアウトされる
- ブラウザから Supabase への直接接続をやめる。データの読み書きはすべて `/api/clients`・`/api/pets` を経由し、サーバーが service role キーで接続する
- Supabase 側は RLS を有効にし、公開キー（anon）からの読み書きをすべて拒否する

### 環境変数（Vercel）
| 名前 | 内容 |
|---|---|
| `APP_PASSWORD` | スタッフ共通のパスワード |
| `SESSION_SECRET` | クッキー署名用のランダム文字列 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase の service role キー（サーバー専用） |

`SUPABASE_SERVICE_ROLE_KEY` が未設定のあいだは公開キーで接続する（移行期間用）。RLS を有効にした後は必須。

## 2. お世話カルテ

- 単位はお客様1件につき1つ。`clients.karte`（jsonb、セクションのキー → 本文）と `clients.karte_updated_at` に保存する
- セクション定義は `src/lib/karteSections.ts`。ヒアリングシート（犬・猫）の全項目を、セクションごとの「項目名の雛形」として持つ
- 犬がいるお客様にだけ「しつけ」「散歩」、猫がいるお客様にだけ「普段の様子（猫）」を表示する
- 画面は `src/components/KarteView.tsx`。顧客管理と報告書作成の両方から全画面で開く
- 表示モードはカード一覧、編集モードはセクションごとの記入欄。空欄には雛形を挿入できる

## 3. 写真からの自動入力

- カルテ画面で写真を選ぶ（1回6枚まで）。ブラウザ側で長辺1600pxのJPEGに縮小して送る
- `/api/karte/extract` が Claude（Sonnet 5.5）に画像を渡し、セクションのキーごとの本文をJSONで受け取る
- 読めない文字は推測させず「（読み取れず）」と書かせる。未記入の項目は出力しない
- 結果は編集モードの下書きに入る。既存の記入があるセクションは上書きせず「【読み取り分】」として追記する
- 保存は人が確認して「保存」を押したときだけ。写真はどこにも保存しない

## データベース変更（Supabase SQL）

```sql
-- カルテの保存場所
alter table clients add column if not exists karte jsonb not null default '{}';
alter table clients add column if not exists karte_updated_at timestamptz;

-- 直接接続の拒否（新しいアプリの公開後に実行）
alter table clients enable row level security;
alter table pets enable row level security;
-- 既存の公開ポリシーがあれば削除する
```

## 公開の順序
1. Vercel に環境変数3つを登録、カルテ用の列を追加
2. アプリを公開し、ログインと各機能を確認
3. RLS を有効にし、公開キーで読めなくなったことを確認

## 対象外（必要になったら追加）
- スタッフごとのアカウント、編集履歴
- 写真の保存・閲覧
- Word / PDF ファイルの直接読み取り
