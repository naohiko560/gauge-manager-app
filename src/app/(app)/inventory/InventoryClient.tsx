'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Instrument, InstrumentStatus, MeasurementName } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageTitle } from '@/components/ui/PageTitle'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'
import { SortableHead } from '@/components/ui/SortableHead'
import { useSortTable, sortRows } from '@/hooks/useSortTable'


type GroupedItem = {
  key: string
  name_id: string
  model_id: string | null
  name: string
  model: string | null
  totalStock: number
  optimalQty: number
  statusCounts: Partial<Record<InstrumentStatus, number>>
  locations: string[]
  warehouseCount: number
  fieldCount: number
  repairCount: number
}

type InventoryData = {
  instruments: Instrument[]
  names: Pick<MeasurementName, 'id' | 'name'>[]
}

async function fetchInventory(): Promise<InventoryData> {
  const supabase = createClient()
  const [{ data: inst }, { data: names }] = await Promise.all([
    supabase
      .from('instruments')
      .select('*, measurement_names(name), measurement_models(model), locations(location_type)')
      .neq('status', 'disposed'),
    supabase.from('measurement_names').select('id, name').order('name'),
  ])
  return { instruments: inst ?? [], names: names ?? [] }
}

export function InventoryClient() {
  const router = useRouter()
  const { data, isLoading } = useSWR<InventoryData>('inventory-list', fetchInventory)
  const [nameFilter, setNameFilter] = useState<string>('')
  const { sortKey, sortDir, handleSort } = useSortTable('name')

  const instruments: Instrument[] = data?.instruments ?? []
  const measurementNames: Pick<MeasurementName, 'id' | 'name'>[] = data?.names ?? []

  const groupedMap = new Map<string, GroupedItem>()
  for (const item of instruments) {
    if (nameFilter && item.name_id !== nameFilter) continue
    const key = `${item.name_id}__${item.model_id ?? ''}`
    const locType: string | undefined = (item as any).locations?.location_type
    const existing = groupedMap.get(key)
    if (existing) {
      existing.totalStock += 1
      existing.optimalQty = Math.max(existing.optimalQty, item.optimal_quantity)
      const s = item.status as InstrumentStatus
      existing.statusCounts[s] = (existing.statusCounts[s] ?? 0) + 1
      if (item.storage_location && !existing.locations.includes(item.storage_location)) {
        existing.locations.push(item.storage_location)
      }
      if (locType === 'warehouse') existing.warehouseCount += 1
      else if (locType === 'field') existing.fieldCount += 1
      else if (locType === 'repair') existing.repairCount += 1
    } else {
      groupedMap.set(key, {
        key,
        name_id: item.name_id,
        model_id: item.model_id,
        name: (item as any).measurement_names?.name ?? '-',
        model: (item as any).measurement_models?.model ?? null,
        totalStock: 1,
        optimalQty: item.optimal_quantity,
        statusCounts: { [item.status]: 1 },
        locations: item.storage_location ? [item.storage_location] : [],
        warehouseCount: locType === 'warehouse' ? 1 : 0,
        fieldCount: locType === 'field' ? 1 : 0,
        repairCount: locType === 'repair' ? 1 : 0,
      })
    }
  }

  const grouped = sortRows(
    Array.from(groupedMap.values()),
    sortKey,
    sortDir,
    (item, key) => key === 'diff' ? item.totalStock - item.optimalQty : (item as any)[key],
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>【在庫】在庫一覧</PageTitle>
        <p className="text-sm text-muted-foreground mt-1">全 {grouped.length} 種類</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Search className="w-4 h-4" /> 絞り込み
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="space-y-1 w-64">
              <Label className="text-xs">測定器名</Label>
              <Select value={nameFilter} onValueChange={(v) => setNameFilter(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="全て">
                    {nameFilter ? (measurementNames.find((n) => n.id === nameFilter)?.name ?? '全て') : '全て'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全て</SelectItem>
                  {measurementNames.map((n) => (
                    <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {nameFilter && (
              <Button variant="ghost" size="sm" onClick={() => setNameFilter('')}>
                フィルタをクリア
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>測定器名</SortableHead>
                <SortableHead sortKey="model" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>型式</SortableHead>
                <SortableHead sortKey="totalStock" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-center">総数</SortableHead>
                <SortableHead sortKey="warehouseCount" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-center">倉庫</SortableHead>
                <SortableHead sortKey="fieldCount" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-center">現場</SortableHead>
                <SortableHead sortKey="repairCount" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-center">修理中</SortableHead>
                <SortableHead sortKey="optimalQty" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-center">適正数</SortableHead>
                <SortableHead sortKey="diff" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-center">過不足</SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    該当する測定器がありません
                  </TableCell>
                </TableRow>
              ) : (
                grouped.map((item) => {
                  const diff = item.totalStock - item.optimalQty
                  const isShort = diff < 0
                  const href = `/inventory/${item.name_id}/${item.model_id ?? 'none'}`
                  return (
                    <TableRow
                      key={item.key}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(href)}
                    >
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.model ?? '-'}</TableCell>
                      <TableCell className={`text-center font-bold ${isShort ? 'text-destructive' : ''}`}>
                        {item.totalStock}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">{item.warehouseCount}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{item.fieldCount}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{item.repairCount}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{item.optimalQty}</TableCell>
                      <TableCell className={`text-center font-medium ${isShort ? 'text-destructive' : 'text-success'}`}>
                        {diff >= 0 ? `+${diff}` : diff}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
