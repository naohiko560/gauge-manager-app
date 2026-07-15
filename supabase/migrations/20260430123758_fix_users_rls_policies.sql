-- 既存ポリシーを削除
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can read" ON public.users;

-- 全認証ユーザーが読める
CREATE POLICY "Authenticated users can read"
ON public.users FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 管理者のみがINSERT/UPDATE/DELETEできる
CREATE POLICY "Admins can manage users"
ON public.users FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND system_name = 'instrument'
      AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND system_name = 'instrument'
      AND role = 'admin'
  )
);
