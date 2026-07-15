'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { PageTitle } from '@/components/ui/PageTitle'
import { DashboardTab } from './DashboardTab'
import { InstrumentsTab } from './InstrumentsTab'
import { AllInstrumentsTab } from './AllInstrumentsTab'

export function CalibrationClient() {
  const pathname = usePathname()
  const tab = pathname.includes('/instruments')
    ? 'instruments'
    : pathname.includes('/all')
    ? 'all'
    : 'dashboard'
  const [setupMsg, setSetupMsg] = useState<string | null>(null)

  useEffect(() => {
    if (sessionStorage.getItem('calibration_setup_done')) return
    fetch('/api/calibration/setup')
      .then((r) => r.ok ? r.json() : null)
      .then((check) => {
        if (!check?.needs_setup) {
          sessionStorage.setItem('calibration_setup_done', '1')
          return
        }
        return fetch('/api/calibration/setup', { method: 'POST' })
          .then((r) => r.ok ? r.json() : null)
          .then((result) => {
            sessionStorage.setItem('calibration_setup_done', '1')
            if (result?.linked > 0) setSetupMsg(result.message)
          })
      })
  }, [])

  const tabMeta = {
    dashboard: { title: '【校正】ダッシュボード', subtitle: '現場稼働中の測定器 校正カバー率の管理・記録' },
    instruments: { title: '【校正】測定器別', subtitle: '測定器種別ごとの校正状況' },
    all: { title: '【校正】全測定器', subtitle: '現場稼働中の全測定器の校正状況一覧' },
  }[tab]

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>{tabMeta.title}</PageTitle>
        <p className="text-sm text-muted-foreground mt-1">{tabMeta.subtitle}</p>
        {setupMsg && <p className="mt-1 text-xs text-muted-foreground">{setupMsg}</p>}
      </div>

      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'instruments' && <InstrumentsTab />}
      {tab === 'all' && <AllInstrumentsTab />}
    </div>
  )
}
