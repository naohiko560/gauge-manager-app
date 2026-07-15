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

  const { name, email, password, role, is_active, hired_date, retirement_date } = await request.json()

  if (!name?.trim() || !email?.trim() || !role || !password?.trim()) {
    return Response.json({ error: '氏名・メールアドレス・パスワード・ロールは必須です' }, { status: 400 })
  }

  if (password.length < 6) {
    return Response.json({ error: 'パスワードは6文字以上で入力してください' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: email.trim(),
    password: password.trim(),
    email_confirm: true,
  })
  if (createError) {
    console.error('[users/invite] auth.createUser', createError.message)
    if (createError.message.includes('already registered') || createError.message.includes('already been registered')) {
      return Response.json({ error: 'このメールアドレスはすでに登録されています' }, { status: 400 })
    }
    return Response.json({ error: 'ユーザーの作成に失敗しました' }, { status: 500 })
  }

  const userId = created.user.id

  const { error: userError } = await admin.from('users').insert({
    id: userId,
    name: name.trim(),
    email: email.trim(),
    is_active: is_active ?? true,
    hired_date: hired_date || null,
    retirement_date: retirement_date || null,
  })
  if (userError) {
    console.error('[users/invite] users.insert', userError.message)
    return Response.json({ error: 'ユーザー情報の保存に失敗しました' }, { status: 500 })
  }

  await admin.from('user_roles').insert({ user_id: userId, system_name: SYSTEM_NAME, role })

  const { data: newUser } = await admin
    .from('users')
    .select('*, user_roles(id, system_name, role)')
    .eq('id', userId)
    .single()

  return Response.json({ user: newUser })
}
