-- =============================================
-- フェーズ1 再構築：在庫管理システム
-- users / user_roles はそのまま保持
-- =============================================

-- 既存テーブルを削除（FK制約の順に）
DROP TABLE IF EXISTS public.stock_transactions CASCADE;
DROP TABLE IF EXISTS public.instruments CASCADE;
DROP TABLE IF EXISTS public.measurement_models CASCADE;
DROP TABLE IF EXISTS public.measurement_names CASCADE;

-- =============================================
-- テーブル定義
-- =============================================

-- 測定器名称マスタ
CREATE TABLE public.measurement_names (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 型式マスタ
CREATE TABLE public.measurement_models (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_id    UUID NOT NULL REFERENCES public.measurement_names(id) ON DELETE CASCADE,
  model      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 測定器台帳
CREATE TABLE public.instruments (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  management_code   TEXT    NOT NULL UNIQUE,
  name_id           UUID    NOT NULL REFERENCES public.measurement_names(id),
  model_id          UUID    REFERENCES public.measurement_models(id),  -- 任意
  maker             TEXT    NOT NULL DEFAULT '',
  serial_number     TEXT    NOT NULL DEFAULT '',
  storage_location  TEXT    NOT NULL DEFAULT '',
  item_type         TEXT    NOT NULL DEFAULT 'new'      CHECK (item_type IN ('new', 'used')),
  stock_quantity    INTEGER NOT NULL DEFAULT 0,
  optimal_quantity  INTEGER NOT NULL DEFAULT 1,
  status            TEXT    NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'repairing', 'disposed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 入出庫記録
CREATE TABLE public.stock_transactions (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id     UUID    NOT NULL REFERENCES public.instruments(id),
  user_id           UUID    NOT NULL REFERENCES public.users(id),
  transaction_type  TEXT    NOT NULL CHECK (transaction_type IN ('in', 'out')),
  quantity          INTEGER NOT NULL CHECK (quantity > 0),
  transacted_at     DATE    NOT NULL DEFAULT CURRENT_DATE,
  note              TEXT    NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- updated_at 自動更新トリガー
-- （update_updated_at 関数は 001 で定義済み）
-- =============================================

CREATE TRIGGER instruments_updated_at
  BEFORE UPDATE ON public.instruments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- RLS（Row Level Security）
-- =============================================

ALTER TABLE public.measurement_names  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instruments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;

-- 読み取り：認証済みユーザー全体
CREATE POLICY "Authenticated users can read" ON public.measurement_names
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Authenticated users can read" ON public.measurement_models
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Authenticated users can read" ON public.instruments
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Authenticated users can read" ON public.stock_transactions
  FOR SELECT TO authenticated USING (TRUE);

-- 書き込み：認証済みユーザー全体（ロール制御はアプリ側）
CREATE POLICY "Authenticated users can manage names" ON public.measurement_names
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can manage models" ON public.measurement_models
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can insert instruments" ON public.instruments
  FOR INSERT TO authenticated WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can update instruments" ON public.instruments
  FOR UPDATE TO authenticated USING (TRUE);

CREATE POLICY "Authenticated users can delete instruments" ON public.instruments
  FOR DELETE TO authenticated USING (TRUE);

CREATE POLICY "Authenticated users can insert transactions" ON public.stock_transactions
  FOR INSERT TO authenticated WITH CHECK (TRUE);
