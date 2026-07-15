'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MeasurementName, MeasurementModel, TransactionType } from '@/types/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageTitle } from '@/components/ui/PageTitle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeftRight, Check } from 'lucide-react'

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  in: '入庫',
  out: '出庫',
}

interface InstrumentOption {
  id: string
  name_id: string
  model_id: string | null
  management_code: string
  stock_quantity: number
}

export function TransactionClient() {
  const router = useRouter()
  const [measurementNames, setMeasurementNames] = useState<Pick<MeasurementName, 'id' | 'name'>[]>([])
  const [measurementModels, setMeasurementModels] = useState<Pick<MeasurementModel, 'id' | 'name_id' | 'model'>[]>([])
  const [instruments, setInstruments] = useState<InstrumentOption[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [currentUserName, setCurrentUserName] = useState('')
  const [dataLoading, setDataLoading] = useState(true)
  const [selectedNameId, setSelectedNameId] = useState('')
  const [selectedInstrumentId, setSelectedInstrumentId] = useState('')
  const [transactionType, setTransactionType] = useState<TransactionType>('in')
  const [quantity, setQuantity] = useState('1')
  const [note, setNote] = useState('')
  const [transactedAt, setTransactedAt] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('measurement_names').select('id, name').order('name'),
      supabase.from('measurement_models').select('id, name_id, model').order('model'),
      supabase.from('instruments').select('id, name_id, model_id, management_code, stock_quantity').neq('status', 'disposed').order('management_code'),
      supabase.auth.getSession(),
    ]).then(async ([{ data: names }, { data: models }, { data: inst }, { data: { session } }]) => {
      setMeasurementNames(names ?? [])
      setMeasurementModels(models ?? [])
      setInstruments(inst ?? [])
      if (session?.user?.email) {
        const { data: user } = await supabase.from('users').select('id, name').eq('email', session.user.email).single()
        if (user) { setCurrentUserId(user.id); setCurrentUserName(user.name) }
      }
      setDataLoading(false)
    })
  }, [])

  const filteredInstruments = selectedNameId
    ? instruments.filter((i) => i.name_id === selectedNameId)
    : instruments

  const selectedInstrument = instruments.find((i) => i.id === selectedInstrumentId)
  const selectedModel = selectedInstrument
    ? measurementModels.find((m) => m.id === selectedInstrument.model_id)
    : null

  function handleNameChange(nameId: string | null) {
    setSelectedNameId(nameId ?? '')
    setSelectedInstrumentId('')
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedInstrumentId) { setError('測定器を選択してください'); return }
    const qty = parseInt(quantity)
    if (!qty || qty <= 0) { setError('数量は1以上の整数を入力してください'); return }

    setLoading(true)
    setError('')

    const supabase = createClient()

    const { error: txError } = await supabase.from('stock_transactions').insert({
      instrument_id: selectedInstrumentId,
      user_id: currentUserId,
      transaction_type: transactionType,
      quantity: qty,
      note,
      transacted_at: transactedAt,
    })

    if (txError) { setError('登録に失敗しました: ' + txError.message); setLoading(false); return }

    const delta = transactionType === 'in' ? qty : -qty
    const { error: stockError } = await supabase
      .from('instruments')
      .update({ stock_quantity: (selectedInstrument!.stock_quantity ?? 0) + delta, updated_at: new Date().toISOString() })
      .eq('id', selectedInstrumentId)

    if (stockError) { setError('在庫数の更新に失敗しました: ' + stockError.message); setLoading(false); return }

    setSuccess(true)
    setLoading(false)

    setTimeout(() => {
      setSuccess(false)
      setSelectedNameId('')
      setSelectedInstrumentId('')
      setTransactionType('in')
      setQuantity('1')
      setNote('')
      setTransactedAt(new Date().toISOString().split('T')[0])
      router.refresh()
    }, 2000)
  }

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <PageTitle>入出庫入力</PageTitle>
        <p className="text-sm text-gray-500 mt-1">担当者: {currentUserName}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4" />
            入出庫登録
          </CardTitle>
          <CardDescription>必要事項を入力して登録してください</CardDescription>
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
              <Label>測定器名 <span className="text-red-500">*</span></Label>
              <Select value={selectedNameId} onValueChange={handleNameChange}>
                <SelectTrigger>
                  <SelectValue placeholder="測定器名を選択">
                    {selectedNameId ? (measurementNames.find((n) => n.id === selectedNameId)?.name ?? '測定器名を選択') : '測定器名を選択'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {measurementNames.map((n) => (
                    <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>管理番号 / 型式 <span className="text-red-500">*</span></Label>
              <Select
                value={selectedInstrumentId}
                onValueChange={(v) => setSelectedInstrumentId(v ?? '')}
                disabled={!selectedNameId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedNameId ? '測定器を選択' : '先に測定器名を選択してください'} />
                </SelectTrigger>
                <SelectContent>
                  {filteredInstruments.map((i) => {
                    const model = measurementModels.find((m) => m.id === i.model_id)
                    return (
                      <SelectItem key={i.id} value={i.id}>
                        {i.management_code}{model ? ` - ${model.model}` : ''}（在庫: {i.stock_quantity}）
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {selectedModel && (
              <div className="space-y-2">
                <Label className="text-gray-500">型式（自動入力）</Label>
                <Input value={selectedModel.model} readOnly className="bg-gray-50 text-gray-600" />
              </div>
            )}

            <div className="space-y-2">
              <Label>入出庫種別 <span className="text-red-500">*</span></Label>
              <Select value={transactionType} onValueChange={(v) => setTransactionType(v as TransactionType)}>
                <SelectTrigger>
                  <SelectValue>{TRANSACTION_TYPE_LABELS[transactionType]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>数量 <span className="text-red-500">*</span></Label>
              <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-32" />
            </div>

            <div className="space-y-2">
              <Label>日付 <span className="text-red-500">*</span></Label>
              <Input type="date" value={transactedAt} onChange={(e) => setTransactedAt(e.target.value)} className="w-48" />
            </div>

            <div className="space-y-2">
              <Label>メモ</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="備考があれば入力" rows={3} />
            </div>

            <Button type="submit" disabled={loading || !selectedInstrumentId} className="w-full">
              {loading ? '登録中...' : '登録する'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
