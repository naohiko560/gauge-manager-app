'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Instrument, Location } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { PageTitle } from '@/components/ui/PageTitle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ChevronLeft, Plus, Trash2, CalendarDays, ChevronDown } from 'lucide-react'
import { SortableHead } from '@/components/ui/SortableHead'
import { useSortTable, sortRows } from '@/hooks/useSortTable'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function todayString(): string {
  return new Date().toISOString().split('T')[0]
}

function weekdayLabel(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return WEEKDAYS[d.getDay()]
}

type LocationKey = 'warehouse' | 'field' | 'repair' | 'other'

const LOCATION_LABELS: Record<LocationKey, string> = {
  warehouse: '倉庫',
  field: '現場',
  repair: '修理中',
  other: 'その他',
}

interface GroupCounts {
  total: number
  warehouse: number
  field: number
  repair: number
}

interface Props {
  nameId: string
  modelId: string
}

export function InstrumentDetailClient({ nameId, modelId }: Props) {
  const router = useRouter()
  const realModelId = modelId === 'none' ? null : modelId

  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [groupCounts, setGroupCounts] = useState<GroupCounts>({ total: 0, warehouse: 0, field: 0, repair: 0 })
  const [groupName, setGroupName] = useState('')
  const [groupModel, setGroupModel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState('')
  const [locations, setLocations] = useState<Location[]>([])
  const { sortKey, sortDir, handleSort } = useSortTable('storage_location')

  // 所在変更モーダル
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedInst, setSelectedInst] = useState<Instrument | null>(null)
  const [location, setLocation] = useState<LocationKey>('warehouse')
  const [fieldLocationId, setFieldLocationId] = useState<string>('')
  const [fieldLocationInput, setFieldLocationInput] = useState('')
  const [showFieldList, setShowFieldList] = useState(false)
  const [managementCode, setManagementCode] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [note, setNote] = useState('')
  const [transactedAt, setTransactedAt] = useState(todayString())
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState('')
  const [disposeConfirm, setDisposeConfirm] = useState(false)
  const [disposing, setDisposing] = useState(false)

  // 機器追加モーダル
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addMgmtCode, setAddMgmtCode] = useState('')
  const [addSerialNo, setAddSerialNo] = useState('')
  const [addLocation, setAddLocation] = useState<LocationKey>('warehouse')
  const [addFieldLocationId, setAddFieldLocationId] = useState<string>('')
  const [addFieldLocationInput, setAddFieldLocationInput] = useState('')
  const [showAddFieldList, setShowAddFieldList] = useState(false)
  const [addTransactedAt, setAddTransactedAt] = useState(todayString())
  const [addNote, setAddNote] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')

  const dateInputRef = useRef<HTMLInputElement>(null)
  const addDateInputRef = useRef<HTMLInputElement>(null)

  function countsByLocationType(rows: { location_id: string | null; storage_location: string | null; locations?: unknown }[]): GroupCounts {
    const counts: GroupCounts = { total: rows.length, warehouse: 0, field: 0, repair: 0 }
    for (const g of rows) {
      const locType = (g as any).locations?.location_type as string | undefined
      if (locType === 'warehouse') counts.warehouse++
      else if (locType === 'field') counts.field++
      else if (locType === 'repair') counts.repair++
      else if (g.storage_location === '倉庫') counts.warehouse++
      else if (g.storage_location === '現場') counts.field++
      else if (g.storage_location === '修理中') counts.repair++
    }
    return counts
  }

  async function fetchGroupCounts() {
    const supabase = createClient()
    const { data } = await supabase
      .from('instruments')
      .select('location_id, storage_location, locations(location_type)')
      .eq('name_id', nameId)
      .neq('status', 'disposed')
    if (!data) return
    setGroupCounts(countsByLocationType(data as any))
  }

  useEffect(() => {
    const supabase = createClient()

    const query = supabase
      .from('instruments')
      .select('*, measurement_names(name, internal_cycle_months), measurement_models(model), locations(id, name, location_type)')
      .eq('name_id', nameId)
      .neq('status', 'disposed')
      .order('storage_location')

    const resolved = realModelId
      ? query.eq('model_id', realModelId)
      : query.is('model_id', null)

    Promise.all([
      resolved,
      supabase.auth.getSession(),
      supabase.from('locations').select('*').order('name'),
    ]).then(async ([{ data }, { data: { session } }, { data: locs }]) => {
      const list = data ?? []
      setInstruments(list)
      setLocations(locs ?? [])
      if (list.length > 0) {
        setGroupName((list[0] as any).measurement_names?.name ?? '')
        setGroupModel((list[0] as any).measurement_models?.model ?? null)
      }

      const { data: allInGroup } = await supabase
        .from('instruments')
        .select('location_id, storage_location, locations(location_type)')
        .eq('name_id', nameId)
        .neq('status', 'disposed')
      if (allInGroup) setGroupCounts(countsByLocationType(allInGroup as any))

      if (session?.user?.email) {
        const { data: user } = await supabase
          .from('users')
          .select('id, name')
          .eq('email', session.user.email)
          .single()
        if (user) setCurrentUserId(user.id)
      }
      setLoading(false)
    })
  }, [nameId, modelId])

  function openModal(inst: Instrument) {
    setSelectedInst(inst)
    setManagementCode(inst.management_code ?? '')
    setSerialNumber(inst.serial_number ?? '')
    setNote('')
    setTransactedAt(todayString())
    setModalError('')
    setDisposeConfirm(false)
    if (inst.location_id) {
      const loc = locations.find((l) => l.id === inst.location_id)
      const lt = loc?.location_type
      if (lt === 'field') { setLocation('field'); setFieldLocationId(inst.location_id); setFieldLocationInput(loc?.name ?? '') }
      else if (lt === 'repair') { setLocation('repair'); setFieldLocationId(''); setFieldLocationInput('') }
      else { setLocation('warehouse'); setFieldLocationId(''); setFieldLocationInput('') }
    } else {
      if (inst.storage_location === '現場') { setLocation('field'); setFieldLocationId(''); setFieldLocationInput('') }
      else if (inst.storage_location === '修理中') { setLocation('repair'); setFieldLocationId(''); setFieldLocationInput('') }
      else if (inst.storage_location === 'その他') { setLocation('other'); setFieldLocationId(''); setFieldLocationInput('') }
      else { setLocation('warehouse'); setFieldLocationId(''); setFieldLocationInput('') }
    }
    setModalOpen(true)
  }

  function openAddModal() {
    setAddMgmtCode('')
    setAddSerialNo('')
    setAddLocation('warehouse')
    setAddFieldLocationId('')
    setAddFieldLocationInput('')
    setAddTransactedAt(todayString())
    setAddNote('')
    setAddError('')
    setAddModalOpen(true)
  }

  function resolveLocationUpdate(locKey: LocationKey, fldId: string): { location_id: string | null; storage_location: string } {
    if (locKey === 'field') {
      const loc = locations.find((l) => l.id === fldId)
      return { location_id: fldId || null, storage_location: loc?.name ?? '現場' }
    }
    if (locKey === 'warehouse') {
      const loc = locations.find((l) => l.location_type === 'warehouse')
      return { location_id: loc?.id ?? null, storage_location: '倉庫' }
    }
    if (locKey === 'repair') {
      const loc = locations.find((l) => l.location_type === 'repair')
      return { location_id: loc?.id ?? null, storage_location: '修理中' }
    }
    return { location_id: null, storage_location: LOCATION_LABELS[locKey] }
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedInst) return

    if (location === 'field' && !fieldLocationInput.trim()) { setModalError('現場名を入力してください'); return }

    setSaving(true)
    setModalError('')
    const supabase = createClient()

    let resolvedFieldId = fieldLocationId
    if (location === 'field' && !fieldLocationId && fieldLocationInput.trim()) {
      const { data: newLoc } = await supabase
        .from('locations')
        .insert({ name: fieldLocationInput.trim(), location_type: 'field' })
        .select()
        .single()
      if (newLoc) {
        resolvedFieldId = newLoc.id
        setLocations((prev) => [...prev, newLoc].sort((a, b) => a.name.localeCompare(b.name)))
      }
    }

    const { location_id: resolvedLocId, storage_location: locationLabel } = resolveLocationUpdate(location, resolvedFieldId)
    const transactionType = location === 'warehouse' ? 'in' : 'out'

    const { error: txError } = await supabase.from('stock_transactions').insert({
      instrument_id: selectedInst.id,
      user_id: currentUserId,
      transaction_type: transactionType,
      quantity: 1,
      note,
      transacted_at: transactedAt,
    })
    if (txError) { setModalError('登録に失敗しました: ' + txError.message); setSaving(false); return }

    const { error: instError } = await supabase
      .from('instruments')
      .update({
        storage_location: locationLabel,
        location_id: resolvedLocId,
        management_code: managementCode,
        serial_number: serialNumber,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedInst.id)
    if (instError) { setModalError('測定器情報の更新に失敗しました: ' + instError.message); setSaving(false); return }

    // 現場への出庫時は自動で校正記録を作成
    if (location === 'field') {
      const cycleMonths = (selectedInst as any).measurement_names?.internal_cycle_months ?? 12
      const base = new Date(transactedAt + 'T00:00:00')
      base.setMonth(base.getMonth() + cycleMonths)
      const nextDueAt = base.toISOString().split('T')[0]
      await supabase.from('calibration_records').insert({
        instrument_id: selectedInst.id,
        calibration_type: 'internal',
        calibrated_at: transactedAt,
        next_due_at: nextDueAt,
        result: 'pass',
        created_by: currentUserId,
      })
    }

    const updatedLoc = resolvedLocId ? locations.find((l) => l.id === resolvedLocId) : undefined
    setInstruments((prev) =>
      prev.map((i) =>
        i.id === selectedInst.id
          ? { ...i, storage_location: locationLabel, location_id: resolvedLocId, locations: updatedLoc ?? null } as any
          : i
      )
    )
    await fetchGroupCounts()
    setSaving(false)
    setModalOpen(false)
  }

  async function handleDispose() {
    if (!selectedInst) return
    setDisposing(true)
    setModalError('')
    const supabase = createClient()
    const { error: err } = await supabase
      .from('instruments')
      .update({ status: 'disposed', updated_at: new Date().toISOString() })
      .eq('id', selectedInst.id)
    if (err) { setModalError('廃棄処理に失敗しました: ' + err.message); setDisposing(false); return }
    setInstruments((prev) => prev.filter((i) => i.id !== selectedInst.id))
    await fetchGroupCounts()
    setDisposing(false)
    setModalOpen(false)
  }

  async function handleAddSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!addMgmtCode.trim()) { setAddError('登録番号は必須です'); return }
    if (!addSerialNo.trim()) { setAddError('シリアルNoは必須です'); return }
    if (addLocation === 'field' && !addFieldLocationInput.trim()) { setAddError('現場名を入力してください'); return }
    setAddSaving(true)
    setAddError('')
    const supabase = createClient()

    const existingInst = instruments[0]
    const maker = existingInst?.maker ?? ''
    const optimalQty = existingInst?.optimal_quantity ?? 1

    let resolvedAddFieldId = addFieldLocationId
    if (addLocation === 'field' && !addFieldLocationId && addFieldLocationInput.trim()) {
      const { data: newLoc } = await supabase
        .from('locations')
        .insert({ name: addFieldLocationInput.trim(), location_type: 'field' })
        .select()
        .single()
      if (newLoc) {
        resolvedAddFieldId = newLoc.id
        setLocations((prev) => [...prev, newLoc].sort((a, b) => a.name.localeCompare(b.name)))
      }
    }

    const { location_id: resolvedLocId, storage_location: locationLabel } = resolveLocationUpdate(addLocation, resolvedAddFieldId)
    const transactionType = addLocation === 'warehouse' ? 'in' : 'out'

    const { data: newInst, error: instErr } = await supabase
      .from('instruments')
      .insert({
        name_id: nameId,
        model_id: realModelId,
        maker,
        optimal_quantity: optimalQty,
        management_code: addMgmtCode,
        serial_number: addSerialNo,
        storage_location: locationLabel,
        location_id: resolvedLocId,
        stock_quantity: 0,
        status: 'in_stock',
        updated_at: new Date().toISOString(),
      })
      .select('*, measurement_names(name), measurement_models(model), locations(id, name, location_type)')
      .single()

    if (instErr) { setAddError('追加に失敗しました: ' + instErr.message); setAddSaving(false); return }

    const { error: txErr } = await supabase.from('stock_transactions').insert({
      instrument_id: newInst.id,
      user_id: currentUserId,
      transaction_type: transactionType,
      quantity: 1,
      note: addNote,
      transacted_at: addTransactedAt,
    })
    if (txErr) { setAddError('履歴の記録に失敗しました: ' + txErr.message); setAddSaving(false); return }

    // 現場への追加時は自動で校正記録を作成
    if (addLocation === 'field') {
      const cycleMonths = (newInst as any).measurement_names?.internal_cycle_months ?? 12
      const base = new Date(addTransactedAt + 'T00:00:00')
      base.setMonth(base.getMonth() + cycleMonths)
      const nextDueAt = base.toISOString().split('T')[0]
      await supabase.from('calibration_records').insert({
        instrument_id: newInst.id,
        calibration_type: 'internal',
        calibrated_at: addTransactedAt,
        next_due_at: nextDueAt,
        result: 'pass',
        created_by: currentUserId,
      })
    }

    setInstruments((prev) => [...prev, newInst])
    await fetchGroupCounts()
    setAddSaving(false)
    setAddModalOpen(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => router.push('/inventory')}>
            <ChevronLeft className="w-4 h-4 mr-1" /> 在庫一覧に戻る
          </Button>
          <PageTitle>
            {groupName}
            {groupModel ? `（${groupModel}）` : ''}
          </PageTitle>
          <p className="text-sm text-gray-500 mt-1">全 {instruments.length} 台</p>
        </div>
        <Button size="sm" onClick={openAddModal} className="mt-10">
          <Plus className="w-4 h-4 mr-1" /> 機器を追加
        </Button>
      </div>

      {(() => {
        const optimalQty = instruments[0]?.optimal_quantity ?? 0
        const available = groupCounts.warehouse + groupCounts.repair
        const surplus = available - optimalQty
        return (
          <div className="flex gap-3">
            <div className="rounded-lg border p-3 text-center w-20">
              <p className="text-xs text-gray-500">倉庫</p>
              <p className="font-bold text-2xl">{groupCounts.warehouse}</p>
            </div>
            <div className="rounded-lg border p-3 text-center w-20">
              <p className="text-xs text-gray-500">現場</p>
              <p className="font-bold text-2xl">{groupCounts.field}</p>
            </div>
            <div className="rounded-lg border p-3 text-center w-20">
              <p className="text-xs text-gray-500">修理中</p>
              <p className="font-bold text-2xl">{groupCounts.repair}</p>
            </div>
            <div className="rounded-lg border p-3 text-center w-20">
              <p className="text-xs text-gray-500">総数</p>
              <p className="font-bold text-2xl">{groupCounts.total}</p>
            </div>
            <div className="w-6" />
            <div className="rounded-lg border p-3 text-center w-20">
              <p className="text-xs text-gray-500">適正数</p>
              <p className="font-bold text-2xl text-gray-500">{optimalQty}</p>
            </div>
            <div className="rounded-lg border p-3 text-center w-20">
              <p className="text-xs text-gray-500">過不足</p>
              <p className={`font-bold text-2xl ${surplus < 0 ? 'text-red-600' : surplus > 0 ? 'text-green-600' : ''}`}>
                {surplus >= 0 ? `+${surplus}` : surplus}
              </p>
            </div>
          </div>
        )
      })()}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead sortKey="location" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>所在</SortableHead>
                <SortableHead sortKey="management_code" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>登録番号</SortableHead>
                <SortableHead sortKey="serial_number" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>シリアルNo</SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instruments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                    該当する測定器がありません
                  </TableCell>
                </TableRow>
              ) : (
                sortRows(instruments, sortKey, sortDir, (inst, key) =>
                  key === 'location' ? ((inst as any).locations?.name || inst.storage_location || '') : (inst as any)[key]
                ).map((inst) => (
                  <TableRow
                    key={inst.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => openModal(inst)}
                  >
                    <TableCell className="font-medium">
                      {(inst as any).locations?.name || inst.storage_location || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{inst.management_code || '-'}</TableCell>
                    <TableCell className="text-sm text-gray-600">{inst.serial_number || '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 所在変更モーダル */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>所在を変更</DialogTitle>
          </DialogHeader>
          {modalError && (
            <Alert variant="destructive">
              <AlertDescription>{modalError}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label>所在 <span className="text-red-500">*</span></Label>
              <Select value={location} onValueChange={(v) => { setLocation(v as LocationKey); setFieldLocationId(''); setFieldLocationInput(''); setShowFieldList(false) }}>
                <SelectTrigger>
                  <SelectValue>{LOCATION_LABELS[location]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warehouse">倉庫</SelectItem>
                  <SelectItem value="field">現場</SelectItem>
                  <SelectItem value="repair">修理中</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {location === 'field' && (
              <div className="space-y-1">
                <Label>現場名 <span className="text-red-500">*</span></Label>
                <div className="relative w-1/2">
                  <Input
                    placeholder="現場名を入力..."
                    value={fieldLocationInput}
                    onChange={(e) => { setFieldLocationInput(e.target.value); setFieldLocationId(''); setShowFieldList(false) }}
                    className="pr-8"
                  />
                  <button
                    type="button"
                    className="absolute right-0 top-0 h-full px-2 flex items-center text-muted-foreground hover:text-foreground"
                    onClick={() => setShowFieldList((v) => !v)}
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${showFieldList ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                {(showFieldList || (!fieldLocationId && fieldLocationInput)) && (() => {
                  const filtered = showFieldList
                    ? locations.filter((l) => l.location_type === 'field')
                    : locations.filter((l) => l.location_type === 'field' && l.name.toLowerCase().includes(fieldLocationInput.toLowerCase()))
                  return (
                    <div className="max-h-36 overflow-y-auto rounded-md border bg-popover text-sm shadow-md">
                      {filtered.map((l) => (
                        <button key={l.id} type="button" className="w-full px-3 py-1.5 text-left hover:bg-accent"
                          onClick={() => { setFieldLocationId(l.id); setFieldLocationInput(l.name); setShowFieldList(false) }}>
                          {l.name}
                        </button>
                      ))}
                      {filtered.length === 0 && showFieldList && (
                        <p className="px-3 py-1.5 text-muted-foreground">登録済みの現場がありません</p>
                      )}
                      {filtered.length === 0 && !showFieldList && (
                        <p className="px-3 py-1.5 text-muted-foreground">新規登録: 「{fieldLocationInput}」</p>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}
            <div className="space-y-1">
              <Label>登録番号</Label>
              <Input value={managementCode} readOnly className="bg-gray-50 text-gray-500" />
            </div>
            <div className="space-y-1">
              <Label>シリアルNo</Label>
              <Input value={serialNumber} readOnly className="bg-gray-50 text-gray-500" />
            </div>
            <div className="space-y-1">
              <Label>日付 <span className="text-red-500">*</span></Label>
              <div className="relative w-52">
                <Input
                  readOnly
                  value={transactedAt ? `${transactedAt.replace(/-/g, '/')}（${weekdayLabel(transactedAt)}）` : ''}
                  className="cursor-pointer pr-8"
                  placeholder="日付を選択"
                  onClick={() => dateInputRef.current?.showPicker()}
                />
                <CalendarDays className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  ref={dateInputRef}
                  type="date"
                  value={transactedAt}
                  onChange={(e) => setTransactedAt(e.target.value)}
                  className="sr-only"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>メモ</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="備考があれば入力"
                rows={2}
              />
            </div>
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? '登録中...' : '登録する'}
            </Button>
          </form>

          <div className="border-t pt-4 mt-2">
            {disposeConfirm ? (
              <div className="space-y-2">
                <p className="text-sm text-red-600">本当に廃棄しますか？</p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={handleDispose}
                    disabled={disposing}
                  >
                    {disposing ? '処理中...' : '廃棄する'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDisposeConfirm(false)}>
                    キャンセル
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-700 hover:bg-red-50 w-full"
                onClick={() => setDisposeConfirm(true)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                この機器を廃棄する
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 機器追加モーダル */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>機器を追加</DialogTitle>
          </DialogHeader>
          {addError && (
            <Alert variant="destructive">
              <AlertDescription>{addError}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleAddSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label>初期所在 <span className="text-red-500">*</span></Label>
              <Select value={addLocation} onValueChange={(v) => { setAddLocation(v as LocationKey); setAddFieldLocationId(''); setAddFieldLocationInput(''); setShowAddFieldList(false) }}>
                <SelectTrigger>
                  <SelectValue>{LOCATION_LABELS[addLocation]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warehouse">倉庫</SelectItem>
                  <SelectItem value="field">現場</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {addLocation === 'field' && (
              <div className="space-y-1">
                <Label>現場名 <span className="text-red-500">*</span></Label>
                <div className="relative w-1/2">
                  <Input
                    placeholder="現場名を入力..."
                    value={addFieldLocationInput}
                    onChange={(e) => { setAddFieldLocationInput(e.target.value); setAddFieldLocationId(''); setShowAddFieldList(false) }}
                    className="pr-8"
                  />
                  <button
                    type="button"
                    className="absolute right-0 top-0 h-full px-2 flex items-center text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAddFieldList((v) => !v)}
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${showAddFieldList ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                {(showAddFieldList || (!addFieldLocationId && addFieldLocationInput)) && (() => {
                  const filtered = showAddFieldList
                    ? locations.filter((l) => l.location_type === 'field')
                    : locations.filter((l) => l.location_type === 'field' && l.name.toLowerCase().includes(addFieldLocationInput.toLowerCase()))
                  return (
                    <div className="max-h-36 overflow-y-auto rounded-md border bg-popover text-sm shadow-md">
                      {filtered.map((l) => (
                        <button key={l.id} type="button" className="w-full px-3 py-1.5 text-left hover:bg-accent"
                          onClick={() => { setAddFieldLocationId(l.id); setAddFieldLocationInput(l.name); setShowAddFieldList(false) }}>
                          {l.name}
                        </button>
                      ))}
                      {filtered.length === 0 && showAddFieldList && (
                        <p className="px-3 py-1.5 text-muted-foreground">登録済みの現場がありません</p>
                      )}
                      {filtered.length === 0 && !showAddFieldList && (
                        <p className="px-3 py-1.5 text-muted-foreground">新規登録: 「{addFieldLocationInput}」</p>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}
            <div className="space-y-1">
              <Label>登録番号 <span className="text-red-500">*</span></Label>
              <Input
                value={addMgmtCode}
                onChange={(e) => setAddMgmtCode(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>シリアルNo <span className="text-red-500">*</span></Label>
              <Input value={addSerialNo} onChange={(e) => setAddSerialNo(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>日付 <span className="text-red-500">*</span></Label>
              <div className="relative w-52">
                <Input
                  readOnly
                  value={addTransactedAt ? `${addTransactedAt.replace(/-/g, '/')}（${weekdayLabel(addTransactedAt)}）` : ''}
                  className="cursor-pointer pr-8"
                  placeholder="日付を選択"
                  onClick={() => addDateInputRef.current?.showPicker()}
                />
                <CalendarDays className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  ref={addDateInputRef}
                  type="date"
                  value={addTransactedAt}
                  onChange={(e) => setAddTransactedAt(e.target.value)}
                  className="sr-only"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>メモ</Label>
              <Textarea
                value={addNote}
                onChange={(e) => setAddNote(e.target.value)}
                placeholder="備考があれば入力"
                rows={2}
              />
            </div>
            <Button type="submit" disabled={addSaving} className="w-full">
              {addSaving ? '追加中...' : '追加する'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
