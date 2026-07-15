-- =============================================
-- サンプルデータ（開発・テスト用）
-- =============================================
-- 注意: Supabase AuthのユーザーUUIDと一致させる必要があります
-- 実際の運用では、Supabase Authでユーザーを作成後、
-- そのUUIDをここに設定してください

-- 測定器名称マスタ
INSERT INTO public.measurement_names (name) VALUES
  ('デジタルマルチメータ'),
  ('クランプメータ'),
  ('絶縁抵抗計'),
  ('接地抵抗計'),
  ('温度計'),
  ('騒音計'),
  ('照度計'),
  ('電力計'),
  ('オシロスコープ');

-- 測定器型式マスタ（名称IDは自動取得）
INSERT INTO public.measurement_models (name_id, model)
SELECT id, 'FLUKE-87V' FROM public.measurement_names WHERE name = 'デジタルマルチメータ';

INSERT INTO public.measurement_models (name_id, model)
SELECT id, 'FLUKE-289' FROM public.measurement_names WHERE name = 'デジタルマルチメータ';

INSERT INTO public.measurement_models (name_id, model)
SELECT id, 'HIOKI-CM4372' FROM public.measurement_names WHERE name = 'クランプメータ';

INSERT INTO public.measurement_models (name_id, model)
SELECT id, 'KYORITSU-3005A' FROM public.measurement_names WHERE name = '絶縁抵抗計';

INSERT INTO public.measurement_models (name_id, model)
SELECT id, 'HIOKI-FT6031-03' FROM public.measurement_names WHERE name = '接地抵抗計';
