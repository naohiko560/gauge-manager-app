import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/auth'

// POST: storage_location → locations テーブルへの自動移行
// 既存の instruments.storage_location の値を読み取り、
// locations マスタを作成して location_id を紐付ける
export async function POST() {
  const user = await getAuthUser()
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // 1. 現在の instruments の storage_location 値を収集
  const { data: instruments, error: fetchErr } = await admin
    .from('instruments')
    .select('id, storage_location, location_id')
    .neq('status', 'disposed')

  if (fetchErr) {
    console.error('[calibration/setup] instruments.select', fetchErr.message)
    return Response.json({ error: '測定器データの取得に失敗しました' }, { status: 500 })
  }

  // location_id が未設定の測定器の storage_location を抽出
  const unlinked = (instruments ?? []).filter((i) => !i.location_id)
  const uniqueLocations = [...new Set(unlinked.map((i) => i.storage_location).filter(Boolean))]

  if (uniqueLocations.length === 0) {
    return Response.json({ message: '紐付け済み、または対象測定器なし', linked: 0 })
  }

  // 2. storage_location の文字列から location_type を推定
  function inferType(loc: string): 'warehouse' | 'field' | 'repair' {
    if (loc === '倉庫' || loc === 'warehouse') return 'warehouse'
    if (loc === '修理中' || loc === 'repair' || loc.includes('修理')) return 'repair'
    // "現場" を含む or それ以外の未知値はすべて field 扱い
    return 'field'
  }

  // 3. locations テーブルへ upsert
  const locationRows = uniqueLocations.map((name) => ({
    name,
    location_type: inferType(name),
  }))

  const { error: upsertErr } = await admin
    .from('locations')
    .upsert(locationRows, { onConflict: 'name' })

  if (upsertErr) {
    console.error('[calibration/setup] locations.upsert', upsertErr.message)
    return Response.json({ error: '場所データの保存に失敗しました' }, { status: 500 })
  }

  // 4. 作成された locations の id を取得
  const { data: locRecords } = await admin
    .from('locations')
    .select('id, name')
    .in('name', uniqueLocations)

  const locMap = new Map((locRecords ?? []).map((l) => [l.name, l.id]))

  // 5. 各測定器の location_id を更新
  let linked = 0
  for (const inst of unlinked) {
    const locId = locMap.get(inst.storage_location)
    if (!locId) continue
    const { error: updErr } = await admin
      .from('instruments')
      .update({ location_id: locId })
      .eq('id', inst.id)
    if (!updErr) linked++
  }

  const summary = locationRows.map((l) => ({
    name: l.name,
    type: l.location_type,
    count: unlinked.filter((i) => i.storage_location === l.name).length,
  }))

  return Response.json({
    message: `${linked}台の測定器を locations に紐付けました`,
    linked,
    locations_created: locationRows.length,
    summary,
  })
}

// GET: セットアップ状況の確認
export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { count: total } = await admin
    .from('instruments')
    .select('id', { count: 'exact', head: true })
    .neq('status', 'disposed')

  const { count: linked } = await admin
    .from('instruments')
    .select('id', { count: 'exact', head: true })
    .neq('status', 'disposed')
    .not('location_id', 'is', null)

  const { count: locCount } = await admin
    .from('locations')
    .select('id', { count: 'exact', head: true })

  return Response.json({
    total_instruments: total ?? 0,
    linked_instruments: linked ?? 0,
    unlinked_instruments: (total ?? 0) - (linked ?? 0),
    location_count: locCount ?? 0,
    needs_setup: (total ?? 0) > (linked ?? 0),
  })
}
