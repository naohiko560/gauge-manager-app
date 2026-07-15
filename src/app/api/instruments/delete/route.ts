import { type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { instrumentId } = await request.json()
  if (!instrumentId) {
    return Response.json({ error: 'instrumentId は必須です' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 対象測定器のステータスを取得
  const { data: instrument } = await admin
    .from('instruments')
    .select('status')
    .eq('id', instrumentId)
    .single()

  // 廃棄済み以外で入出庫履歴がある場合は削除不可
  if (instrument?.status !== 'disposed') {
    const { count } = await admin
      .from('stock_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('instrument_id', instrumentId)

    if (count && count > 0) {
      return Response.json({ error: '入出庫履歴がある測定器は削除できません。先に廃棄済みに変更してください。' }, { status: 400 })
    }
  }

  const { error: err } = await admin.from('instruments').delete().eq('id', instrumentId)
  if (err) {
    console.error('[instruments/delete]', err.message)
    return Response.json({ error: '測定器の削除に失敗しました' }, { status: 500 })
  }

  return Response.json({ success: true })
}
