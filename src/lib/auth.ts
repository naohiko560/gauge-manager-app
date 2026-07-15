import { createClient } from '@/lib/supabase/server'
import { AuthUser } from '@/types/database'

const SYSTEM_NAME = 'instrument'

export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null

  const email = session.user.email
  if (!email) return null

  // usersテーブルで照合
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single()

  if (!user) return null

  // is_active チェック（最優先）
  if (!user.is_active) return null

  // retirement_date チェック
  if (user.retirement_date) {
    const today = new Date().toISOString().split('T')[0]
    if (today >= user.retirement_date) return null
  }

  // user_roles からロール取得
  const { data: roleRecord } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('system_name', SYSTEM_NAME)
    .single()

  if (!roleRecord) return null

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: roleRecord.role,
  }
}
