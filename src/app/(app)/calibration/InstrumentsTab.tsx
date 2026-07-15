'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { InstrumentCalibrationStat } from '@/types/database'
import { SortableHead } from '@/components/ui/SortableHead'
import { useSortTable, sortRows } from '@/hooks/useSortTable'

async function fetchByName(): Promise<InstrumentCalibrationStat[]> {
  const supabase = createClient()

  const { data: names } = await supabase
    .from('measurement_names')
    .select('id, name, internal_cycle_months, external_cycle_months')
    .order('name')

  if (!names || names.length === 0) return []

  const today = new Date().toISOString().split('T')[0]
  const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: fieldInstruments } = await supabase
    .from('instruments')
    .select('id, name_id, locations!inner(id)')
    .eq('locations.location_type', 'field')
    .neq('status', 'disposed')

  const instruments = fieldInstruments ?? []
  const instrumentIds = instruments.map((i) => i.id)

  const latestByInstrument = new Map<string, string>()
  if (instrumentIds.length > 0) {
    const { data: latestRecords } = await supabase
      .from('calibration_records')
      .select('instrument_id, next_due_at')
      .in('instrument_id', instrumentIds)
      .order('calibrated_at', { ascending: false })

    for (const rec of latestRecords ?? []) {
      if (!latestByInstrument.has(rec.instrument_id)) {
        latestByInstrument.set(rec.instrument_id, rec.next_due_at)
      }
    }
  }

  const statByName = new Map<string, { total_field: number; calibrated: number; expired: number; due_soon: number }>()
  for (const inst of instruments) {
    if (!statByName.has(inst.name_id)) {
      statByName.set(inst.name_id, { total_field: 0, calibrated: 0, expired: 0, due_soon: 0 })
    }
    const stat = statByName.get(inst.name_id)!
    stat.total_field++

    const nextDue = latestByInstrument.get(inst.id) ?? null
    if (!nextDue || nextDue < today) {
      stat.expired++
    } else if (nextDue <= in30days) {
      stat.due_soon++
      stat.calibrated++
    } else {
      stat.calibrated++
    }
  }

  return names.map((n) => {
    const stat = statByName.get(n.id) ?? { total_field: 0, calibrated: 0, expired: 0, due_soon: 0 }
    return {
      name_id: n.id,
      name: n.name,
      internal_cycle_months: n.internal_cycle_months,
      external_cycle_months: n.external_cycle_months,
      ...stat,
      calibration_rate: stat.total_field > 0 ? Math.round((stat.calibrated / stat.total_field) * 1000) / 10 : 0,
    }
  })
}

export function InstrumentsTab() {
  const { data: byName, isLoading } = useSWR<InstrumentCalibrationStat[]>('calibration-by-name', fetchByName)
  const { sortKey, sortDir, handleSort } = useSortTable('calibration_rate')

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-5"><Skeleton className="h-64 w-full" /></CardContent>
      </Card>
    )
  }

  const data = byName ?? []
  const active = data.filter((d) => d.total_field > 0)
  const inactive = data.filter((d) => d.total_field === 0)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">測定器種別 校正状況（現場稼働中）</CardTitle>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">現場稼働中の測定器がありません</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>測定器名</SortableHead>
                  <SortableHead sortKey="internal_cycle_months" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-center">社内周期</SortableHead>
                  <SortableHead sortKey="external_cycle_months" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-center">外部周期</SortableHead>
                  <SortableHead sortKey="total_field" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-right">現場台数</SortableHead>
                  <SortableHead sortKey="calibrated" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-right">校正済</SortableHead>
                  <SortableHead sortKey="expired" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-right">期限切れ</SortableHead>
                  <SortableHead sortKey="due_soon" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-right">期限間近</SortableHead>
                  <SortableHead sortKey="calibration_rate" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-right">校正率</SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortRows(active, sortKey, sortDir).map((row) => (
                  <TableRow key={row.name_id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {row.internal_cycle_months}ヶ月
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {row.external_cycle_months ? `${row.external_cycle_months}ヶ月` : '-'}
                    </TableCell>
                    <TableCell className="text-right">{row.total_field}</TableCell>
                    <TableCell className="text-right">{row.calibrated}</TableCell>
                    <TableCell className="text-right">
                      {row.expired > 0 ? (
                        <span className="font-medium text-destructive">{row.expired}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.due_soon > 0 ? (
                        <span className="font-medium text-warning">{row.due_soon}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <RateBadge rate={row.calibration_rate} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {inactive.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">現場未稼働の種別</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {inactive.map((row) => (
                <Badge key={row.name_id} variant="secondary">{row.name}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function RateBadge({ rate }: { rate: number }) {
  const variant = rate === 100 ? 'default' : rate >= 80 ? 'secondary' : 'destructive'
  return (
    <Badge variant={variant} className="font-mono">
      {rate}%
    </Badge>
  )
}
