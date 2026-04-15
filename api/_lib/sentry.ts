// Shared Sentry setup for Vercel API routes.
//
// Usage:
//   import { withSentry, captureError } from './_lib/sentry.js'
//
//   export default withSentry(async (req, res) => {
//     // ... your handler
//   })
//
// Auto-captures:
// - Uncaught exceptions (returns 500 + logs to Sentry)
// - Manual captureError() calls for non-fatal errors
// - Adds user context if available

import * as Sentry from '@sentry/node'

let initialized = false

function ensureInit() {
  if (initialized) return
  const dsn = process.env.SENTRY_DSN
  if (!dsn) {
    // No DSN set — run as no-op in dev
    initialized = true
    return
  }
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || 'development',
    tracesSampleRate: 0.1, // 10% of transactions
    // Don't send PII
    sendDefaultPii: false,
  })
  initialized = true
}

interface VercelRequest {
  method?: string
  url?: string
  body: unknown
  headers: { [key: string]: string | string[] | undefined }
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (data: unknown) => void
  setHeader: (name: string, value: string) => void
  end: () => void
}

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void> | void

/**
 * Wraps a Vercel API handler to auto-capture exceptions to Sentry.
 * Adds request URL as tag, returns 500 on unhandled error.
 */
export function withSentry(handler: Handler): Handler {
  return async (req: VercelRequest, res: VercelResponse) => {
    ensureInit()
    try {
      await handler(req, res)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      Sentry.withScope((scope) => {
        scope.setTag('route', req.url || 'unknown')
        scope.setTag('method', req.method || 'unknown')
        Sentry.captureException(error)
      })
      // Flush so event is sent before function returns
      await Sentry.flush(2000).catch(() => {})

      if (!(res as unknown as { headersSent?: boolean }).headersSent) {
        try {
          res.status(500).json({
            success: false,
            error: 'Internal server error',
          })
        } catch {
          /* ignore */
        }
      }
    }
  }
}

/**
 * Manually capture a non-fatal error (won't 500 the response).
 */
export function captureError(
  error: unknown,
  context?: Record<string, unknown>
) {
  ensureInit()
  const err = error instanceof Error ? error : new Error(String(error))
  Sentry.withScope((scope) => {
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        scope.setExtra(key, value)
      }
    }
    Sentry.captureException(err)
  })
}

/**
 * Attach user context to the current Sentry scope.
 * Call after authenticating the user in your handler.
 */
export function setSentryUser(userId: string) {
  ensureInit()
  Sentry.setUser({ id: userId })
}
