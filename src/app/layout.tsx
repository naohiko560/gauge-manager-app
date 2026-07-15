import type { Metadata } from 'next'
import Script from 'next/script'
import { Geist } from 'next/font/google'
import './globals.css'

const cfAnalyticsToken = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: '測定器在庫管理システム',
  description: '測定器の在庫・校正・入出庫を一元管理するシステム',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-gray-50">
        {children}
        {cfAnalyticsToken && (
          <Script
            strategy="afterInteractive"
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={`{"token": "${cfAnalyticsToken}"}`}
          />
        )}
      </body>
    </html>
  )
}
