# 測定器在庫・校正管理システム 仕様書

このドキュメントを読んだだけで同等のシステムを再構築できることを目的とした仕様書。

---

## 目次

1. [システム概要](#1-システム概要)
2. [技術スタック](#2-技術スタック)
3. [プロジェクト構成](#3-プロジェクト構成)
4. [環境変数](#4-環境変数)
5. [認証・ロール設計](#5-認証ロール設計)
6. [データベーススキーマ](#6-データベーススキーマ)
7. [画面仕様](#7-画面仕様)
8. [API ルート仕様](#8-api-ルート仕様)
9. [共通実装パターン](#9-共通実装パターン)
10. [shadcn/ui の注意点](#10-shadcnui-の注意点)
11. [マイグレーション手順](#11-マイグレーション手順)

---

## 1. システム概要

測定器の在庫管理と校正状況をひとつの Web アプリで管理する社内システム。

### 2 つのアプリを 1 つの UI で提供

ヘッダーのボタンで切り替える 2 つのアプリとして構成する。

| アプリ | 概要 | URLプレフィックス |
|---|---|---|
| 測定器在庫管理 | 入出庫・在庫数・所在の管理 | `/dashboard`, `/inventory`, `/transactions`, `/history` |
| 校正管理 | 校正期限・証書・現場別校正率の管理 | `/calibration/*` |

管理者のみがアクセスできる共通管理画面（マスター・測定器・ユーザー管理）も持つ。

---

## 2. 技術スタック

| 区分 | 採用技術 | 備考 |
|---|---|---|
| フレームワーク | Next.js (App Router) / TypeScript | バージョンは `package.json` 参照 |
| スタイリング | Tailwind CSS | |
| UI コンポーネント | shadcn/ui | **@base-ui/react v4 ベース**。詳細は[§10](#10-shadcnui-の注意点)参照 |
| データフェッチ | SWR | クライアント側のデータ取得はすべて SWR を使用 |
| バックエンド | Supabase | PostgreSQL + Auth + Storage |
| ホスティング | Vercel | |
| アイコン | lucide-react | |

---

## 3. プロジェクト構成

```
src/
├── app/
│   ├── page.tsx                          # ログイン画面（/）
│   ├── forgot-password/page.tsx          # パスワード忘れ
│   ├── reset-password/page.tsx           # パスワード再設定
│   ├── layout.tsx                        # ルートレイアウト
│   ├── (app)/
│   │   ├── layout.tsx                    # 認証済みレイアウト（Header + main エリア）
│   │   ├── dashboard/
│   │   │   ├── page.tsx                  # サーバーコンポーネント（認証チェック）
│   │   │   ├── DashboardClient.tsx       # クライアントコンポーネント
│   │   │   └── loading.tsx
│   │   ├── inventory/
│   │   │   ├── page.tsx
│   │   │   ├── InventoryClient.tsx
│   │   │   ├── loading.tsx
│   │   │   └── [nameId]/[modelId]/
│   │   │       ├── page.tsx
│   │   │       ├── InstrumentDetailClient.tsx
│   │   │       └── [instrumentId]/
│   │   │           ├── page.tsx
│   │   │           └── InstrumentTransactionClient.tsx
│   │   ├── transactions/
│   │   │   ├── page.tsx
│   │   │   └── TransactionClient.tsx
│   │   ├── history/
│   │   │   ├── page.tsx
│   │   │   ├── HistoryClient.tsx
│   │   │   └── loading.tsx
│   │   ├── calibration/
│   │   │   ├── layout.tsx                # 校正管理レイアウト（タブ配置）
│   │   │   ├── page.tsx                  # /calibration → /calibration/dashboard へ redirect
│   │   │   ├── loading.tsx
│   │   │   ├── CalibrationClient.tsx     # タブ切り替えのコンテナ
│   │   │   ├── CalibrationRecordModal.tsx
│   │   │   ├── DashboardTab.tsx          # クライアントから Supabase へ直接クエリ
│   │   │   ├── InstrumentsTab.tsx        # 同上
│   │   │   ├── AllInstrumentsTab.tsx     # 同上
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── instruments/page.tsx
│   │   │   └── all/page.tsx
│   │   ├── instruments/                  # 測定器管理（兼 名称・型式マスター）
│   │   │   ├── page.tsx
│   │   │   └── InstrumentsClient.tsx
│   │   └── users/
│   │       ├── page.tsx
│   │       ├── UsersClient.tsx
│   │       └── loading.tsx
│   └── api/
│       ├── calibration/
│       │   ├── records/route.ts          # POST のみ（admin 必須）
│       │   ├── setup/route.ts
│       │   └── upload/route.ts
│       ├── instruments/
│       │   └── delete/route.ts
│       └── users/
│           ├── invite/route.ts
│           ├── update/route.ts
│           └── delete/route.ts
├── components/
│   ├── layout/
│   │   ├── Header.tsx                    # ヘッダー（アプリ切り替え + ユーザーメニュー）
│   │   └── Sidebar.tsx                   # サイドバー（未使用・参考）
│   └── ui/
│       ├── button.tsx, badge.tsx, table.tsx, input.tsx
│       ├── label.tsx, select.tsx, textarea.tsx, alert.tsx
│       ├── separator.tsx, skeleton.tsx, dialog.tsx
│       ├── card.tsx, tabs.tsx
│       ├── input-group.tsx, combobox.tsx
│       ├── popover.tsx, command.tsx
│       ├── PageTitle.tsx
│       └── SortableHead.tsx              # ソート可能テーブルヘッダー
├── hooks/
│   └── useSortTable.ts                   # テーブルソート用カスタムフック
├── lib/
│   ├── auth.ts                           # getAuthUser() 関数
│   ├── requireAdmin.ts                   # 管理者チェック（サーバーコンポーネント / API 用）
│   ├── checkAdmin.ts                     # 管理者チェック（クライアント用、SWR fetcher 等）
│   ├── AuthContext.tsx                   # クライアント側で AuthUser を共有する Context
│   ├── ratelimit.ts                      # Upstash Redis ベースのレート制限
│   ├── utils.ts
│   └── supabase/
│       ├── client.ts                     # ブラウザ用クライアント
│       ├── server.ts                     # サーバー用クライアント（Cookie ベース）
│       └── admin.ts                      # Admin クライアント（SERVICE_ROLE_KEY 使用）
├── types/
│   └── database.ts                       # 型定義
└── proxy.ts                              # 認証 + レート制限ミドルウェア（後述）
```

> 注: このプロジェクトの Next.js は通常版と異なり、ミドルウェアファイル名は `src/middleware.ts` ではなく **`src/proxy.ts`** で、エクスポート関数名も `proxy`。`AGENTS.md` の警告通り、API・規約とも標準と差があるため `node_modules/next/dist/docs/` を都度参照すること。

`public/robots.txt` でクローラーアクセスを制御（デモ環境向け、`Disallow: /`）。`next.config.ts` には `X-Frame-Options: DENY` / `X-Content-Type-Options: nosniff` / `Referrer-Policy` / `Strict-Transport-Security` のセキュリティヘッダを設定。

---

## 4. 環境変数

`.env.local` に設定する。

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # サーバーサイド専用（公開禁止）

# 環境識別（ヘッダーの色分けに使用）
# "development" の場合はヘッダーが黄色になる
# また、ユーザー作成・更新・削除 API（/api/users/*）と
# ログイン画面の「パスワードを忘れた方」リンクは development 環境でのみ有効
NEXT_PUBLIC_ENV=development

# レート制限（Upstash Redis）。未設定の場合はレート制限がスキップされる
UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

---

## 5. 認証・ロール設計

### ロール種別

| ロール | 権限 |
|---|---|
| `admin`（管理者） | 全画面 + マスター管理 + ユーザー管理 |
| `worker`（作業者） | 在庫確認・入出庫入力・履歴確認のみ |

### 認証フロー（`src/lib/auth.ts`）

`getAuthUser()` はすべてのサーバーコンポーネントから呼び出す。

```
1. Supabase Auth のセッションを取得
2. session.user.email で users テーブルを照合
3. is_active = false → null を返す（最優先）
4. today >= retirement_date → null を返す
5. user_roles テーブルから system_name = 'instrument' のロールを取得
6. ロールレコードがない → null を返す
7. AuthUser { id, name, email, role } を返す
```

### ミドルウェア（`src/proxy.ts`）

このプロジェクトでは標準の `middleware.ts` ではなく `src/proxy.ts` でミドルウェア処理を行う（エクスポート関数名は `proxy`）。

認証ロジック:
- `/` にアクセスしたログイン済みユーザー → `/dashboard` へリダイレクト
- それ以外のパスに未ログインでアクセス → `/` へリダイレクト
- 静的ファイル（`_next/static`, `_next/image`, favicon, 画像）はマッチャーから除外

レート制限ロジック（`src/lib/ratelimit.ts`、Upstash Redis ベース、IP単位）:
- 書き込み API（`/api/instruments/delete`, `/api/calibration/records`, `/api/calibration/setup`, `/api/users/invite`, `/api/users/delete`, `/api/users/update`）: **30 回 / 分**
- ファイルアップロード（`/api/calibration/upload`）: **10 回 / 時間**
- 上限超過時は `429 { error: 'リクエストが多すぎます。…' }` を返却
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` が未設定の環境ではスキップされる

### サーバーコンポーネントでの認証パターン

```typescript
// すべての (app)/* ページの page.tsx で行う
const user = await getAuthUser()
if (!user) redirect('/')
// 管理者専用ページの場合
if (user.role !== 'admin') redirect('/dashboard')
```

### Supabase クライアントの使い分け

| クライアント | ファイル | 用途 |
|---|---|---|
| ブラウザ用 | `src/lib/supabase/client.ts` | クライアントコンポーネント内のデータフェッチ |
| サーバー用 | `src/lib/supabase/server.ts` | サーバーコンポーネント・API ルートのデータ取得 |
| Admin 用 | `src/lib/supabase/admin.ts` | Auth ユーザーの作成・削除など管理操作（SERVICE_ROLE_KEY 必須） |

---

## 6. データベーススキーマ

マイグレーションファイルの適用順序: `001` → `002` → `003` → `004`

### テーブル一覧

#### users（社員マスタ）

```sql
CREATE TABLE public.users (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  email           TEXT        NOT NULL UNIQUE,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  hired_date      DATE,
  retirement_date DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()  -- トリガーで自動更新
);
```

#### user_roles（ロール管理）

```sql
CREATE TABLE public.user_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  system_name TEXT NOT NULL,           -- 固定値 'instrument'
  role        TEXT NOT NULL CHECK (role IN ('admin', 'worker')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- (user_id, system_name) のユニーク制約
CREATE UNIQUE INDEX user_roles_user_system_idx ON public.user_roles(user_id, system_name);
```

#### measurement_names（測定器名称マスタ）

```sql
CREATE TABLE public.measurement_names (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT        NOT NULL UNIQUE,
  internal_cycle_months  INTEGER     NOT NULL DEFAULT 12,  -- 社内校正周期（月）
  external_cycle_months  INTEGER,                          -- 外部校正周期（NULL = 外部校正なし）
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### measurement_models（測定器型式マスタ）

```sql
CREATE TABLE public.measurement_models (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name_id    UUID        NOT NULL REFERENCES public.measurement_names(id) ON DELETE CASCADE,
  model      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### locations（拠点・場所マスタ）

```sql
CREATE TABLE public.locations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL UNIQUE,
  location_type TEXT        NOT NULL DEFAULT 'warehouse'
                            CHECK (location_type IN ('warehouse', 'field', 'repair')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`location_type` の意味:
- `warehouse` ... 倉庫（在庫中）
- `field` ... 現場（稼働中、校正管理の対象）
- `repair` ... 修理中

#### instruments（測定器台帳）

```sql
CREATE TABLE public.instruments (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  management_code  TEXT    NOT NULL UNIQUE,           -- 管理番号（UUID自動生成 or 手動）
  name_id          UUID    NOT NULL REFERENCES public.measurement_names(id),
  model_id         UUID    REFERENCES public.measurement_models(id),  -- NULL 可
  maker            TEXT    NOT NULL DEFAULT '',
  serial_number    TEXT    NOT NULL DEFAULT '',
  storage_location TEXT    NOT NULL DEFAULT '',       -- レガシー。location_id 移行後も残す
  item_type        TEXT    NOT NULL DEFAULT 'new'     CHECK (item_type IN ('new', 'used')),
  stock_quantity   INTEGER NOT NULL DEFAULT 0,
  optimal_quantity INTEGER NOT NULL DEFAULT 1,
  status           TEXT    NOT NULL DEFAULT 'in_stock'
                           CHECK (status IN ('in_stock', 'repairing', 'disposed')),
  location_id      UUID    REFERENCES public.locations(id),  -- Phase 2 で追加
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()  -- トリガーで自動更新
);
```

#### stock_transactions（入出庫履歴）

```sql
CREATE TABLE public.stock_transactions (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id    UUID    NOT NULL REFERENCES public.instruments(id),
  user_id          UUID    NOT NULL REFERENCES public.users(id),
  transaction_type TEXT    NOT NULL CHECK (transaction_type IN ('in', 'out')),
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  transacted_at    DATE    NOT NULL DEFAULT CURRENT_DATE,  -- 取引日（時刻なし）
  note             TEXT    NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### calibration_records（校正履歴）

```sql
CREATE TABLE public.calibration_records (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id    UUID        NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  calibration_type TEXT        NOT NULL CHECK (calibration_type IN ('internal', 'external')),
  calibrated_at    DATE        NOT NULL,
  next_due_at      DATE        NOT NULL,
  vendor           TEXT,                   -- 外部校正時の業者名
  cert_no          TEXT,                   -- 証書番号
  cert_url         TEXT,                   -- Supabase Storage の署名付きURL
  result           TEXT        NOT NULL DEFAULT 'pass' CHECK (result IN ('pass', 'fail')),
  note             TEXT,
  created_by       UUID        REFERENCES public.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_calibration_instrument      ON public.calibration_records(instrument_id);
CREATE INDEX idx_calibration_next_due        ON public.calibration_records(next_due_at);
CREATE INDEX idx_calibration_instrument_date ON public.calibration_records(instrument_id, calibrated_at DESC);
```

### RLS ポリシー方針

最終形（マイグレーション `20260503000000_fix_rls_for_public_demo.sql` 適用後）。デモ環境向けに**書き込みは admin ロールのみ**に統一されている。判定には後述の `is_instrument_admin()` 関数を使用。

| テーブル | SELECT | INSERT / UPDATE / DELETE |
|---|---|---|
| users | 認証ユーザー全体 | admin のみ |
| user_roles | 認証ユーザー全体 | クライアントからは不可（API の service_role 経由のみ） |
| measurement_names | 認証ユーザー全体 | admin のみ |
| measurement_models | 認証ユーザー全体 | admin のみ |
| instruments | 認証ユーザー全体 | admin のみ |
| locations | 認証ユーザー全体 | admin のみ |
| stock_transactions | 認証ユーザー全体 | INSERT のみ認証ユーザー全体（worker による入出庫を許可） |
| calibration_records | 認証ユーザー全体 | admin のみ |

### Supabase Storage

| バケット | 公開 | 上限 | 許可 MIME |
|---|---|---|---|
| `calibration-certs` | 非公開（private） | 10MB | `application/pdf` |

アップロード・参照は認証ユーザーのみ。

### 関数・トリガー

#### `update_updated_at()` トリガー関数

`users` と `instruments` テーブルに設定し、UPDATE 時に `updated_at` を自動更新する。

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### `is_instrument_admin()` ヘルパー関数（RLS 判定用）

`SECURITY DEFINER` で定義。`user_roles` に `system_name = 'instrument' AND role = 'admin'` のレコードがあるかを返す。RLS ポリシーから呼び出される。

#### `reset_demo_data()` 関数

デモ環境のマスター・測定器・校正記録・入出庫履歴を初期状態にリセットする関数。本番環境では使用しない。

---

## 7. 画面仕様

### 共通レイアウト（`src/app/(app)/layout.tsx`）

- `getAuthUser()` で認証チェック。null の場合は `/` へリダイレクト。
- Header コンポーネントを上部に配置し、メインコンテンツを右に展開。
- ユーザー情報（名前・ロール）を Header に渡す。

### Header（`src/components/layout/Header.tsx`）

- 現在のパスが `/calibration/` から始まる場合 → 「校正管理」モード
- それ以外 → 「測定器在庫管理」モード
- **アプリ切り替えボタン**: 現在のアプリとは逆のアプリへ遷移
- **ナビゲーション**: モードによって表示するリンクを切り替え
  - 在庫管理: ダッシュボード / 在庫一覧 / 入出庫 / 履歴
  - 校正管理: ダッシュボード / 測定器別 / 全測定器
- **ユーザーメニュー（管理者のみ）**: 測定器管理 / ユーザー管理 / ログアウト
- **環境色**: `NEXT_PUBLIC_ENV === 'development'` → 黄色、それ以外 → 青

---

### 画面 0: ログイン（`/`）

**対象ロール**: 全ユーザー（未認証）

**機能**:
- メールアドレス + パスワード入力フォーム
- `supabase.auth.signInWithPassword()` で認証
- 成功時: `/dashboard` へリダイレクト
- エラー時: エラーメッセージを画面に表示
- 「パスワードを忘れた方はこちら」リンク（開発環境のみ表示: `NEXT_PUBLIC_ENV === 'development'`）

---

### 画面 1: ダッシュボード（`/dashboard`）

**対象ロール**: admin / worker

**サマリーカード（3枚）**:
| カード | 内容 | 計算方法 |
|---|---|---|
| 在庫中 | status = 'in_stock' の台数 | |
| 修理中 | status = 'repairing' の台数 | |
| 在庫不足 | stock_quantity < optimal_quantity の件数 | 警告色（赤・オレンジ系）で表示 |

**在庫不足リスト**:
- 在庫不足の測定器一覧（管理番号 / 測定器名 / 現在数 / 適正数）
- データソース: `instruments` テーブル（`status != 'disposed'`）+ `measurement_names` JOIN

**データフェッチ**: SWR + Supabase クライアント直接

---

### 画面 2: 在庫一覧（`/inventory`）

**対象ロール**: admin / worker

**フィルタ**:
- 測定器名セレクトボックス（全件 or 特定の名称）

**テーブル**（`name_id + model_id` でグループ化・ソート可能）:

| 列 | 内容 |
|---|---|
| 測定器名 | `measurement_names.name` |
| 型式 | `measurement_models.model` |
| 総数 | グループ内の全個体数 |
| 倉庫 | `location_type = 'warehouse'` の個体数 |
| 現場 | `location_type = 'field'` の個体数 |
| 修理中 | `location_type = 'repair'` の個体数 |
| 適正数 | グループ内の `optimal_quantity`（MAX） |
| 過不足 | 総数 − 適正数（負の場合は警告色） |

**行クリック**: `/inventory/{name_id}/{model_id}` へ遷移

---

### 画面 2-1: 測定器詳細（`/inventory/[nameId]/[modelId]`）

**対象ロール**: admin / worker

**ヘッダー部**:
- 測定器名 / 型式 / 総数
- 「機器を追加」ボタン（全ロール）

**在庫サマリー**: 倉庫 / 現場 / 修理中 / 総数 / 適正数 / 過不足

**個体テーブル**（ソート可能）:
- 所在 / 登録番号 / シリアル No

**行クリック時**: 所在変更モーダルを開く

**所在変更モーダル**:
1. 所在選択: 倉庫 / 現場 / 修理中
2. 現場を選択した場合: `locations` テーブル（`location_type = 'field'`）からプルダウン選択 or 新規作成
3. メモ・日付を入力
4. 送信処理:
   - `stock_transactions` に記録（transaction_type: 'in' or 'out'）
   - `instruments.location_id` と `instruments.storage_location` を更新
   - **現場へ出庫した場合**: `calibration_records` に記録を自動作成（`calibration_type: 'internal'`, `next_due_at` を `calibrated_at + internal_cycle_months` で自動計算）

**廃棄機能**:
- 2段階確認ダイアログ
- `instruments.status` を `'disposed'` に変更

**機器追加モーダル**:
- 登録番号（必須）/ シリアル No（必須）/ 初期所在（倉庫 or 現場）
- 現場の場合: location 指定
- `instruments` に新規 INSERT
- `stock_transactions` に入庫履歴を INSERT
- 現場への直接追加時: `calibration_records` も自動 INSERT

---

### 画面 2-2: 個体詳細（`/inventory/[nameId]/[modelId]/[instrumentId]`）

**対象ロール**: admin / worker

- 対象測定器の情報表示
- グループの集計（倉庫 / 現場 / 総数）
- 入出庫フォーム:
  - 所在（倉庫 / 現場 / その他）
  - 登録番号（編集可）/ シリアル No（編集可）
  - 取引日
  - メモ
- 送信時: `stock_transactions` に INSERT + `instruments` を UPDATE

---

### 画面 3: 入出庫登録（`/transactions`）

**対象ロール**: admin / worker

**入力フロー**:
1. 測定器名を選択
2. 管理番号 / 型式を選択（測定器名でフィルタ）
3. 入庫（IN）/ 出庫（OUT）を選択
4. 数量（1 以上の整数）
5. 日付（デフォルト: 本日）
6. メモ
7. 登録ボタン

**送信処理**:
- `stock_transactions` に INSERT
- `instruments.stock_quantity` を更新（IN: `+quantity`, OUT: `-quantity`）
- 成功時: フォームをリセット

**バリデーション**:
- 測定器必須
- 数量は 1 以上の整数

---

### 画面 4: 履歴一覧（`/history`）

**対象ロール**: admin / worker

**フィルタ**:
- 入出庫種別（全て / 入庫 / 出庫）
- 測定器名（部分一致）
- 担当者（部分一致）
- 日付範囲（開始日 / 終了日）
- フィルタクリアボタン

**テーブル**（ソート可能、最新 500 件）:

| 列 | データソース |
|---|---|
| 日付 | `stock_transactions.transacted_at` |
| 担当者 | `users.name` |
| 測定器名 | `measurement_names.name` |
| 型式 | `measurement_models.model` |
| 管理番号 | `instruments.management_code` |
| 種別 | `transaction_type`（IN = 緑バッジ, OUT = 赤バッジ） |
| 数量 | `quantity` |
| メモ | `note` |

---

### 校正管理（`/calibration/*`）の構成

- `/calibration` にアクセスすると `/calibration/dashboard` へ redirect される（`page.tsx`）
- `layout.tsx` でタブナビゲーションを配置し、`CalibrationClient.tsx` がタブコンテナとして `DashboardTab.tsx` / `InstrumentsTab.tsx` / `AllInstrumentsTab.tsx` を切り替える
- 各タブはサーバー API ではなく、クライアントから Supabase へ直接 SELECT する（RLS で SELECT は全認証ユーザーに許可されているため）

---

### 画面 5: 校正ダッシュボード（`/calibration/dashboard`）

**対象ロール**: admin / worker

**サマリーカード（4枚）**:
| カード | 内容 |
|---|---|
| 現場稼働台数 | `location_type = 'field'` の測定器総数 |
| 校正率 | 校正済 / 稼働台数（%、80% 未満は警告色） |
| 期限切れ | `next_due_at < today` の台数（赤） |
| 期限間近 | 30日以内に期限切れ の台数（黄） |

**現場別校正率テーブル**（ソート可能）:
- 現場名 / 稼働台数 / 校正済 / 期限切れ / 期限間近 / 校正率

**要対応リスト**（期限切れ → 期限間近の順）:
- 管理番号 / 測定器名 / 型式 / 現場 / 前回校正日 / 次回期限 / 残日数 / 種別（社内/外部）
- 行クリック: `CalibrationRecordModal` を開く

**データソース**: `DashboardTab.tsx` 内で SWR + Supabase クライアント直接（`instruments` / `locations` / `calibration_records` を JOIN し、クライアント側で集計）

---

### 画面 6: 測定器別校正状況（`/calibration/instruments`）

**対象ロール**: admin / worker

**稼働中テーブル**（ソート可能）:

| 列 | 内容 |
|---|---|
| 測定器名 | `measurement_names.name` |
| 社内周期 | `internal_cycle_months` ヶ月 |
| 外部周期 | `external_cycle_months` ヶ月（NULL = なし） |
| 現場台数 | `location_type = 'field'` の台数 |
| 校正済 | 有効期限内の台数 |
| 期限切れ | `next_due_at < today` の台数 |
| 期限間近 | 30日以内の台数 |
| 校正率 | 校正済 / 現場台数（バッジで色分け） |

**稼働中でない種別**: バッジリストとして参考表示

**データソース**: `InstrumentsTab.tsx` 内で SWR + Supabase クライアント直接（`measurement_names` ごとに集計）

---

### 画面 7: 全測定器（`/calibration/all`）

**対象ロール**: admin / worker

**テーブル**（現場稼働中全測定器、ソート可能）:

| 列 | 内容 |
|---|---|
| 管理番号 | `instruments.management_code` |
| 測定器名 | `measurement_names.name` |
| 型式 | `measurement_models.model` |
| 現場 | `locations.name` |
| 前回校正日 | 最新 `calibration_records.calibrated_at` |
| 次回期限 | 最新 `calibration_records.next_due_at` |
| 残日数 | `next_due_at - today`（負 = 期限切れ、赤表示） |
| 状態 | バッジ: 期限切れ(赤) / 期限間近(黄) / 正常(緑) / 未校正(グレー) |

**行クリック**: `CalibrationRecordModal` を開く

**データソース**: `AllInstrumentsTab.tsx` 内で SWR + Supabase クライアント直接（現場稼働中の `instruments` と最新 `calibration_records` を取得）

---

### 校正記録登録モーダル（`CalibrationRecordModal`）

複数画面から呼び出される共通モーダル。

**Props**:
- `open`, `onOpenChange`
- `preselectedInstrumentId`, `preselectedName`, `preselectedCode`（任意）
- `onSuccess`

**フォーム**:
- 測定器選択（管理番号 or 測定器名で検索、最大20件表示）
- 校正周期（読み取り専用）
- 校正実施日（日付ピッカー）
- 次回期限（自動計算: `calibratedAt + internal_cycle_months`、読み取り専用）
- 校正結果（pass / fail ラジオ）
- 備考

**送信先**: `POST /api/calibration/records`（admin 必須）
- `calibration_type` は常に `'internal'` 固定
- 非管理者には UI 側で登録ボタンが表示されない（`useIsAdmin()` で制御）

---

### 画面 8: 測定器管理（`/instruments`）

**対象ロール**: admin のみ（`InstrumentsClient.tsx` 内で `useIsAdmin()` を使用して書き込み UI を制御）

旧版にあった独立した「機器マスター（`/master`）」画面は廃止され、測定器名称・型式の追加もこのページに統合された。

**テーブル**（`name_id + model_id` でグループ化、ソート可能）:
- 測定器名 / 型式 / メーカー / 適正数 / 校正周期（ヶ月）

**新規登録ダイアログ**:
| フィールド | 必須 | 備考 |
|---|---|---|
| 測定器名 | ○ | `measurement_names` から選択。新規入力時は同テーブルに自動 INSERT |
| 型式 | ○ | 既存選択（Combobox）or 新規入力。新規の場合は `measurement_models` に自動 INSERT |
| メーカー | - | |
| 適正数 | - | デフォルト: 1 |
| 校正周期 | - | デフォルト: 12ヶ月。`measurement_names.internal_cycle_months` を更新 |

- 管理番号: UUID v4 で自動生成
- 登録時の初期ステータス: `status = 'in_stock'`, `storage_location = '倉庫'`

**編集ダイアログ**:
- グループ内全個体に対してメーカー・適正数を一括更新
- 測定器名・型式は変更不可
- 「廃棄する」ボタン: `status = 'disposed'` に変更

**削除 API**: `POST /api/instruments/delete`（廃棄済みかつ入出庫履歴がない場合のみ）

---

### 画面 9: ユーザー管理（`/users`）

**サーバー側の入口**: `src/app/(app)/users/page.tsx` で `await requireAdmin()` を呼び、非管理者は `/dashboard` にリダイレクト。

**対象ロール**: admin のみ

**テーブル**（ソート可能）:
- 氏名 / メールアドレス / ロール / ステータス / 入社日 / 退職日

**ステータス判定**:
- `is_active = false` → 「無効」（赤バッジ）
- `today >= retirement_date` → 「退職済」（グレーバッジ）
- その他 → 「有効」（緑バッジ）

**新規追加ダイアログ**:
| フィールド | 必須 | 備考 |
|---|---|---|
| 氏名 | ○ | |
| メールアドレス | ○ | |
| 仮パスワード | ○ | 6文字以上 |
| ロール | ○ | admin / worker |
| アカウント状態 | - | デフォルト: 有効 |
| 入社日 | - | |
| 退職日 | - | |

- API: `POST /api/users/invite`
- Supabase Auth に作成（`email_confirm: true` で即有効化）
- `users` テーブルと `user_roles` テーブルにも INSERT

**編集ダイアログ**:
- パスワード以外の全フィールドを編集可能
- API: `POST /api/users/update`

**削除**:
- 入出庫履歴がある場合は削除不可（エラーメッセージ）
- API: `POST /api/users/delete`

---

## 8. API ルート仕様

すべての API ルートはリクエスト冒頭で認証チェックを行う。書き込み系 API には `src/proxy.ts` でレート制限が適用される（§5 参照）。

### 認証チェックパターン

```typescript
// 一般ユーザー向け
const supabase = await createClient()
const { data: { session } } = await supabase.auth.getSession()
if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

// 管理者のみ
const user = await getAuthUser()
if (!user || user.role !== 'admin') {
  return Response.json({ error: 'Forbidden' }, { status: 403 })
}
```

### 校正管理データの取得（GET 系 API は存在しない）

校正ダッシュボード・測定器別校正状況・全測定器リストはいずれも**サーバー API を介さず**、クライアント（`DashboardTab.tsx` / `InstrumentsTab.tsx` / `AllInstrumentsTab.tsx`）から Supabase へ直接 SELECT する。RLS で SELECT は全認証ユーザーに許可されている。

---

### `POST /api/users/invite`

> 開発環境専用（`NEXT_PUBLIC_ENV === 'development'` のときのみ動作。それ以外は 403）。

Supabase Auth にユーザーを作成し、`users` + `user_roles` にも INSERT する。

**リクエストボディ**:
```json
{
  "name": "string（必須）",
  "email": "string（必須）",
  "password": "string（必須、6文字以上）",
  "role": "admin | worker（必須）",
  "is_active": "boolean（任意、デフォルト true）",
  "hired_date": "YYYY-MM-DD（任意）",
  "retirement_date": "YYYY-MM-DD（任意）"
}
```

**処理順序**:
1. `adminClient.auth.admin.createUser()` でAuth ユーザー作成（`email_confirm: true`）
2. `INSERT INTO users` （id は Auth から取得）
3. `INSERT INTO user_roles` （`system_name = 'instrument'`）

**レスポンス**: `{ user: { id, name, email, role } }`

---

### `POST /api/users/update`

> 開発環境専用（`NEXT_PUBLIC_ENV === 'development'` のときのみ動作）。

**リクエストボディ**: `{ userId, name?, email?, is_active?, hired_date?, retirement_date?, role? }`

**処理順序**:
1. メールアドレスが変わる場合: `adminClient.auth.admin.updateUserById()` でAuth 更新
2. `UPDATE users SET ..., updated_at = NOW()`
3. ロールが指定された場合: `user_roles` を UPDATE or INSERT（upsert 相当）

---

### `POST /api/users/delete`

> 開発環境専用（`NEXT_PUBLIC_ENV === 'development'` のときのみ動作）。

**リクエストボディ**: `{ userId }`

**制約**:
- 自分自身は削除不可（リクエストした認証ユーザーのIDと一致する場合）
- `stock_transactions` に履歴がある場合は削除不可

**処理順序**:
1. `COUNT stock_transactions WHERE user_id = ?` でチェック
2. `DELETE FROM users WHERE id = ?`（CASCADE で `user_roles` も削除）
3. `adminClient.auth.admin.deleteUser()`

---

### `POST /api/instruments/delete`

**リクエストボディ**: `{ instrumentId }`

**制約**:
- `status != 'disposed'` かつ `stock_transactions` の履歴がある場合は削除不可
- 先に廃棄ステータスに変更してから再削除する

---

### `POST /api/calibration/records`

校正記録を登録する。**admin 必須**（403 を返す）。

**リクエストボディ**:
```json
{
  "instrument_id": "UUID（必須）",
  "calibration_type": "internal | external（必須）",
  "calibrated_at": "YYYY-MM-DD（必須）",
  "next_due_at": "YYYY-MM-DD（必須）",
  "vendor": "string（任意）",
  "cert_no": "string（任意）",
  "cert_url": "string（任意）",
  "result": "pass | fail（任意、デフォルト pass）",
  "note": "string（任意）"
}
```

- `created_by` は認証ユーザーの ID を自動設定

---

### `POST /api/calibration/setup`

`instruments.storage_location`（文字列）の値をもとに `locations` テーブルを作成し、各測定器の `location_id` を設定するデータ移行 API。

**storage_location → location_type の推定ルール**:
- "倉庫" または "warehouse" → `warehouse`
- "修理中" または "repair" → `repair`
- その他（現場名など）または NULL → `field`

1度だけ実行する初期セットアップ処理。

**GET でセットアップ状況を確認可能**:
```json
{
  "total_instruments": 1000,
  "linked_instruments": 900,
  "unlinked_instruments": 100,
  "needs_setup": true
}
```

---

### `POST /api/calibration/upload`

校正証書 PDF を Supabase Storage にアップロードする。

**入力**: `FormData` の `file` フィールド（PDF のみ、最大 10MB）

**処理**:
1. ファイル名をサニタイズ（英数字・ドット・ハイフンのみ残す）
2. パス: `{userId}/{timestamp}_{sanitized_filename}`
3. `calibration-certs` バケットにアップロード
4. **1 時間**有効の署名付き URL を生成して返す

**レスポンス**: `{ url: "署名付きURL", path: "パス文字列" }`

---

## 9. 共通実装パターン

### ページコンポーネントの構造

サーバーコンポーネント（`page.tsx`）でユーザー情報を取得し、クライアントコンポーネントに渡す。

```typescript
// page.tsx（サーバーコンポーネント）
export default async function Page() {
  const user = await getAuthUser()
  if (!user) redirect('/')
  return <XxxClient user={user} />
}
```

### SWR によるデータフェッチ

クライアントコンポーネントのデータ取得は SWR を使用し、Supabase クライアントを fetcher として使う。

```typescript
const { data, isLoading, mutate } = useSWR('/inventory-list', async () => {
  const supabase = createClient()
  const { data } = await supabase.from('instruments').select('...')
  return data
})
```

### クライアント側の認証情報共有（`AuthContext`）

`(app)/layout.tsx` で `getAuthUser()` の結果を `<AuthProvider>` に流し込み、子コンポーネントは `useAuth()` / `useIsAdmin()` で参照する。

```tsx
// 利用例
const isAdmin = useIsAdmin()
if (!isAdmin) return null  // 書き込みボタンを隠す
```

### ソート可能テーブル

`SortableHead` コンポーネントと `useSortTable` フック（`src/hooks/useSortTable.ts`）を組み合わせる。フックが `sortKey` / `sortDir` の state と切り替えハンドラを返し、`sortRows(rows, sortKey, sortDir, accessors)` でソート済み配列を得る。

### 管理者チェック（API ルート内）

```typescript
import { requireAdmin } from '@/lib/requireAdmin'
// requireAdmin() は非管理者を redirect するためサーバーコンポーネント / ページから呼び出す
const user = await requireAdmin()

// API ルート内では getAuthUser() を直接使うパターンが多い
const user = await getAuthUser()
if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })
```

---

## 10. shadcn/ui の注意点

このプロジェクトの shadcn/ui は **`@base-ui/react` v4 ベース**であり、一般的な Radix UI ベースの shadcn/ui とは挙動が異なる。

### Popover

`asChild` prop は**未対応**。代わりに `render` prop を使用する。

```tsx
// NG
<PopoverTrigger asChild>
  <Button>開く</Button>
</PopoverTrigger>

// OK
<PopoverTrigger render={<Button>開く</Button>} />
```

### Select

`onValueChange` のコールバックは `(value: string | null) => void` 型。`null` が来る可能性があるためラッパー関数で null ガードする。

```typescript
onValueChange={(value) => {
  if (value !== null) setSelected(value)
}}
```

---

## 11. マイグレーション手順

Supabase ダッシュボードの SQL エディタ、または `supabase db push` で適用する。

```
supabase/migrations/
├── 001_initial_schema.sql                          # users, user_roles, measurement_names,
│                                                   # measurement_models, instruments,
│                                                   # stock_transactions, RLS, updated_at トリガー
├── 002_seed_data.sql                               # サンプルデータ（任意）
├── 003_rebuild_phase1.sql                          # instruments / stock_transactions を再構築
│                                                   # （calibration 関連列の除去、transacted_at 追加）
├── 004_calibration_phase2.sql                      # measurement_names に校正周期列追加
│                                                   # locations / calibration_records テーブル作成
│                                                   # instruments に location_id 追加
│                                                   # calibration-certs Storage バケット作成
│                                                   # Phase 2 の RLS 設定
├── 20260430123758_fix_users_rls_policies.sql       # users テーブル RLS の修正
├── 20260430132358_demo_data_setup.sql              # reset_demo_data() 関数 + デモデータ投入
└── 20260503000000_fix_rls_for_public_demo.sql      # is_instrument_admin() 関数追加
                                                    # 全マスター系テーブルの書き込みを admin 限定に統一
```

**初回構築時は `001 → 003 → 004` の順に適用する。002 は任意。** その後の `20260430...` 〜 `20260503...` 以降は RLS 強化・デモ環境向けで、本番環境にも適用してロールベースの書き込み制御を有効化する想定。デモ環境のリセットは `SELECT reset_demo_data();` で行う。

Supabase Auth のユーザーは管理画面または `/api/users/invite` で作成する。Auth ユーザーの UUID と `users.id` を一致させること（invite API が自動で行う）。
