# gauge-manager — 測定器在庫・校正管理システム

測定器の在庫・入出庫・校正を一元管理する社内 Web アプリケーション。

---

## 技術スタック

| 区分 | 技術 |
|---|---|
| フロントエンド | Next.js (App Router) / TypeScript |
| スタイリング | Tailwind CSS / shadcn/ui (@base-ui/react v4 ベース) |
| データフェッチ | SWR |
| バックエンド | Supabase (PostgreSQL + Auth + Storage) |
| ホスティング | Cloudflare Workers (`@opennextjs/cloudflare`) |

---

## 画面構成・機能一覧

### 認証

| 画面 | URL | 機能 |
|---|---|---|
| ログイン | `/` | メール＋パスワード認証（Supabase Auth） |
| パスワード忘れ | `/forgot-password` | リセットメール送信（開発環境のみ表示） |
| パスワード再設定 | `/reset-password` | トークン検証＋新パスワード設定 |

---

### 在庫管理アプリ

#### ダッシュボード `/dashboard`

- 在庫中台数・修理中台数・在庫不足件数をカード表示
- 在庫不足（`stock_quantity < optimal_quantity`）の測定器一覧

#### 在庫一覧 `/inventory`

- 測定器名でフィルタ可能
- `measurement_names × measurement_models` でグループ化して集計表示
- ソート可能列: 測定器名 / 型式 / 総数 / 倉庫 / 現場 / 修理中 / 適正数 / 過不足
- 行クリックで `/inventory/{name_id}/{model_id}` へ遷移（個体一覧）
- さらに個体クリックで `/inventory/{name_id}/{model_id}/{instrument_id}` へ遷移（個体詳細・入出庫履歴）

#### 入出庫登録 `/transactions`

- 測定器名 → 管理番号/型式 の順に選択
- 入庫（IN）/ 出庫（OUT）と数量・日付・メモを入力して登録
- `stock_transactions` に挿入し `instruments.stock_quantity` を更新

#### 履歴一覧 `/history`

- フィルタ: 入出庫種別 / 測定器名（部分一致）/ 担当者（部分一致）/ 日付範囲
- ソート可能列: 日付 / 担当者 / 測定器名 / 型式 / 管理番号 / 種別 / 数量 / メモ
- `stock_transactions` 最新 500 件を JOIN 表示

---

### 校正管理アプリ `/calibration/*`

ヘッダーの「校正管理」ボタンで在庫管理アプリと切り替え。

#### 校正ダッシュボード `/calibration/dashboard`

- サマリーカード: 現場稼働台数 / 校正率(%) / 期限切れ台数 / 期限間近台数（30日以内）
- 現場別校正率テーブル（ソート可能）
- 要対応リスト（期限切れ・期限間近の個体一覧、クリックで校正記録登録モーダル）

#### 測定器別校正状況 `/calibration/instruments`

- 測定器名（`measurement_names`）ごとの校正集計
- ソート可能列: 測定器名 / 社内周期 / 外部周期 / 現場台数 / 校正済 / 期限切れ / 期限間近 / 校正率

#### 全測定器 `/calibration/all`

- 現場稼働中の全測定器個体リスト（ソート可能）
- 列: 管理番号 / 測定器名 / 型式 / 現場 / 前回校正日 / 次回期限 / 残日数 / 状態バッジ
- 行クリックで校正記録登録モーダル

---

### 管理機能（管理者のみ）

#### 機器マスター `/master`

- 左パネル: `measurement_names`（測定器名称）の追加・削除
- 右パネル: `measurement_models`（型式）の追加・削除、名称でフィルタ可能

#### 測定器管理 `/instruments`

- 個体グループ（名称×型式）の一覧表示・新規追加・編集・廃棄（`status='disposed'`）
- 追加時: 型式が未登録の場合は自動作成、管理番号は UUID 自動生成

#### ユーザー管理 `/users`

- ユーザー一覧（ソート可能）: 氏名 / メール / ロール / ステータス / 入社日 / 退職日
- ステータス判定: `is_active=false` → 無効 / `today >= retirement_date` → 退職済 / その他 → 有効
- 新規追加（仮パスワード発行）/ 編集 / 削除

---

## データベーススキーマ

| テーブル | 主な用途 |
|---|---|
| `users` | 社員マスタ（氏名・メール・在籍期間） |
| `user_roles` | マルチシステム対応ロール（system_name='instrument': admin/worker） |
| `measurement_names` | 測定器名称マスタ（校正周期付き） |
| `measurement_models` | 型式マスタ（名称に紐付く） |
| `instruments` | 測定器個体台帳（管理番号・ステータス・在庫数・適正数） |
| `locations` | 拠点マスタ（location_type: warehouse/field/repair） |
| `stock_transactions` | 入出庫履歴（transaction_type: in/out） |
| `calibration_records` | 校正履歴（社内/外部、証書 URL） |

**instruments.status**: `in_stock` / `calibrating` / `repairing` / `disposed`

マイグレーション: `supabase/migrations/`

---

## API ルート

| エンドポイント | 方式 | 用途 |
|---|---|---|
| `/api/calibration/summary` | GET | 校正ダッシュボード集計 |
| `/api/calibration/records` | GET | 測定器別校正状況 |
| `/api/calibration/field-instruments` | GET | 現場稼働中全測定器 |
| `/api/calibration/setup` | POST | 初期セットアップ |
| `/api/calibration/upload` | POST | 校正証書 PDF アップロード（Supabase Storage） |
| `/api/master/delete-name` | POST | 測定器名削除（参照チェック付き） |
| `/api/master/delete-model` | POST | 型式削除（参照チェック付き） |
| `/api/instruments/delete` | POST | 測定器廃棄 |
| `/api/users/invite` | POST | ユーザー招待（Auth ユーザー作成） |
| `/api/users/update` | POST | ユーザー情報更新 |
| `/api/users/delete` | POST | ユーザー削除 |

---

## 注意事項

- shadcn/ui の Popover は `@base-ui/react` 製のため `asChild` 未対応。`render` prop を使用する
- Select の `onValueChange` は `(value: string | null)` 型のためラッパー関数で null ガードが必要
- ヘッダーの環境色: `NEXT_PUBLIC_ENV=development` → 黄色、それ以外 → 青

---

## ローカル開発

```bash
npm install
npm run dev
```

`http://localhost:3000` で起動。環境変数は `.env.local` に Supabase の URL と anon key を設定。

### Dockerで起動する場合

```bash
docker compose up
```

停止する場合:

```bash
docker compose down
```

> 初回またはDockerfileを変更した場合は `docker compose up --build` を実行する。

---

## Cloudflare へのデプロイ

デプロイは **Cloudflare Workers Builds（GitHub 連動）** で自動化している。
ローカルから `wrangler deploy` を直接実行する運用は禁止。

### デプロイフロー

| ブランチ | デプロイ先 | URL | 使う Supabase |
|---|---|---|---|
| `main` | Production | `gauge-manager.<account>.workers.dev`（またはカスタムドメイン） | 本番プロジェクト |
| `dev` / その他 / PR | Preview | 自動生成のプレビュー URL | 開発プロジェクト |

```
git push origin dev   → Preview に自動デプロイ
PR を main にマージ    → Production に自動デプロイ
```

### Cloudflare 側の設定

1. **Workers & Pages → gauge-manager → Settings → Build**
   - GitHub リポジトリ `naohiko560/gauge-manager` を接続
   - Production branch: `main`
   - Build command: `npm run cf:build`
2. **Settings → Variables and Secrets**（環境ごとに登録）
   - Production:
     - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`（本番）
     - Secret: `SUPABASE_SERVICE_ROLE_KEY` / `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`（本番）
   - Preview:
     - 開発用 Supabase の同じキー一式
   - 「Build variables」と「Runtime variables」の両方に `NEXT_PUBLIC_*` を入れる（ビルド時インライン化＋ランタイム参照のため）

### ローカル動作確認

```bash
# Next.js 開発サーバー
npm run dev

# Workers エミュレータで本番に近い動作を確認
npm run preview
```

### Cloudflare バインディングの型生成

```bash
npm run cf-typegen
```
