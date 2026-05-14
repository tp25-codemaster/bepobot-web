import type { VercelRequest, VercelResponse } from '@vercel/node'

// Allowlist maps URL path → handler module (prevents path traversal)
const routes: Record<string, string> = {
  'bot-chat': './_handlers/bot-chat.js',
  'bot-checkin': './_handlers/bot-checkin.js',
  'bot-gmail-poll': './_handlers/bot-gmail-poll.js',
  'bot-process-email': './_handlers/bot-process-email.js',
  'bot-reservations': './_handlers/bot-reservations.js',
  'bot-telegram-resolve': './_handlers/bot-telegram-resolve.js',
  'cron-ical-sync': './_handlers/cron-ical-sync.js',
  'evisitor-checkin': './_handlers/evisitor-checkin.js',
  'evisitor-connect': './_handlers/evisitor-connect.js',
  'evisitor-disconnect': './_handlers/evisitor-disconnect.js',
  'evisitor-find-contacts': './_handlers/evisitor-find-contacts.js',
  'evisitor-import': './_handlers/evisitor-import.js',
  'gmail-callback': './_handlers/gmail-callback.js',
  'gmail-connect': './_handlers/gmail-connect.js',
  'gmail-disconnect': './_handlers/gmail-disconnect.js',
  'gmail-refresh': './_handlers/gmail-refresh.js',
  'gmail-watch': './_handlers/gmail-watch.js',
  'gmail-webhook': './_handlers/gmail-webhook.js',
  'ical-export': './_handlers/ical-export.js',
  'ping': './_handlers/ping.js',
  'refresh-gmail-token': './_handlers/refresh-gmail-token.js',
  'register-user': './_handlers/register-user.js',
  'reservation-checkin': './_handlers/reservation-checkin.js',
  'reservation-public': './_handlers/reservation-public.js',
  'reservation-submit': './_handlers/reservation-submit.js',
  'send-email': './_handlers/send-email.js',
  'sync-ical': './_handlers/sync-ical.js',
  'jobs/enqueue': './_handlers/jobs/enqueue.js',
  'jobs/evisitor-import-worker': './_handlers/jobs/evisitor-import-worker.js',
  'jobs/process-booking-email': './_handlers/jobs/process-booking-email.js',
  'jobs/refresh-gmail-tokens': './_handlers/jobs/refresh-gmail-tokens.js',
  'jobs/status': './_handlers/jobs/status.js',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // req.url is the original path before the rewrite, e.g. "/api/ping" or "/api/jobs/enqueue"
  const url = req.url ?? ''
  const path = url.replace(/^\/api\//, '').split('?')[0]

  const modulePath = routes[path]
  if (!modulePath) {
    return res.status(404).json({ error: 'Not found', path })
  }

  const mod = await import(modulePath)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (mod.default as (req: any, res: any) => unknown)(req, res)
}
