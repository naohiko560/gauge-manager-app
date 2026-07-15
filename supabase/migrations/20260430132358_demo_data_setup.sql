-- ============================================================
-- デモ環境セットアップ & リセット関数
-- ============================================================

-- 旧ユーザーの削除（IDが揃っていない場合のクリーンアップ）
DELETE FROM public.users WHERE email = 'gauge-manager-prod@prod.com';

-- デモユーザー登録 (auth.users のUUIDを参照して public.users に挿入)
INSERT INTO public.users (id, name, email, is_active)
SELECT id, '管理者 太郎', 'admin@demo.com', true
FROM auth.users WHERE email = 'admin@demo.com'
ON CONFLICT (id) DO UPDATE SET
  name       = EXCLUDED.name,
  email      = EXCLUDED.email,
  is_active  = EXCLUDED.is_active,
  updated_at = NOW();

INSERT INTO public.users (id, name, email, is_active)
SELECT id, '作業者 次郎', 'worker@demo.com', true
FROM auth.users WHERE email = 'worker@demo.com'
ON CONFLICT (id) DO UPDATE SET
  name       = EXCLUDED.name,
  email      = EXCLUDED.email,
  is_active  = EXCLUDED.is_active,
  updated_at = NOW();

-- ロール登録
INSERT INTO public.user_roles (user_id, system_name, role)
SELECT id, 'instrument', 'admin' FROM public.users WHERE email = 'admin@demo.com'
ON CONFLICT (user_id, system_name) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO public.user_roles (user_id, system_name, role)
SELECT id, 'instrument', 'worker' FROM public.users WHERE email = 'worker@demo.com'
ON CONFLICT (user_id, system_name) DO UPDATE SET role = EXCLUDED.role;

-- ============================================================
-- デモデータリセット関数
-- 毎日呼び出すことでデモデータを初期状態に戻す
-- ============================================================
CREATE OR REPLACE FUNCTION reset_demo_data()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  admin_id  UUID;
  worker_id UUID;
BEGIN
  -- ユーザーIDをemailから取得
  SELECT id INTO admin_id  FROM public.users WHERE email = 'admin@demo.com';
  SELECT id INTO worker_id FROM public.users WHERE email = 'worker@demo.com';

  -- 測定器関連データをすべてクリア（ユーザーは対象外）
  DELETE FROM public.calibration_records;
  DELETE FROM public.stock_transactions;
  DELETE FROM public.instruments;
  DELETE FROM public.measurement_models;
  DELETE FROM public.measurement_names;
  DELETE FROM public.locations;

  -- ロケーションマスター
  INSERT INTO public.locations (id, name, location_type) VALUES
    ('c1000000-0000-0000-0000-000000000001', '倉庫A',      'warehouse'),
    ('c1000000-0000-0000-0000-000000000002', '倉庫B',      'warehouse'),
    ('c1000000-0000-0000-0000-000000000003', '現場貸出中', 'field'),
    ('c1000000-0000-0000-0000-000000000004', '修理中',     'repair');

  -- 測定器名称マスター（切削加工現場向け）
  INSERT INTO public.measurement_names (id, name, internal_cycle_months) VALUES
    ('a1000000-0000-0000-0000-000000000001', 'マイクロメータ',   12),
    ('a1000000-0000-0000-0000-000000000002', 'ノギス',           12),
    ('a1000000-0000-0000-0000-000000000003', 'シリンダーゲージ', 12),
    ('a1000000-0000-0000-0000-000000000004', 'ダイヤルゲージ',   12);

  -- 型式マスター
  INSERT INTO public.measurement_models (id, name_id, model) VALUES
    ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'MDC-25MX'),
    ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'MDC-50MX'),
    ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', 'CD-20APX'),
    ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002', 'CD-30APX'),
    ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000003', 'CG-6B'),
    ('b1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000004', '2046S'),
    ('b1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000004', '107-DP');

  -- 測定器台帳（15件）
  INSERT INTO public.instruments (id, management_code, name_id, model_id, maker, serial_number, storage_location, location_id, item_type, stock_quantity, optimal_quantity, status) VALUES
    ('d1000000-0000-0000-0000-000000000001', 'MC-001', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'ミツトヨ', 'SN-2024-001', '倉庫A',      'c1000000-0000-0000-0000-000000000001', 'new',  3, 3, 'in_stock'),
    ('d1000000-0000-0000-0000-000000000002', 'MC-002', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 'ミツトヨ', 'SN-2024-002', '倉庫A',      'c1000000-0000-0000-0000-000000000001', 'new',  2, 2, 'in_stock'),
    ('d1000000-0000-0000-0000-000000000003', 'MC-003', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'ミツトヨ', 'SN-2022-003', '修理中',     'c1000000-0000-0000-0000-000000000004', 'used', 0, 2, 'repairing'),
    ('d1000000-0000-0000-0000-000000000004', 'MC-004', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'ミツトヨ', 'SN-2019-004', '倉庫A',      'c1000000-0000-0000-0000-000000000001', 'used', 0, 1, 'disposed'),
    ('d1000000-0000-0000-0000-000000000005', 'MC-005', 'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003', 'ミツトヨ', 'SN-2024-005', '倉庫A',      'c1000000-0000-0000-0000-000000000001', 'new',  5, 4, 'in_stock'),
    ('d1000000-0000-0000-0000-000000000006', 'MC-006', 'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000004', 'ミツトヨ', 'SN-2024-006', '倉庫B',      'c1000000-0000-0000-0000-000000000002', 'new',  3, 3, 'in_stock'),
    ('d1000000-0000-0000-0000-000000000007', 'MC-007', 'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003', 'ミツトヨ', 'SN-2021-007', '倉庫B',      'c1000000-0000-0000-0000-000000000002', 'used', 1, 2, 'in_stock'),
    ('d1000000-0000-0000-0000-000000000008', 'MC-008', 'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003', 'ミツトヨ', 'SN-2019-008', '倉庫A',      'c1000000-0000-0000-0000-000000000001', 'used', 0, 1, 'disposed'),
    ('d1000000-0000-0000-0000-000000000009', 'MC-009', 'a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000005', 'ミツトヨ', 'SN-2023-009', '倉庫A',      'c1000000-0000-0000-0000-000000000001', 'new',  2, 2, 'in_stock'),
    ('d1000000-0000-0000-0000-000000000010', 'MC-010', 'a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000005', 'ミツトヨ', 'SN-2023-010', '現場貸出中', 'c1000000-0000-0000-0000-000000000003', 'new',  0, 2, 'in_stock'),
    ('d1000000-0000-0000-0000-000000000011', 'MC-011', 'a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000005', 'ミツトヨ', 'SN-2021-011', '修理中',     'c1000000-0000-0000-0000-000000000004', 'used', 0, 1, 'repairing'),
    ('d1000000-0000-0000-0000-000000000012', 'MC-012', 'a1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000006', 'ミツトヨ', 'SN-2024-012', '倉庫A',      'c1000000-0000-0000-0000-000000000001', 'new',  4, 4, 'in_stock'),
    ('d1000000-0000-0000-0000-000000000013', 'MC-013', 'a1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000006', 'ミツトヨ', 'SN-2024-013', '倉庫B',      'c1000000-0000-0000-0000-000000000002', 'new',  3, 3, 'in_stock'),
    ('d1000000-0000-0000-0000-000000000014', 'MC-014', 'a1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000007', 'PEACOCK',  'SN-2023-014', '倉庫A',      'c1000000-0000-0000-0000-000000000001', 'new',  2, 2, 'in_stock'),
    ('d1000000-0000-0000-0000-000000000015', 'MC-015', 'a1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000007', 'PEACOCK',  'SN-2021-015', '倉庫B',      'c1000000-0000-0000-0000-000000000002', 'used', 1, 2, 'in_stock');

  -- 入出庫履歴（直近1ヶ月 10件）
  INSERT INTO public.stock_transactions (instrument_id, user_id, transaction_type, quantity, transacted_at, note) VALUES
    ('d1000000-0000-0000-0000-000000000001', admin_id,  'out', 1, CURRENT_DATE - 25, 'A社現場持出'),
    ('d1000000-0000-0000-0000-000000000001', worker_id, 'in',  1, CURRENT_DATE - 20, 'A社現場返却'),
    ('d1000000-0000-0000-0000-000000000005', worker_id, 'out', 2, CURRENT_DATE - 18, 'B社現場持出'),
    ('d1000000-0000-0000-0000-000000000006', worker_id, 'out', 1, CURRENT_DATE - 15, 'C社現場持出'),
    ('d1000000-0000-0000-0000-000000000012', admin_id,  'out', 2, CURRENT_DATE - 12, 'D社現場持出'),
    ('d1000000-0000-0000-0000-000000000005', worker_id, 'in',  2, CURRENT_DATE - 10, 'B社現場返却'),
    ('d1000000-0000-0000-0000-000000000010', worker_id, 'out', 2, CURRENT_DATE -  8, 'E社現場持出'),
    ('d1000000-0000-0000-0000-000000000012', admin_id,  'in',  1, CURRENT_DATE -  5, 'D社現場返却（1台）'),
    ('d1000000-0000-0000-0000-000000000014', worker_id, 'out', 1, CURRENT_DATE -  3, 'F社現場持出'),
    ('d1000000-0000-0000-0000-000000000002', admin_id,  'in',  1, CURRENT_DATE -  1, '定期棚卸');

  -- 校正記録（CURRENT_DATEからの相対日付で常に適切な分布を維持）
  -- 余裕あり6件・期限が近い3件・期限切れ3件
  INSERT INTO public.calibration_records (instrument_id, calibration_type, calibrated_at, next_due_at, vendor, result, note, created_by) VALUES
    -- 余裕あり（6ヶ月以上先）
    ('d1000000-0000-0000-0000-000000000001', 'internal', CURRENT_DATE - INTERVAL '6 months',  CURRENT_DATE + INTERVAL '6 months',  NULL,                      'pass', NULL,           admin_id),
    ('d1000000-0000-0000-0000-000000000002', 'internal', CURRENT_DATE - INTERVAL '5 months',  CURRENT_DATE + INTERVAL '7 months',  NULL,                      'pass', NULL,           admin_id),
    ('d1000000-0000-0000-0000-000000000005', 'internal', CURRENT_DATE - INTERVAL '4 months',  CURRENT_DATE + INTERVAL '8 months',  NULL,                      'pass', NULL,           admin_id),
    ('d1000000-0000-0000-0000-000000000006', 'internal', CURRENT_DATE - INTERVAL '3 months',  CURRENT_DATE + INTERVAL '9 months',  NULL,                      'pass', NULL,           admin_id),
    ('d1000000-0000-0000-0000-000000000012', 'internal', CURRENT_DATE - INTERVAL '6 months',  CURRENT_DATE + INTERVAL '6 months',  NULL,                      'pass', NULL,           admin_id),
    ('d1000000-0000-0000-0000-000000000013', 'internal', CURRENT_DATE - INTERVAL '5 months',  CURRENT_DATE + INTERVAL '7 months',  NULL,                      'pass', NULL,           admin_id),
    -- 期限が近い（2ヶ月以内）
    ('d1000000-0000-0000-0000-000000000007', 'internal', CURRENT_DATE - INTERVAL '11 months', CURRENT_DATE + INTERVAL '1 month',   NULL,                      'pass', NULL,           admin_id),
    ('d1000000-0000-0000-0000-000000000009', 'internal', CURRENT_DATE - INTERVAL '10 months', CURRENT_DATE + INTERVAL '2 months',  NULL,                      'pass', NULL,           admin_id),
    ('d1000000-0000-0000-0000-000000000014', 'internal', CURRENT_DATE - INTERVAL '11 months', CURRENT_DATE + INTERVAL '1 month',   NULL,                      'pass', NULL,           admin_id),
    -- 期限切れ（要対応）
    ('d1000000-0000-0000-0000-000000000015', 'internal', CURRENT_DATE - INTERVAL '16 months', CURRENT_DATE - INTERVAL '4 months',  NULL,                      'pass', NULL,           admin_id),
    ('d1000000-0000-0000-0000-000000000010', 'internal', CURRENT_DATE - INTERVAL '17 months', CURRENT_DATE - INTERVAL '5 months',  NULL,                      'pass', NULL,           admin_id),
    ('d1000000-0000-0000-0000-000000000001', 'external', CURRENT_DATE - INTERVAL '25 months', CURRENT_DATE - INTERVAL '1 month',   '〇〇計測サービス株式会社', 'pass', '外部校正証明書あり', admin_id);

END;
$$;

-- 初回データ投入
SELECT reset_demo_data();
