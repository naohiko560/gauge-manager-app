-- =============================================
-- 測定器在庫管理システム 初期スキーマ
-- =============================================

-- users（社員マスタ）
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  hired_date DATE,
  retirement_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- user_roles（ロール管理）
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  system_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'worker')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX user_roles_user_system_idx ON public.user_roles(user_id, system_name);

-- measurement_names（測定器名称マスタ）
CREATE TABLE public.measurement_names (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- measurement_models（測定器型式マスタ）
CREATE TABLE public.measurement_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_id UUID NOT NULL REFERENCES public.measurement_names(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- instruments（測定器台帳）
CREATE TABLE public.instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  management_code TEXT NOT NULL UNIQUE,
  name_id UUID NOT NULL REFERENCES public.measurement_names(id),
  model_id UUID NOT NULL REFERENCES public.measurement_models(id),
  maker TEXT NOT NULL DEFAULT '',
  serial_number TEXT NOT NULL DEFAULT '',
  measure_range TEXT NOT NULL DEFAULT '',
  accuracy TEXT NOT NULL DEFAULT '',
  purchased_at DATE,
  purchase_price INTEGER,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  optimal_quantity INTEGER NOT NULL DEFAULT 1,
  storage_location TEXT NOT NULL DEFAULT '',
  item_type TEXT NOT NULL DEFAULT 'new' CHECK (item_type IN ('new', 'used')),
  status TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'calibrating', 'repairing', 'disposed')),
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  calibration_cycle INTEGER,
  last_calibrated_at DATE,
  next_calibration_due DATE,
  calibration_vendor TEXT NOT NULL DEFAULT '',
  calibration_cert_no TEXT NOT NULL DEFAULT '',
  calibration_cert_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- stock_transactions（入出庫履歴）
CREATE TABLE public.stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id UUID NOT NULL REFERENCES public.instruments(id),
  user_id UUID NOT NULL REFERENCES public.users(id),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('in', 'out', 'cal_out', 'cal_in', 'rep_out', 'rep_in')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  memo TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- updated_at 自動更新トリガー
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER instruments_updated_at
  BEFORE UPDATE ON public.instruments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- RLS（Row Level Security）
-- =============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーは全テーブルの読み取り可能
CREATE POLICY "Authenticated users can read" ON public.users
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Authenticated users can read" ON public.user_roles
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Authenticated users can read" ON public.measurement_names
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Authenticated users can read" ON public.measurement_models
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Authenticated users can read" ON public.instruments
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Authenticated users can read" ON public.stock_transactions
  FOR SELECT TO authenticated USING (TRUE);

-- 書き込みは認証済みユーザー全体に許可（ロール制御はアプリ側で行う）
CREATE POLICY "Authenticated users can insert" ON public.stock_transactions
  FOR INSERT TO authenticated WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can update instruments" ON public.instruments
  FOR UPDATE TO authenticated USING (TRUE);

CREATE POLICY "Authenticated users can insert instruments" ON public.instruments
  FOR INSERT TO authenticated WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can manage names" ON public.measurement_names
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can manage models" ON public.measurement_models
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Admins can manage users" ON public.users
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
