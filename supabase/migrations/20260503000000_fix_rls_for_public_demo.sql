-- ============================================================
-- デモ公開用 RLS 強化
-- 管理系テーブルの書き込みを admin ロールのみに制限する
-- ============================================================

-- ヘルパー関数: admin 判定（user_roles を SECURITY DEFINER で参照し再帰を防ぐ）
CREATE OR REPLACE FUNCTION public.is_instrument_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND system_name = 'instrument'
      AND role = 'admin'
  )
$$;

-- ============================================================
-- measurement_names
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage names" ON public.measurement_names;

CREATE POLICY "Admins can manage names" ON public.measurement_names
  FOR ALL TO authenticated
  USING (public.is_instrument_admin())
  WITH CHECK (public.is_instrument_admin());

-- ============================================================
-- measurement_models
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage models" ON public.measurement_models;

CREATE POLICY "Admins can manage models" ON public.measurement_models
  FOR ALL TO authenticated
  USING (public.is_instrument_admin())
  WITH CHECK (public.is_instrument_admin());

-- ============================================================
-- instruments: SELECT は全認証ユーザー、書き込みは admin のみ
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can insert instruments" ON public.instruments;
DROP POLICY IF EXISTS "Authenticated users can update instruments" ON public.instruments;
DROP POLICY IF EXISTS "Authenticated users can delete instruments" ON public.instruments;

CREATE POLICY "Admins can manage instruments" ON public.instruments
  FOR ALL TO authenticated
  USING (public.is_instrument_admin())
  WITH CHECK (public.is_instrument_admin());

-- ============================================================
-- calibration_records: SELECT は全認証ユーザー、書き込みは admin のみ
-- API は service_role で操作するため RLS を回避するが、
-- クライアント直接アクセスを防ぐために admin 限定にする
-- ============================================================
DROP POLICY IF EXISTS "authenticated users can insert calibration records" ON public.calibration_records;

CREATE POLICY "Admins can manage calibration records" ON public.calibration_records
  FOR ALL TO authenticated
  USING (public.is_instrument_admin())
  WITH CHECK (public.is_instrument_admin());

-- ============================================================
-- locations: SELECT は全認証ユーザー、書き込みは admin のみ
-- ============================================================
DROP POLICY IF EXISTS "admin users can manage locations" ON public.locations;

CREATE POLICY "Admins can manage locations" ON public.locations
  FOR ALL TO authenticated
  USING (public.is_instrument_admin())
  WITH CHECK (public.is_instrument_admin());

-- ============================================================
-- user_roles: 既存の過剰権限ポリシーを修正
-- 書き込みは service_role（API側）のみ。直接操作を禁止。
-- ============================================================
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- SELECT は全認証ユーザーが必要（checkAdmin.ts が user_roles を SELECT する）
-- 書き込みポリシーを設けないことで、user session からの直接書き込みを禁止
-- （API は createAdminClient / service_role で操作するため影響なし）
