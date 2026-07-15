-- ============================================================
-- デモデータ毎日リセット
-- reset_demo_data() を毎日 04:00 JST（19:00 UTC）に自動実行する
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'reset-demo-data-daily',
  '0 19 * * *',
  $$SELECT public.reset_demo_data()$$
);
