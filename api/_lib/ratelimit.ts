// Shared rate limiting helper using Upstash Redis.
//
// Usage:
//   import { checkRateLimit } from './_lib/ratelimit.js'
//
//   const limited = await checkRateLimit('bot-chat', userId, { requests: 30, window: '1m' })
//   if (limited) return res.status(429).json({ error: 'Too many requests' })
//
// Free tier (Upstash): 10,000 requests/day.
// No-op in dev/without env vars set.

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const UPSTASH_REDIS_REST_URL = (process.env.UPSTASH_REDIS_REST_URL || '').trim()
const UPSTASH_REDIS_REST_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || '').trim()

let redis: Redis | null = null
const limiters = new Map<string, Ratelimit>()

function getRedis(): Redis | null {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return null
  if (!redis) {
    redis = new Redis({
      url: UPSTASH_REDIS_REST_URL,
      token: UPSTASH_REDIS_REST_TOKEN,
    })
  }
  return redis
}

/** Exposes the shared Redis client for use outside rate limiting (e.g. OAuth state). */
export function getRedisClient(): Redis | null {
  return getRedis()
}

type Duration = `${number} ${'s' | 'm' | 'h' | 'd'}` | `${number}${'s' | 'm' | 'h' | 'd'}`

/**
 * Check rate limit for a given key + identifier.
 * Returns true if request is ALLOWED, false if rate limited.
 */
export async function checkRateLimit(
  namespace: string,
  identifier: string,
  options: { requests: number; window: Duration },
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  const r = getRedis()
  if (!r) {
    // No Redis configured — always allow (dev mode)
    return { allowed: true, remaining: 999, reset: 0 }
  }

  const key = `${namespace}:${options.requests}:${options.window}`
  let limiter = limiters.get(key)
  if (!limiter) {
    limiter = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(options.requests, options.window),
      analytics: false,
      prefix: `ratelimit:${namespace}`,
    })
    limiters.set(key, limiter)
  }

  try {
    const result = await limiter.limit(identifier)
    return {
      allowed: result.success,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch (err) {
    // Redis is configured but unavailable — fail closed to prevent rate-limit bypass
    console.error('Ratelimit error (Redis unavailable):', err)
    return { allowed: false, remaining: 0, reset: 0 }
  }
}

/**
 * Common limits for different endpoint types.
 */
export const LIMITS = {
  // User-scoped: per-user per-minute
  BOT_CHAT: { requests: 30, window: '1m' as Duration },
  EXPENSIVE: { requests: 10, window: '1m' as Duration },
  // Bot endpoints: per user_id or telegram_id
  BOT_ENDPOINT: { requests: 20, window: '1m' as Duration },
  PAIRING: { requests: 5, window: '5m' as Duration },
  // IP-scoped: public endpoints
  PUBLIC: { requests: 60, window: '1m' as Duration },
  PUBLIC_STRICT: { requests: 10, window: '1m' as Duration },
  // Token-scoped: per reservation token (brute-force protection)
  PUBLIC_TOKEN: { requests: 30, window: '1m' as Duration },
  PUBLIC_TOKEN_STRICT: { requests: 5, window: '1m' as Duration },
} as const
