import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { apiWriteLimiter, uploadLimiter, checkRateLimit } from '@/lib/ratelimit'

// Cloudflare (OpenNext) は Edge Middleware のみ対応のため、Next.js 16 の新 Proxy 規約は使えない。
// Edge runtime を維持するため legacy middleware.ts のままにしている。
// 参考: node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md:629

const UPLOAD_PATH = '/api/calibration/upload'
const WRITE_API_PATHS = [
  '/api/instruments/delete',
  '/api/calibration/records',
  '/api/calibration/setup',
  '/api/users/invite',
  '/api/users/delete',
  '/api/users/update',
]

function getIp(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (request.method === 'POST') {
    const ip = getIp(request)

    if (pathname === UPLOAD_PATH) {
      const { success } = await checkRateLimit(uploadLimiter, `upload:${ip}`)
      if (!success) {
        return Response.json({ error: 'リクエストが多すぎます。しばらく待ってから再試行してください。' }, { status: 429 })
      }
    } else if (WRITE_API_PATHS.includes(pathname)) {
      const { success } = await checkRateLimit(apiWriteLimiter, `api:${ip}`)
      if (!success) {
        return Response.json({ error: 'リクエストが多すぎます。しばらく待ってから再試行してください。' }, { status: 429 })
      }
    }
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  if (pathname === '/') {
    if (session) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return supabaseResponse
  }

  if (!session) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
