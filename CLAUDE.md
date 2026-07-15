@AGENTS.md

## プロジェクト概要

測定器の在庫管理と校正状況を管理する社内 Web アプリ（測定器在庫管理 + 校正管理の 2 機能を 1 UI で提供）。

---

## 技術スタック

| 区分 | 採用技術 | 備考 |
|---|---|---|
| フレームワーク | Next.js (App Router) / TypeScript | バージョンは `package.json` 参照 |
| スタイリング | Tailwind CSS | |
| UI コンポーネント | shadcn/ui | **@base-ui/react v4 ベース**（Radix UI ベースと挙動が異なる） |
| データフェッチ | SWR | クライアント側のデータ取得はすべて SWR を使用 |
| バックエンド | Supabase | PostgreSQL + Auth + Storage |
| ホスティング | Cloudflare Workers | `@opennextjs/cloudflare` 経由でデプロイ |
| アイコン | lucide-react | |

---

## コーディングルール

### ファイル構成・命名

- サーバーコンポーネントは `page.tsx`（認証チェックのみ）、クライアントコンポーネントは `XxxClient.tsx` に分離する
- ミドルウェアは `src/middleware.ts`（エクスポート関数名は `middleware`）。Next.js 16 の新規約では `proxy.ts` が推奨だが、Proxy は Node.js runtime 専用で Cloudflare (OpenNext) 非対応のため、Edge runtime を維持する目的で legacy `middleware.ts` を使用している
- Supabase クライアントは用途によって使い分ける:
  - ブラウザ用: `src/lib/supabase/client.ts`
  - サーバー用: `src/lib/supabase/server.ts`
  - Admin 用: `src/lib/supabase/admin.ts`（`SERVICE_ROLE_KEY` 必須、サーバーサイドのみ）

### 認証パターン

すべての `(app)/*` ページの `page.tsx` は必ず認証チェックを行う:

```typescript
const user = await getAuthUser()
if (!user) redirect('/')
// 管理者専用ページの場合
if (user.role !== 'admin') redirect('/dashboard')
```

API ルート内での認証チェック:

```typescript
// 一般ユーザー向け
const { data: { session } } = await supabase.auth.getSession()
if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

// 管理者のみ
const user = await getAuthUser()
if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })
```

### データフェッチ

- クライアントコンポーネントのデータ取得は **SWR + Supabase クライアント直接** を使用する（GET 系の API ルートは作らない）
- 校正管理の各タブ（`DashboardTab.tsx` / `InstrumentsTab.tsx` / `AllInstrumentsTab.tsx`）はクライアントから Supabase へ直接 SELECT する

```typescript
const { data, isLoading, mutate } = useSWR('key', async () => {
  const supabase = createClient()
  const { data } = await supabase.from('instruments').select('...')
  return data
})
```

### shadcn/ui の注意点（@base-ui/react v4 ベース）

**Popover**: `asChild` prop 未対応。`render` prop を使う:

```tsx
// NG
<PopoverTrigger asChild><Button>開く</Button></PopoverTrigger>

// OK
<PopoverTrigger render={<Button>開く</Button>} />
```

**Select**: `onValueChange` のコールバックは `(value: string | null) => void` 型。`null` ガードを必ず行う:

```typescript
onValueChange={(value) => {
  if (value !== null) setSelected(value)
}}
```

### テーブル・ソート

- ソート可能テーブルには `SortableHead` コンポーネントと `useSortTable` フック（`src/hooks/useSortTable.ts`）を使う

### 管理者 UI 制御

クライアント側で管理者のみの UI を制御する場合は `useIsAdmin()` を使用する:

```tsx
const isAdmin = useIsAdmin()
if (!isAdmin) return null
```

### セキュリティ

- `SUPABASE_SERVICE_ROLE_KEY` はサーバーサイドのみで使用し、クライアントには絶対に公開しない
- 書き込み API（`/api/instruments/delete`, `/api/calibration/records` 等）はすべて admin 必須
- `/api/users/*` と `/api/calibration/upload` はレート制限あり（`src/lib/ratelimit.ts`）

### 環境変数

- `NEXT_PUBLIC_ENV === 'development'` のときのみ有効な機能: ユーザー管理 API (`/api/users/*`)、ログイン画面のパスワードリセットリンク

---

## 主要な型・DB スキーマ

型定義は `src/types/database.ts` を参照。主要テーブル:

- `users` — 社員マスタ（`is_active`, `retirement_date` で有効性判定）
- `user_roles` — ロール管理（`system_name = 'instrument'`, `role = 'admin' | 'worker'`）
- `measurement_names` — 測定器名称マスタ（校正周期含む）
- `measurement_models` — 測定器型式マスタ
- `locations` — 拠点マスタ（`location_type: 'warehouse' | 'field' | 'repair'`）
- `instruments` — 測定器台帳
- `stock_transactions` — 入出庫履歴
- `calibration_records` — 校正履歴

RLS: SELECT は全認証ユーザー許可。INSERT/UPDATE/DELETE は基本的に admin のみ（`stock_transactions` の INSERT のみ worker も可）。

---

## 作業ルール
- 大きな変更の前に必ず影響範囲を説明してから実行する
- 既存のコンポーネントを変更する場合は変更前に現状を確認する
- 不明点は実装前に必ず質問する