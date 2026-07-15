'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Instrument } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageTitle } from '@/components/ui/PageTitle'
import { AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

async function fetchDashboard(): Promise<Instrument[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('instruments')
    .select('*, measurement_names(name), measurement_models(model)')
    .neq('status', 'disposed')
  return data ?? []
}

export function DashboardClient() {
  const { data: instruments = [], isLoading } = useSWR<Instrument[]>('dashboard', fetchDashboard)

  const today = new Date()

  const inStock  = instruments.filter((i) => i.status === 'in_stock').length
  const repairing = instruments.filter((i) => i.status === 'repairing').length
  const shortages = instruments.filter(
    (i) => i.stock_quantity < i.optimal_quantity && i.status === 'in_stock'
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>【在庫】ダッシュボード</PageTitle>
        <p className="text-sm text-muted-foreground mt-1">
          {format(today, 'yyyy年M月d日（EEE）', { locale: ja })} 現在
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base text-muted-foreground">在庫中</p>
                <p className="text-2xl font-semibold text-foreground mt-2">
                  {inStock} <span className="text-2xl font-normal text-muted-foreground">台</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base text-muted-foreground">修理中</p>
                <p className="text-2xl font-semibold text-foreground mt-2">
                  {repairing} <span className="text-2xl font-normal text-muted-foreground">台</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base text-muted-foreground">在庫不足</p>
                <p className={`text-2xl font-semibold mt-2 ${shortages.length > 0 ? 'text-destructive' : 'text-foreground'}`}>
                  {shortages.length} <span className="text-2xl font-normal text-muted-foreground">件</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            在庫不足
          </CardTitle>
        </CardHeader>
        <CardContent>
          {shortages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">在庫不足の測定器はありません</p>
          ) : (
            <div className="space-y-2">
              {shortages.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{(item as any).measurement_names?.name}</p>
                    <p className="text-xs text-muted-foreground">{(item as any).measurement_models?.model ?? item.management_code}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-destructive">{item.stock_quantity}</span>
                    <span className="text-xs text-muted-foreground"> / {item.optimal_quantity} 台</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
