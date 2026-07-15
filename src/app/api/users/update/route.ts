import { type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/auth'

const SYSTEM_NAME = 'instrument'

export async function POST(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_ENV !== 'development' || process.env.NODE_ENV !== 'development') {
    return Response.json({ error: 'Not Found' }, { status: 404 })
  }

  const user = await getAuthUser()
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, name, email, is_active, hired_date, retirement_date, role } = await request.json()
  if (!userId) {
    return Response.json({ error: 'userId は必須です' }, { status: 400 })
  }

  const admin = createAdminClient()

  // auth.users のメール更新（存在する場合のみ、変更があった場合のみ）
  if (email) {
    const { data: authUser } = await admin.auth.admin.getUserById(userId)
    if (authUser?.user && authUser.user.email !== email) {
      const { error } = await admin.auth.admin.updateUserById(userId, { email })
      if (error) {
        console.error('[users/update] auth.updateUser', error.message)
        return Response.json({ error: 'メールアドレスの更新に失敗しました' }, { status: 500 })
      }
    }
  }

  // public.users 更新
  const { error: userError } = await admin.from('users').update({
    name,
    email,
    is_active,
    hired_date: hired_date || null,
    retirement_date: retirement_date || null,
    updated_at: new Date().toISOString(),
  }).eq('id', userId)
  if (userError) {
    console.error('[users/update] users.update', userError.message)
    return Response.json({ error: 'ユーザー情報の更新に失敗しました' }, { status: 500 })
  }

  // user_roles 更新
  if (role) {
    const { data: existingRole } = await admin
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('system_name', SYSTEM_NAME)
      .single()

    if (existingRole) {
      await admin.from('user_roles').update({ role }).eq('id', existingRole.id)
    } else {
      await admin.from('user_roles').insert({ user_id: userId, system_name: SYSTEM_NAME, role })
    }
  }

  // 更新後のユーザーデータを返す
  const { data: updatedUser } = await admin
    .from('users')
    .select('*, user_roles(id, system_name, role)')
    .eq('id', userId)
    .single()

  return Response.json({ user: updatedUser })
}
