'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CalibrationRecordModal } from './CalibrationRecordModal'
import { FieldInstrumentItem } from '@/types/database'
import { SortableHead } from '@/components/ui/SortableHead'
import { useSortTable, sortRows } from '@/hooks/useSortTable'

function statusOrder(status: string): number {
  if (status === 'expired') return 0
  if (status === 'due_soon') return 1
  return 2
}

async function fetchFieldInstruments(): Promise<FieldInstrumentItem[]> {
  const supabase = createClient()

  const { data: fieldInstruments } = await supabase
    .from('instruments')
    .select(
      'id, management_code, maker, ' +
      'measurement_names(name, internal_cycle_months), ' +
      'measurement_models(model), ' +
      'locations!inner(id, name)'
    )
    .eq('locations.location_type', 'field')
    .neq('status', 'disposed')
    .order('management_code')

  const instruments = fieldInstruments ?? []
  if (instruments.length === 0) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instrumentIds = instruments.map((i: any) => i.id)
  const { data: latestRecords } = await supabase
    .from('calibration_records')
    .select('instrument_id, calibrated_at, next_due_at, calibration_type')
    .in('instrument_id', instrumentIds)
    .order('calibrated_at', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latestByInstrument = new Map<string, any>()
  for (const rec of latestRecords ?? []) {
    if (!latestByInstrument.has(rec.instrument_id)) {
      latestByInstrument.set(rec.instrument_id, rec)
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return instruments.map((inst: any) => {
    const loc = Array.isArray(inst.locations) ? inst.locations[0] : inst.locations
    const nameObj = Array.isArray(inst.measurement_names) ? inst.measurement_names[0] : inst.measurement_names
    const modelObj = Array.isArray(inst.measurement_models) ? inst.measurement_models[0] : inst.measurement_models
    const latest = latestByInstrument.get(inst.id)
    const nextDue: string | null = latest?.next_due_at ?? null

    const calibration_status =
      !nextDue || nextDue < today ? 'expired'
      : nextDue <= in30days ? 'due_soon'
      : 'ok'

    return {
      instrument_id: inst.id,
      management_code: inst.management_code,
      name: nameObj?.name ?? '',
      model: modelObj?.model ?? null,
      maker: inst.maker,
      location_name: loc?.name ?? '-',
      calibration_type: latest?.calibration_type ?? null,
      calibrated_at: latest?.calibrated_at ?? null,
      next_due_at: nextDue,
      days_until_due: nextDue
        ? Math.ceil((new Date(nextDue).getTime() - Date.now()) / 86400000)
        : null,
      calibration_status,
    }
  })
}

export function AllInstrumentsTab() {
  const { data: items, isLoading, mutate } = useSWR<FieldInstrumentItem[]>('calibration-field-instruments', fetchFieldInstruments)
  const [modalOpen, setModalOpen] = useState(false)
  const [preselected, setPreselected] = useState<{ id: string; name: string; code: string } | undefined>()
  const { sortKey, sortDir, handleSort } = useSortTable('management_code')

  const data = items ?? []

  function openModal(item: FieldInstrumentItem) {
    setPreselected({ id: item.instrument_id, name: item.name, code: item.management_code })
    setModalOpen(true)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-5">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">現場稼働中 全測定器（{data.length}台）</CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              現場稼働中の測定器がありません
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead sortKey="management_code" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>管理番号</SortableHead>
                  <SortableHead sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>測定器名</SortableHead>
                  <SortableHead sortKey="model" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>型式</SortableHead>
                  <SortableHead sortKey="location_name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>現場</SortableHead>
                  <SortableHead sortKey="calibrated_at" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>前回校正日</SortableHead>
                  <SortableHead sortKey="next_due_at" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>次回期限</SortableHead>
                  <SortableHead sortKey="days_until_due" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-right">残日数</SortableHead>
                  <SortableHead sortKey="calibration_status" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>状態</SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortRows(data, sortKey, sortDir, (item, key) =>
                  key === 'calibration_status' ? statusOrder(item.calibration_status) : (item as any)[key]
                ).map((item) => (
                  <TableRow
                    key={item.instrument_id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openModal(item)}
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
                      <StatusBadge status={item.calibration_status} />
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

function StatusBadge({ status }: { status: 'ok' | 'due_soon' | 'expired' }) {
  if (status === 'expired') return <Badge variant="destructive">期限切れ</Badge>
  if (status === 'due_soon') return <Badge variant="outline" className="text-warning border-warning">期限間近</Badge>
  return <Badge variant="secondary">正常</Badge>
}

function DaysLabel({ days }: { days: number | null }) {
  if (days === null) return <span className="text-muted-foreground">-</span>
  if (days < 0) return <span className="font-medium text-destructive">{days}日</span>
  if (days <= 30) return <span className="font-medium text-warning">+{days}日</span>
  return <span className="text-muted-foreground">+{days}日</span>
}
