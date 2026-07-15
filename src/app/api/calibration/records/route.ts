import { type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/auth'

// POST: 校正記録を登録
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { instrument_id, calibration_type, calibrated_at, next_due_at, vendor, cert_no, cert_url, result, note } = body

  if (!instrument_id || !calibration_type || !calibrated_at || !next_due_at) {
    return Response.json({ error: '必須項目が不足しています' }, { status: 400 })
  }
  if (!['internal', 'external'].includes(calibration_type)) {
    return Response.json({ error: '校正種別が不正です' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('calibration_records').insert({
    instrument_id,
    calibration_type,
    calibrated_at,
    next_due_at,
    vendor: vendor ?? null,
    cert_no: cert_no ?? null,
    cert_url: cert_url ?? null,
    result: result ?? 'pass',
    note: note ?? null,
    created_by: user.id,
  }).select().single()

  if (error) {
    console.error('[calibration/records]', error.message)
    return Response.json({ error: '校正記録の登録に失敗しました' }, { status: 500 })
  }
  return Response.json({ record: data })
}
