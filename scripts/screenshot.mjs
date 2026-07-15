/**
 * スクリーンショット自動撮影スクリプト
 *
 * 事前準備:
 *   npm run screenshot:setup
 *     → playwright と chromium をインストールします
 *
 * 認証情報の設定:
 *   .env.screenshot.local を作成して以下を記述してください
 *     SCREENSHOT_EMAIL=your@email.com
 *     SCREENSHOT_PASSWORD=yourpassword
 *
 * 実行:
 *   npm run screenshot
 */

import { chromium } from 'playwright'
import { spawn } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { mkdir } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ── パス設定 ────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT     = resolve(__dirname, '..')
const OUT_DIR  = resolve(ROOT, 'docs/screenshots')
const PORT     = 3099
const BASE_URL = `http://localhost:${PORT}`

// ── .env.screenshot.local を読み込む ────────────────────────
function loadEnv(filepath) {
  if (!existsSync(filepath)) return {}
  return Object.fromEntries(
    readFileSync(filepath, 'utf-8')
      .split('\n')
      .filter(l => l.trim() && !l.trim().startsWith('#') && l.includes('='))
      .map(l => {
        const idx = l.indexOf('=')
        return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
      })
  )
}

const creds = loadEnv(resolve(ROOT, '.env.screenshot.local'))
const EMAIL    = creds.SCREENSHOT_EMAIL
const PASSWORD = creds.SCREENSHOT_PASSWORD

if (!EMAIL || !PASSWORD || EMAIL.includes('example.com')) {
  console.error('❌ .env.screenshot.local の SCREENSHOT_EMAIL と SCREENSHOT_PASSWORD を設定してください')
  process.exit(1)
}

// ── 撮影ページ一覧 ───────────────────────────────────────────
const PAGES = [
  { file: '01_login',                   path: '/',                        label: 'ログイン',               skipLogin: true  },
  { file: '02_dashboard',               path: '/dashboard',               label: 'ダッシュボード'                            },
  { file: '03_inventory',               path: '/inventory',               label: '在庫一覧'                                  },
  { file: '05_history',                 path: '/history',                 label: '履歴一覧'                                  },
  { file: '06_calibration_dashboard',   path: '/calibration/dashboard',   label: '校正ダッシュボード'                        },
  { file: '07_calibration_instruments', path: '/calibration/instruments', label: '測定器別校正状況'                          },
  { file: '08_calibration_all',         path: '/calibration/all',         label: '全測定器'                                  },
  { file: '10_instruments',             path: '/instruments',             label: '機器マスター',            adminOnly: true  },
  { file: '11_users',                   path: '/users',                   label: 'ユーザー管理',            adminOnly: true  },
]

// ── サーバー起動待機 ────────────────────────────────────────
async function waitForServer(url, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
      if (res.status < 500) return
    } catch { /* 未起動 */ }
    await new Promise(r => setTimeout(r, 1500))
    process.stdout.write('.')
  }
  throw new Error(`サーバーが ${timeoutMs / 1000} 秒以内に起動しませんでした`)
}

// ── メイン処理 ──────────────────────────────────────────────
async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  // 開発サーバーを起動（NEXT_PUBLIC_ENV を上書きして本番色で起動）
  console.log(`\n🚀 スクリーンショット用サーバーを起動中 (port ${PORT})...`)
  const server = spawn(
    'npx',
    ['next', 'dev', '--port', String(PORT)],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        NEXT_PUBLIC_ENV: '', // "development" を上書き → 本番と同じ見た目で起動
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    }
  )

  server.stdout.on('data', d => {
    const line = d.toString()
    if (line.includes('Ready') || line.includes('ready') || line.includes('error')) {
      process.stdout.write('\n' + line)
    }
  })
  server.stderr.on('data', d => {
    const line = d.toString()
    if (line.includes('Error') || line.includes('error')) process.stderr.write(line)
  })

  try {
    process.stdout.write('待機中')
    await waitForServer(`${BASE_URL}/`)
    console.log('\n✅ サーバー起動完了\n')

    const browser = await chromium.launch()
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    })
    const page = await context.newPage()

    // ── ログイン前の画面（ログインページ）を撮影 ──
    console.log('📸 ログイン画面を撮影...')
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)
    await page.screenshot({ path: resolve(OUT_DIR, '01_login.png') })
    console.log('   → 01_login.png ✓')

    // ── ログイン ──
    console.log('\n🔑 ログイン中...')
    await page.getByLabel(/メール|email/i).fill(EMAIL)
    await page.getByLabel(/パスワード|password/i).fill(PASSWORD)
    await page.getByRole('button', { name: /ログイン|login|sign in/i }).click()
    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 15_000 })
    console.log('✅ ログイン成功\n')

    // ── 各ページを撮影 ──
    for (const pg of PAGES.filter(p => !p.skipLogin)) {
      process.stdout.write(`📸 ${pg.label} を撮影中...`)

      await page.goto(`${BASE_URL}${pg.path}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(3000) // SWR データ読み込み待機

      // 管理者専用ページでリダイレクトされた場合はスキップ
      if (pg.adminOnly && !page.url().includes(pg.path)) {
        console.log(' スキップ（管理者権限がありません）')
        continue
      }

      await page.screenshot({
        path: resolve(OUT_DIR, `${pg.file}.png`),
        fullPage: true,
      })
      console.log(` → ${pg.file}.png ✓`)
    }

    await browser.close()

    console.log(`\n🎉 完了！`)
    console.log(`   保存先: docs/screenshots/ (${PAGES.length} 枚)\n`)

  } finally {
    server.kill('SIGTERM')
    setTimeout(() => server.kill('SIGKILL'), 2000)
  }
}

main().catch(err => {
  console.error('\n❌ エラー:', err.message)
  process.exit(1)
})
