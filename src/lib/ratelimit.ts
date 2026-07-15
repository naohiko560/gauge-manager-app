import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

function createRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

const redis = createRedis()

// 書き込みAPI: 30回/分
export const apiWriteLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 m'), prefix: 'rl:api' })
  : null

// ファイルアップロード: 10回/時
export const uploadLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 h'), prefix: 'rl:upload' })
  : null

export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ success: boolean }> {
  if (!limiter) return { success: true }
  return limiter.limit(identifier)
}
