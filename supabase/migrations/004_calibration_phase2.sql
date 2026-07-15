-- ============================================================
-- Phase 2: 校正管理機能
-- ============================================================

-- 1. measurement_names に校正周期を追加
ALTER TABLE public.measurement_names
  ADD COLUMN IF NOT EXISTS internal_cycle_months INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS external_cycle_months INTEGER;
-- external_cycle_months = NULL の場合は外部校正なし

-- 2. locations マスタテーブル
CREATE TABLE IF NOT EXISTS public.locations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL UNIQUE,
  location_type TEXT        NOT NULL DEFAULT 'warehouse'
                            CHECK (location_type IN ('warehouse', 'field', 'repair')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 既存の storage_location 値から locations を生成
INSERT INTO public.locations (name, location_type) VALUES
  ('倉庫', 'warehouse'),
  ('修理中', 'repair')
ON CONFLICT (name) DO NOTHING;

-- instruments に location_id を追加（既存 storage_location と併存）
ALTER TABLE public.instruments
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id);

-- 3. calibration_records テーブル
CREATE TABLE IF NOT EXISTS public.calibration_records (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id     UUID        NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  calibration_type  TEXT        NOT NULL CHECK (calibration_type IN ('internal', 'external')),
  calibrated_at     DATE        NOT NULL,
  next_due_at       DATE        NOT NULL,
  vendor            TEXT,
  cert_no           TEXT,
  cert_url          TEXT,
  result            TEXT        NOT NULL DEFAULT 'pass'
                                CHECK (result IN ('pass', 'fail')),
  note              TEXT,
  created_by        UUID        REFERENCES public.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calibration_instrument
  ON public.calibration_records(instrument_id);
CREATE INDEX IF NOT EXISTS idx_calibration_next_due
  ON public.calibration_records(next_due_at);
CREATE INDEX IF NOT EXISTS idx_calibration_instrument_date
  ON public.calibration_records(instrument_id, calibrated_at DESC);

-- 4. Supabase Storage バケット (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'calibration-certs',
  'calibration-certs',
  false,
  10485760,  -- 10MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: 認証済みユーザーのみアップロード・参照可
CREATE POLICY "authenticated users can upload calibration certs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'calibration-certs');

CREATE POLICY "authenticated users can read calibration certs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'calibration-certs');

-- 5. calibration_records の RLS
ALTER TABLE public.calibration_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read calibration records"
  ON public.calibration_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can insert calibration records"
  ON public.calibration_records FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 6. locations の RLS
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read locations"
  ON public.locations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admin users can manage locations"
  ON public.locations FOR ALL
  TO authenticated
  USING (true);
