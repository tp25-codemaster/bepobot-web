// POST /api/gmail-watch
//
// Registers a Gmail watch (push notification subscription) for a user.
// Also used as a daily cron to renew watches (they expire after 7 days).
//
// Two modes:
//   1. User-authed POST (when user connects Gmail) — registers watch for one user
//   2. Cron-authed GET — renews all active watches (run daily)
//
// Auth:
//   - JWT (user) for one-time registration
//   - BOT_BEARER_TOKEN (or CRON_SECRET) for renewal cron

import { getUserSupabase, getCurrentUser, getSupabaseAdmin } from '../server/supabase.js'
import { setCorsHeaders } from './_lib/cors.js'

interface VercelRequest {
  method?: string
  query: { [key: string]: string | string[] | undefined }
  body: unknown
  headers: { [key: string]: string | string[] | undefined }
}
interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (data: unknown) => void
  setHeader: (name: string, value: string) => void
  end: () => void
}

// Pub/Sub topic name — set via env var
const GMAIL_PUBSUB_TOPIC =
  process.env.GMAIL_PUBSUB_TOPIC ||
  'projects/n8n-invoice-484123/topics/gmail-webhook-topic'

async function refreshAccessToken(userId: string): Promise<string | null> {
  const secret = (process.env.EMAIL_API_SECRET || '').trim()
  if (!secret) return null
  try {
    const res = await fetch('https://bepobot-web.vercel.app/api/gmail-refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, secret }),
    })
    const data = await res.json() as { success?: boolean; access_token?: string }
    return data.success && data.access_token ? data.access_token : null
  } catch {
    return null
  }
}

async function registerWatch(
  accessToken: string,
): Promise<{ historyId: string; expiration: string } | null> {
  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topicName: GMAIL_PUBSUB_TOPIC,
        labelIds: ['INBOX'],
        labelFilterBehavior: 'INCLUDE',
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('Gmail watch failed:', res.status, err)
      return null
    }
    const data = await res.json() as { historyId: string; expiration: string }
    return data
  } catch (err) {
    console.error('Gmail watch error:', err)
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, 'POST, GET, OPTIONS')

  if (req.method === 'OPTIONS') { res.status(204).end(); return }

  const authHeader = (req.headers.authorization || req.headers.Authorization) as string | undefined
  const botToken = (process.env.BOT_BEARER_TOKEN || '').trim()
  const isBotAuth = botToken && authHeader === `Bearer ${botToken}`

  // === CRON MODE: renew all active watches ===
  if (req.method === 'GET' && isBotAuth) {
    const admin = getSupabaseAdmin()
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, gmail_email, gmail_watch_expiration')
      .eq('gmail_connected', true)

    if (!profiles || profiles.length === 0) {
      res.status(200).json({ success: true, renewed: 0, message: 'No users to renew' })
      return
    }

    // Only renew watches expiring in next 24h
    const cutoff = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    let renewed = 0
    let failed = 0

    for (const p of profiles) {
      const needsRenewal = !p.gmail_watch_expiration || p.gmail_watch_expiration < cutoff
      if (!needsRenewal) continue

      const token = await refreshAccessToken(p.id)
      if (!token) { failed++; continue }

      const watch = await registerWatch(token)
      if (!watch) { failed++; continue }

      await admin
        .from('profiles')
        .update({
          gmail_last_history_id: watch.historyId,
          gmail_watch_expiration: new Date(parseInt(watch.expiration, 10)).toISOString(),
        })
        .eq('id', p.id)
      renewed++
    }

    res.status(200).json({ success: true, renewed, failed, total: profiles.length })
    return
  }

  // === USER MODE: register watch for one user ===
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const supabase = getUserSupabase(authHeader)
  if (!supabase) { res.status(401).json({ error: 'Unauthorized' }); return }
  const user = await getCurrentUser(supabase)
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return }

  const token = await refreshAccessToken(user.id)
  if (!token) {
    res.status(400).json({ error: 'Failed to refresh access token. Reconnect Gmail.' })
    return
  }

  const watch = await registerWatch(token)
  if (!watch) {
    res.status(500).json({ error: 'Failed to register Gmail watch. Check Pub/Sub topic config.' })
    return
  }

  const admin = getSupabaseAdmin()
  await admin
    .from('profiles')
    .update({
      gmail_last_history_id: watch.historyId,
      gmail_watch_expiration: new Date(parseInt(watch.expiration, 10)).toISOString(),
    })
    .eq('id', user.id)

  res.status(200).json({
    success: true,
    historyId: watch.historyId,
    expiration: watch.expiration,
  })
}
