import { type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_ENV !== 'development' || process.env.NODE_ENV !== 'development') {
    return Response.json({ error: 'Not Found' }, { status: 404 })
  }

  const user = await getAuthUser()
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await request.json()
  if (!userId) {
    return Response.json({ error: 'userId は必須です' }, { status: 400 })
  }

  // 自分自身は削除不可
  if (userId === user.id) {
    return Response.json({ error: '自分自身は削除できません' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 入出庫履歴があれば削除不可
  const { count } = await admin
    .from('stock_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (count && count > 0) {
    return Response.json({ error: '入出庫履歴があるユーザーは削除できません。無効化をご利用ください。' }, { status: 400 })
  }

  // public.users を削除（user_roles は CASCADE で削除される）
  const { error: dbError } = await admin.from('users').delete().eq('id', userId)
  if (dbError) {
    console.error('[users/delete] users.delete', dbError.message)
    return Response.json({ error: 'ユーザーの削除に失敗しました' }, { status: 500 })
  }

  // auth.users を削除
  const { error: authError } = await admin.auth.admin.deleteUser(userId)
  if (authError) {
    console.error('[users/delete] auth.deleteUser', authError.message)
    return Response.json({ error: '認証情報の削除に失敗しました' }, { status: 500 })
  }

  return Response.json({ success: true })
}
