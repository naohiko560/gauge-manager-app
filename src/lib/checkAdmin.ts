import { createClient } from '@/lib/supabase/client'

const SYSTEM_NAME = 'instrument'

export async function checkAdmin(): Promise<boolean> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.email) return false

  const { data: user } = await supabase
    .from('users')
    .select('id, is_active, retirement_date')
    .eq('email', session.user.email)
    .single()

  if (!user || !user.is_active) return false

  if (user.retirement_date) {
    const today = new Date().toISOString().split('T')[0]
    if (today >= user.retirement_date) return false
  }

  const { data: roleRecord } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('system_name', SYSTEM_NAME)
    .single()

  return roleRecord?.role === 'admin'
}
