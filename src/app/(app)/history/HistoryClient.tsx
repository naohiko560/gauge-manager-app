'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { TransactionType, MeasurementName } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageTitle } from '@/components/ui/PageTitle'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { Search } from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { SortableHead } from '@/components/ui/SortableHead'
import { useSortTable, sortRows } from '@/hooks/useSortTable'

const TRANSACTION_LABELS: Record<TransactionType, string> = {
  in: '入庫',
  out: '出庫',
}

const TRANSACTION_COLORS: Record<TransactionType, string> = {
  in: 'bg-green-100 text-green-700',
  out: 'bg-red-100 text-red-700',
}

interface TransactionRow {
  id: string
  transaction_type: TransactionType
  quantity: number
  note: string
  transacted_at: string
  created_at: string
  instruments?: {
    management_code: string
    measurement_names?: { name: string }
    measurement_models?: { model: string }
  }
  users?: { name: string }
}

type HistoryData = {
  transactions: TransactionRow[]
  names: Pick<MeasurementName, 'id' | 'name'>[]
}

function getHistoryValue(tx: TransactionRow, key: string): string | number | null | undefined {
  switch (key) {
    case 'user': return tx.users?.name ?? ''
    case 'instName': return tx.instruments?.measurement_names?.name ?? ''
    case 'model': return tx.instruments?.measurement_models?.model ?? ''
    case 'code': return tx.instruments?.management_code ?? ''
    default: return (tx as any)[key]
  }
}

async function fetchHistory(): Promise<HistoryData> {
  const supabase = createClient()
  const [{ data: tx }, { data: names }] = await Promise.all([
    supabase.from('stock_transactions')
      .select('*, instruments(management_code, measurement_names(name), measurement_models(model)), users(name)')
      .order('transacted_at', { ascending: false })
      .limit(500),
    supabase.from('measurement_names').select('id, name').order('name'),
  ])
  return { transactions: (tx as TransactionRow[]) ?? [], names: names ?? [] }
}

export function HistoryClient() {
  const { data, isLoading } = useSWR<HistoryData>('history', fetchHistory)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const { sortKey, sortDir, handleSort } = useSortTable('transacted_at', 'desc')
  const [nameFilter, setNameFilter] = useState<string>('')
  const [userFilter, setUserFilter] = useState<string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const transactions = data?.transactions ?? []
  const measurementNames = data?.names ?? []

  const filtered = transactions.filter((tx) => {
    if (typeFilter !== 'all' && tx.transaction_type !== typeFilter) return false
    if (nameFilter) {
      const instrumentName = tx.instruments?.measurement_names?.name ?? ''
      if (!instrumentName.toLowerCase().includes(nameFilter.toLowerCase())) return false
    }
    if (userFilter) {
      const userName = tx.users?.name ?? ''
      if (!userName.toLowerCase().includes(userFilter.toLowerCase())) return false
    }
    if (dateFrom && tx.transacted_at < dateFrom) return false
    if (dateTo && tx.transacted_at > dateTo) return false
    return true
  })

  const hasFilter = typeFilter !== 'all' || nameFilter || userFilter || dateFrom || dateTo

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
        <PageTitle>【在庫】履歴一覧</PageTitle>
        <p className="text-sm text-gray-500 mt-1">全 {transactions.length} 件中 {filtered.length} 件表示</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Search className="w-4 h-4" /> 絞り込み
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">入出庫種別</Label>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="全て">
                    {typeFilter === 'all' ? '全て' : TRANSACTION_LABELS[typeFilter as TransactionType]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全て</SelectItem>
                  <SelectItem value="in">入庫</SelectItem>
                  <SelectItem value="out">出庫</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">測定器名（部分一致）</Label>
              <Input placeholder="測定器名" value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">担当者（部分一致）</Label>
              <Input placeholder="担当者名" value={userFilter} onChange={(e) => setUserFilter(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">日付（開始）</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">日付（終了）</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          {hasFilter && (
            <div className="mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setTypeFilter('all'); setNameFilter(''); setUserFilter(''); setDateFrom(''); setDateTo('') }}
              >
                フィルタをクリア
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead sortKey="transacted_at" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>日付</SortableHead>
                <SortableHead sortKey="user" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>担当者</SortableHead>
                <SortableHead sortKey="instName" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>測定器名</SortableHead>
                <SortableHead sortKey="model" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>型式</SortableHead>
                <SortableHead sortKey="code" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>管理番号</SortableHead>
                <SortableHead sortKey="transaction_type" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>種別</SortableHead>
                <SortableHead sortKey="quantity" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-center">数量</SortableHead>
                <SortableHead sortKey="note" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>メモ</SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    履歴がありません
                  </TableCell>
                </TableRow>
              ) : (
                sortRows(filtered, sortKey, sortDir, getHistoryValue).map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {format(new Date(tx.transacted_at), 'yyyy/M/d', { locale: ja })}
                    </TableCell>
                    <TableCell className="text-sm">{tx.users?.name ?? '-'}</TableCell>
                    <TableCell className="font-medium text-sm">{tx.instruments?.measurement_names?.name ?? '-'}</TableCell>
                    <TableCell className="text-sm text-gray-600">{tx.instruments?.measurement_models?.model ?? '-'}</TableCell>
                    <TableCell className="font-mono text-xs">{tx.instruments?.management_code ?? '-'}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${TRANSACTION_COLORS[tx.transaction_type]}`}>
                        {TRANSACTION_LABELS[tx.transaction_type]}
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-bold">{tx.quantity}</TableCell>
                    <TableCell className="text-sm text-gray-600 max-w-xs truncate">{tx.note || '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
