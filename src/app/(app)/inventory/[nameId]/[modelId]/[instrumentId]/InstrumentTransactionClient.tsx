'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageTitle } from '@/components/ui/PageTitle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ChevronLeft, ArrowLeftRight, Check } from 'lucide-react'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function todayString(): string {
  return new Date().toISOString().split('T')[0]
}

function weekdayLabel(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return WEEKDAYS[d.getDay()]
}

type LocationKey = 'warehouse' | 'field' | 'other'

const LOCATION_LABELS: Record<LocationKey, string> = {
  warehouse: '倉庫',
  field: '現場',
  other: 'その他',
}

interface InstrumentInfo {
  id: string
  name: string
  model: string | null
}

interface GroupCounts {
  total: number
  warehouse: number
  field: number
}

interface Props {
  nameId: string
  modelId: string
  instrumentId: string
}

export function InstrumentTransactionClient({ nameId, modelId, instrumentId }: Props) {
  const router = useRouter()
  const [instrument, setInstrument] = useState<InstrumentInfo | null>(null)
  const [groupCounts, setGroupCounts] = useState<GroupCounts>({ total: 0, warehouse: 0, field: 0 })
  const [currentUserId, setCurrentUserId] = useState('')
  const [currentUserName, setCurrentUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const [location, setLocation] = useState<LocationKey>('warehouse')
  const [managementCode, setManagementCode] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [note, setNote] = useState('')
  const [transactedAt, setTransactedAt] = useState(todayString())
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function fetchGroupCounts() {
    const supabase = createClient()
    const { data } = await supabase
      .from('instruments')
      .select('storage_location')
      .eq('name_id', nameId)
      .neq('status', 'disposed')
    if (!data) return
    const counts: GroupCounts = { total: data.length, warehouse: 0, field: 0 }
    for (const g of data) {
      if (g.storage_location === '倉庫') counts.warehouse++
      else if (g.storage_location === '現場') counts.field++
    }
    setGroupCounts(counts)
  }

  useEffect(() => {
    const supabase = createClient()

    const resolvedGroupQ = supabase
      .from('instruments')
      .select('storage_location')
      .eq('name_id', nameId)
      .neq('status', 'disposed')

    Promise.all([
      supabase
        .from('instruments')
        .select('id, management_code, serial_number, measurement_names(name), measurement_models(model)')
        .eq('id', instrumentId)
        .single(),
      supabase.auth.getSession(),
      resolvedGroupQ,
    ]).then(async ([{ data: inst }, { data: { session } }, { data: groupInsts }]) => {
      if (inst) {
        setInstrument({
          id: inst.id,
          name: (inst as any).measurement_names?.name ?? '',
          model: (inst as any).measurement_models?.model ?? null,
        })
        setManagementCode(inst.management_code ?? '')
        setSerialNumber(inst.serial_number ?? '')
      }
      if (groupInsts) {
        const counts: GroupCounts = { total: groupInsts.length, warehouse: 0, field: 0 }
        for (const g of groupInsts) {
          if (g.storage_location === '倉庫') counts.warehouse++
          else if (g.storage_location === '現場') counts.field++
        }
        setGroupCounts(counts)
      }
      if (session?.user?.email) {
        const { data: user } = await supabase
          .from('users')
          .select('id, name')
          .eq('email', session.user.email)
          .single()
        if (user) {
          setCurrentUserId(user.id)
          setCurrentUserName(user.name)
        }
      }
      setLoading(false)
    })
  }, [instrumentId, nameId])

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!instrument) return

    setSaving(true)
    setError('')
    const supabase = createClient()
    const locationLabel = LOCATION_LABELS[location]
    const transactionType = location === 'warehouse' ? 'in' : 'out'

    const { error: txError } = await supabase.from('stock_transactions').insert({
      instrument_id: instrumentId,
      user_id: currentUserId,
      transaction_type: transactionType,
      quantity: 1,
      note,
      transacted_at: transactedAt,
    })
    if (txError) { setError('登録に失敗しました: ' + txError.message); setSaving(false); return }

    const { error: instError } = await supabase
      .from('instruments')
      .update({
        storage_location: locationLabel,
        management_code: managementCode,
        serial_number: serialNumber,
        updated_at: new Date().toISOString(),
      })
      .eq('id', instrumentId)
    if (instError) { setError('測定器情報の更新に失敗しました: ' + instError.message); setSaving(false); return }

    await fetchGroupCounts()
    setSuccess(true)
    setSaving(false)

    setTimeout(() => {
      setSuccess(false)
      setNote('')
    }, 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  if (!instrument) {
    return <p className="text-gray-500 p-8">測定器が見つかりません</p>
  }

  const weekday = weekdayLabel(transactedAt)

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
          onClick={() => router.push(`/inventory/${nameId}/${modelId}`)}
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> 詳細画面に戻る
        </Button>
        <PageTitle>入出庫入力</PageTitle>
        <p className="text-sm text-gray-500 mt-1">担当者: {currentUserName}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">対象測定器</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500">測定器名</p>
              <p className="font-medium">{instrument.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">型式</p>
              <p className="font-medium">{instrument.model ?? '-'}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-1 border-t">
            <div>
              <p className="text-xs text-gray-500">倉庫</p>
              <p className="font-bold text-lg">{groupCounts.warehouse}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">現場</p>
              <p className="font-bold text-lg">{groupCounts.field}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">総数</p>
              <p className="font-bold text-lg">{groupCounts.total}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4" />
            入出庫登録
          </CardTitle>
        </CardHeader>
        <CardContent>
          {success && (
            <Alert className="mb-4 bg-green-50 border-green-200">
              <Check className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-700">登録が完了しました</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>所在 <span className="text-red-500">*</span></Label>
              <Select value={location} onValueChange={(v) => setLocation(v as LocationKey)}>
                <SelectTrigger>
                  <SelectValue>{LOCATION_LABELS[location]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warehouse">倉庫</SelectItem>
                  <SelectItem value="field">現場</SelectItem>
                  <SelectItem value="other">その他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>登録番号</Label>
              <Input
                value={managementCode}
                onChange={(e) => setManagementCode(e.target.value)}
                placeholder="登録番号"
              />
            </div>
            <div className="space-y-2">
              <Label>シリアルNo</Label>
              <Input
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="シリアルNo"
              />
            </div>
            <div className="space-y-2">
              <Label>日付 <span className="text-red-500">*</span></Label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={transactedAt}
                  onChange={(e) => setTransactedAt(e.target.value)}
                  className="w-48"
                />
                {weekday && <span className="text-sm text-gray-600">（{weekday}）</span>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>メモ</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="備考があれば入力"
                rows={3}
              />
            </div>
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? '登録中...' : '登録する'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
