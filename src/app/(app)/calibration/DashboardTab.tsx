'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { CalibrationRecordModal } from './CalibrationRecordModal'
import { CalibrationSummary, LocationCalibrationStat, PendingCalibrationItem } from '@/types/database'
import { CheckCircle2 } from 'lucide-react'
import { SortableHead } from '@/components/ui/SortableHead'
import { useSortTable, sortRows } from '@/hooks/useSortTable'

type SummaryResponse = {
  summary: CalibrationSummary
  by_location: LocationCalibrationStat[]
  pending_items: PendingCalibrationItem[]
}

async function fetchSummary(): Promise<SummaryResponse> {
  const supabase = createClient()

  const { data: fieldInstruments } = await supabase
    .from('instruments')
    .select('id, management_code, maker, measurement_names(name), measurement_models(model), locations!inner(id, name)')
    .eq('locations.location_type', 'field')
    .neq('status', 'disposed')

  const instruments = fieldInstruments ?? []
  const today = new Date().toISOString().split('T')[0]
  const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  if (instruments.length === 0) {
    return {
      summary: { total_field: 0, calibrated: 0, expired: 0, due_soon: 0, calibration_rate: 0 },
      by_location: [],
      pending_items: [],
    }
  }

  const instrumentIds = instruments.map((i) => i.id)
  const { data: latestRecords } = await supabase
    .from('calibration_records')
    .select('instrument_id, calibrated_at, next_due_at, calibration_type')
    .in('instrument_id', instrumentIds)
    .order('calibrated_at', { ascending: false })

  const latestByInstrument = new Map<string, { calibrated_at: string; next_due_at: string; calibration_type: string }>()
  for (const rec of latestRecords ?? []) {
    if (!latestByInstrument.has(rec.instrument_id)) {
      latestByInstrument.set(rec.instrument_id, {
        calibrated_at: rec.calibrated_at,
        next_due_at: rec.next_due_at,
        calibration_type: rec.calibration_type,
      })
    }
  }

  let calibrated = 0
  let expired = 0
  let due_soon = 0
  const locationMap = new Map<string, { name: string; total: number; calibrated: number; expired: number; due_soon: number }>()
  const pendingItems: object[] = []

  for (const inst of instruments) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const locRaw = inst.locations as any
    const loc: { id: string; name: string } | null = Array.isArray(locRaw) ? locRaw[0] ?? null : locRaw
    if (!loc) continue

    if (!locationMap.has(loc.id)) {
      locationMap.set(loc.id, { name: loc.name, total: 0, calibrated: 0, expired: 0, due_soon: 0 })
    }
    const locStat = locationMap.get(loc.id)!
    locStat.total++

    const latest = latestByInstrument.get(inst.id)
    const nextDue = latest?.next_due_at ?? null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const name = ((inst.measurement_names as any)?.[0] ?? inst.measurement_names as any)?.name ?? ''
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = ((inst.measurement_models as any)?.[0] ?? inst.measurement_models as any)?.model ?? null

    if (!nextDue || nextDue < today) {
      expired++
      locStat.expired++
      pendingItems.push({
        instrument_id: inst.id,
        management_code: inst.management_code,
        name,
        model,
        maker: inst.maker,
        location_name: loc.name,
        calibration_type: latest?.calibration_type ?? null,
        calibrated_at: latest?.calibrated_at ?? null,
        next_due_at: nextDue,
        days_until_due: nextDue ? Math.ceil((new Date(nextDue).getTime() - Date.now()) / 86400000) : null,
      })
    } else if (nextDue <= in30days) {
      due_soon++
      locStat.due_soon++
      calibrated++
      locStat.calibrated++
      pendingItems.push({
        instrument_id: inst.id,
        management_code: inst.management_code,
        name,
        model,
        maker: inst.maker,
        location_name: loc.name,
        calibration_type: latest?.calibration_type ?? null,
        calibrated_at: latest?.calibrated_at ?? null,
        next_due_at: nextDue,
        days_until_due: Math.ceil((new Date(nextDue).getTime() - Date.now()) / 86400000),
      })
    } else {
      calibrated++
      locStat.calibrated++
    }
  }

  const total_field = instruments.length
  const calibration_rate = total_field > 0 ? Math.round((calibrated / total_field) * 1000) / 10 : 0

  const by_location = Array.from(locationMap.entries()).map(([location_id, stat]) => ({
    location_id,
    location_name: stat.name,
    total: stat.total,
    calibrated: stat.calibrated,
    expired: stat.expired,
    due_soon: stat.due_soon,
    calibration_rate: stat.total > 0 ? Math.round((stat.calibrated / stat.total) * 1000) / 10 : 0,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pendingItems.sort((a: any, b: any) => {
    const aDay = a.days_until_due ?? -9999
    const bDay = b.days_until_due ?? -9999
    return aDay - bDay
  })

  return {
    summary: { total_field, calibrated, expired, due_soon, calibration_rate },
    by_location,
    pending_items: pendingItems as PendingCalibrationItem[],
  }
}

export function DashboardTab() {
  const { data, isLoading, mutate } = useSWR<SummaryResponse>('calibration-summary', fetchSummary)
  const [modalOpen, setModalOpen] = useState(false)
  const [preselected, setPreselected] = useState<{ id: string; name: string; code: string } | undefined>()
  const { sortKey: locSortKey, sortDir: locSortDir, handleSort: handleLocSort } = useSortTable('location_name')
  const { sortKey: pendSortKey, sortDir: pendSortDir, handleSort: handlePendSort } = useSortTable('days_until_due')

  function openModalForInstrument(item: PendingCalibrationItem) {
    setPreselected({ id: item.instrument_id, name: item.name, code: item.management_code })
    setModalOpen(true)
  }

  if (isLoading) return <DashboardSkeleton />

  const s = data?.summary
  const byLocation = data?.by_location ?? []
  const pending = data?.pending_items ?? []

  return (
    <div className="space-y-6">
      {/* サマリーカード */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          label="現場稼働台数"
          value={`${s?.total_field ?? 0}台`}
        />
        <SummaryCard
          label="校正率"
          value={`${s?.calibration_rate ?? 0}%`}
          sub={s ? `${s.calibrated}/${s.total_field}台` : ''}
          highlight={s?.calibration_rate && s.calibration_rate < 80 ? 'red' : 'default'}
        />
        <SummaryCard
          label="期限切れ"
          value={`${s?.expired ?? 0}台`}
          sub="即対応必要"
          highlight={s?.expired ? 'red' : 'default'}
        />
        <SummaryCard
          label="期限間近"
          value={`${s?.due_soon ?? 0}台`}
          sub="30日以内"
          highlight={s?.due_soon ? 'amber' : 'default'}
        />
      </div>

      {/* 現場別校正率 */}
      {byLocation.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">現場別 校正率</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead sortKey="location_name" currentKey={locSortKey} currentDir={locSortDir} onSort={handleLocSort}>現場名</SortableHead>
                  <SortableHead sortKey="total" currentKey={locSortKey} currentDir={locSortDir} onSort={handleLocSort} className="text-right">稼働台数</SortableHead>
                  <SortableHead sortKey="calibrated" currentKey={locSortKey} currentDir={locSortDir} onSort={handleLocSort} className="text-right">校正済</SortableHead>
                  <SortableHead sortKey="expired" currentKey={locSortKey} currentDir={locSortDir} onSort={handleLocSort} className="text-right">期限切れ</SortableHead>
                  <SortableHead sortKey="due_soon" currentKey={locSortKey} currentDir={locSortDir} onSort={handleLocSort} className="text-right">期限間近</SortableHead>
                  <SortableHead sortKey="calibration_rate" currentKey={locSortKey} currentDir={locSortDir} onSort={handleLocSort} className="text-right">校正率</SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortRows(byLocation, locSortKey, locSortDir).map((loc) => (
                  <TableRow key={loc.location_id}>
                    <TableCell className="font-medium">{loc.location_name}</TableCell>
                    <TableCell className="text-right">{loc.total}</TableCell>
                    <TableCell className="text-right">{loc.calibrated}</TableCell>
                    <TableCell className="text-right">
                      {loc.expired > 0 ? <span className="text-destructive font-medium">{loc.expired}</span> : loc.expired}
                    </TableCell>
                    <TableCell className="text-right">
                      {loc.due_soon > 0 ? <span className="text-warning font-medium">{loc.due_soon}</span> : loc.due_soon}
                    </TableCell>
                    <TableCell className="text-right">
                      <CalibrationRateBadge rate={loc.calibration_rate} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 要対応リスト */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">要対応リスト</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <CheckCircle2 className="mb-2 h-8 w-8 text-success" />
              <p className="text-sm font-medium">対応が必要な測定器はありません</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead sortKey="management_code" currentKey={pendSortKey} currentDir={pendSortDir} onSort={handlePendSort}>管理番号</SortableHead>
                  <SortableHead sortKey="name" currentKey={pendSortKey} currentDir={pendSortDir} onSort={handlePendSort}>測定器名</SortableHead>
                  <SortableHead sortKey="model" currentKey={pendSortKey} currentDir={pendSortDir} onSort={handlePendSort}>型式</SortableHead>
                  <SortableHead sortKey="location_name" currentKey={pendSortKey} currentDir={pendSortDir} onSort={handlePendSort}>現場</SortableHead>
                  <SortableHead sortKey="calibrated_at" currentKey={pendSortKey} currentDir={pendSortDir} onSort={handlePendSort}>前回校正日</SortableHead>
                  <SortableHead sortKey="next_due_at" currentKey={pendSortKey} currentDir={pendSortDir} onSort={handlePendSort}>次回期限</SortableHead>
                  <SortableHead sortKey="days_until_due" currentKey={pendSortKey} currentDir={pendSortDir} onSort={handlePendSort} className="text-right">残日数</SortableHead>
                  <SortableHead sortKey="calibration_type" currentKey={pendSortKey} currentDir={pendSortDir} onSort={handlePendSort}>種別</SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortRows(pending, pendSortKey, pendSortDir).map((item) => (
                  <TableRow
                    key={item.instrument_id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openModalForInstrument(item)}
                  >
                    <TableCell className="font-medium">{item.management_code}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.model ?? '-'}</TableCell>
                    <TableCell>{item.location_name}</TableCell>
                    <TableCell>{item.calibrated_at ?? '未記録'}</TableCell>
                    <TableCell>{item.next_due_at ?? '-'}</TableCell>
                    <TableCell className="text-right">
                      <DaysLabel days={item.days_until_due} />
                    </TableCell>
                    <TableCell>
                      {item.calibration_type === 'internal' ? '社内' : item.calibration_type === 'external' ? '外部' : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CalibrationRecordModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        preselectedInstrumentId={preselected?.id}
        preselectedName={preselected?.name}
        preselectedCode={preselected?.code}
        onSuccess={() => mutate()}
      />
    </div>
  )
}

function SummaryCard({ label, value, sub, highlight }: {
  label: string
  value: string
  sub?: string
  highlight?: 'green' | 'red' | 'amber' | 'default'
}) {
  const valueClass =
    highlight === 'red' ? 'text-destructive' :
    highlight === 'amber' ? 'text-warning' : 'text-foreground'

  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-base text-muted-foreground">{label}</p>
            <p className={`mt-2 text-2xl font-semibold ${valueClass}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CalibrationRateBadge({ rate }: { rate: number }) {
  const variant = rate === 100 ? 'default' : rate >= 80 ? 'secondary' : 'destructive'
  return (
    <Badge variant={variant} className="font-mono">
      {rate}%
    </Badge>
  )
}

function DaysLabel({ days }: { days: number | null }) {
  if (days === null) return <span className="text-muted-foreground">-</span>
  if (days < 0) return <span className="font-medium text-destructive">{days}日</span>
  if (days <= 30) return <span className="font-medium text-warning">+{days}日</span>
  return <span className="text-muted-foreground">+{days}日</span>
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="pt-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
        ))}
      </div>
      <Card><CardContent className="pt-5"><Skeleton className="h-32 w-full" /></CardContent></Card>
      <Card><CardContent className="pt-5"><Skeleton className="h-48 w-full" /></CardContent></Card>
    </div>
  )
}
