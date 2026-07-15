'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, CheckCircle2, AlertCircle, CalendarDays } from 'lucide-react'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
function weekdayLabel(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return WEEKDAYS[d.getDay()]
}

type InstrumentOption = {
  id: string
  management_code: string
  name: string
  model: string | null
  maker: string
  internal_cycle_months: number
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  preselectedInstrumentId?: string
  preselectedName?: string
  preselectedCode?: string
  onSuccess: () => void
}

export function CalibrationRecordModal({ open, onOpenChange, preselectedInstrumentId, preselectedName, preselectedCode, onSuccess }: Props) {
  const [instruments, setInstruments] = useState<InstrumentOption[]>([])
  const [selectedId, setSelectedId] = useState(preselectedInstrumentId ?? '')
  const [searchQuery, setSearchQuery] = useState(preselectedCode ?? '')
  const [calibratedAt, setCalibratedAt] = useState(new Date().toISOString().split('T')[0])
  const [nextDueAt, setNextDueAt] = useState('')
  const [result, setResult] = useState<'pass' | 'fail'>('pass')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('instruments')
      .select('id, management_code, maker, measurement_names(id, name, internal_cycle_months), measurement_models(model)')
      .neq('status', 'disposed')
      .then(({ data }) => {
        setInstruments(
          (data ?? []).map((i: any) => ({
            id: i.id,
            management_code: i.management_code,
            name: i.measurement_names?.name ?? '',
            model: i.measurement_models?.model ?? null,
            maker: i.maker,
            internal_cycle_months: i.measurement_names?.internal_cycle_months ?? 12,
          }))
        )
      })
  }, [])

  // 校正実施日・測定器が変わったら次回期限を自動計算
  useEffect(() => {
    if (!calibratedAt) return
    const inst = instruments.find((i) => i.id === selectedId)
    if (!inst) return
    const base = new Date(calibratedAt)
    base.setMonth(base.getMonth() + inst.internal_cycle_months)
    setNextDueAt(base.toISOString().split('T')[0])
  }, [selectedId, calibratedAt, instruments])

  useEffect(() => {
    if (open) {
      setSelectedId(preselectedInstrumentId ?? '')
      setSearchQuery(preselectedCode ?? '')
      setCalibratedAt(new Date().toISOString().split('T')[0])
      setNextDueAt('')
      setResult('pass')
      setNote('')
      setError(null)
    }
  }, [open, preselectedInstrumentId, preselectedCode])

  const selectedInstrument = instruments.find((i) => i.id === selectedId)
  const filteredInstruments = searchQuery
    ? instruments.filter(
        (i) =>
          i.management_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : instruments

  async function handleSubmit() {
    if (!selectedId) { setError('測定器を選択してください'); return }
    if (!calibratedAt) { setError('校正実施日を入力してください'); return }
    if (!nextDueAt) { setError('次回期限を計算できません'); return }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/calibration/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instrument_id: selectedId,
          calibration_type: 'internal',
          calibrated_at: calibratedAt,
          next_due_at: nextDueAt,
          result,
          note: note || null,
        }),
      })

      if (!res.ok) {
        const { error: err } = await res.json()
        throw new Error(err ?? '登録に失敗しました')
      }

      onSuccess()
      onOpenChange(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>校正記録の登録</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 測定器選択 */}
          <div className="space-y-1.5">
            <Label>測定器</Label>
            <Input
              placeholder="管理番号または測定器名で検索..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSelectedId('') }}
            />
            {!selectedId && searchQuery && (
              <div className="max-h-36 overflow-y-auto rounded-md border bg-popover text-sm shadow-md">
                {filteredInstruments.length === 0 ? (
                  <p className="p-2 text-center text-muted-foreground">見つかりません</p>
                ) : (
                  filteredInstruments.slice(0, 20).map((i) => (
                    <button
                      key={i.id}
                      className="w-full px-3 py-1.5 text-left hover:bg-accent"
                      onClick={() => { setSelectedId(i.id); setSearchQuery(i.management_code) }}
                    >
                      <span className="font-medium">{i.management_code}</span>
                      <span className="ml-2 text-muted-foreground">{i.name}{i.model ? ` / ${i.model}` : ''}</span>
                    </button>
                  ))
                )}
              </div>
            )}
            {selectedInstrument && (
              <p className="text-xs text-muted-foreground">
                {selectedInstrument.name}　{selectedInstrument.model ?? ''}　{selectedInstrument.maker}
              </p>
            )}
          </div>

          {/* 校正周期（表示のみ） */}
          <div className="space-y-1.5">
            <Label>校正周期</Label>
            <p className="text-sm text-muted-foreground">
              {selectedInstrument ? `${selectedInstrument.internal_cycle_months} ヶ月` : '-'}
            </p>
          </div>

          {/* 校正実施日 */}
          <div className="space-y-1.5">
            <Label>校正実施日</Label>
            <div className="relative w-52">
              <Input
                readOnly
                value={calibratedAt ? `${calibratedAt.replace(/-/g, '/')}（${weekdayLabel(calibratedAt)}）` : ''}
                className="cursor-pointer pr-8"
                placeholder="日付を選択"
                onClick={() => dateInputRef.current?.showPicker()}
              />
              <CalendarDays className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                ref={dateInputRef}
                type="date"
                value={calibratedAt}
                onChange={(e) => setCalibratedAt(e.target.value)}
                className="sr-only"
              />
            </div>
          </div>

          {/* 次回期限（自動計算・表示のみ） */}
          <div className="space-y-1.5">
            <Label>次回校正期限</Label>
            <p className="text-sm text-muted-foreground">
              {nextDueAt ? nextDueAt.replace(/-/g, '/') : '-'}
            </p>
          </div>

          {/* 校正結果 */}
          <div className="space-y-1.5">
            <Label>校正結果</Label>
            <div className="flex gap-4">
              {(['pass', 'fail'] as const).map((r) => (
                <label key={r} className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <input type="radio" name="result" value={r} checked={result === r} onChange={() => setResult(r)} />
                  {r === 'pass' ? (
                    <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" />合格</span>
                  ) : (
                    <span className="flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5 text-destructive" />不合格</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* 備考 */}
          <div className="space-y-1.5">
            <Label>備考</Label>
            <Textarea placeholder="特記事項があれば入力" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>キャンセル</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            登録する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
