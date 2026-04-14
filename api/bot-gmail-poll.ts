// GET /api/bot-gmail-poll
//
// Vercel cron job (svaka 2 min). Za sve connected Gmailove povlači nove
// emailove koji NISU obrađeni (provjerava preko email_log.gmail_message_id),
// filtrira po poznatim booking domenama, i prosljeđuje svaki na
// /api/bot-process-email.
//
// Auth: Vercel postavlja header `Authorization: Bearer $CRON_SECRET` na
// scheduled requestove. Prihvaćamo taj ili BOT_BEARER_TOKEN za ručno triggering.

import { getSupabaseAdmin } from '../server/supabase.js'

interface VercelRequest {
  method?: string
  headers: { [key: string]: string | string[] | undefined }
}
interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (data: unknown) => void
  setHeader: (name: string, value: string) => void
  end: () => void
}

// Od koga tražimo bookinge. Ovo će se proširiti kad imamo prave primjere.
const BOOKING_SENDERS = [
  'booking.com',
  'airbnb.com',
  'noreply@booking.com',
  'automated@airbnb.com',
  'express@airbnb.com',
]

async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string } | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ||
    '590860880888-aq0jlqq7en5klatohs37ec7acuj0t2se.apps.googleusercontent.com'
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET?.trim() ||
    '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'

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    const data = (await res.json()) as { access_token?: string }
    if (!data.access_token) return null
    return { access_token: data.access_token }
  } catch {
    return null
  }
}

interface GmailListResponse {
  messages?: Array<{ id: string }>
  nextPageToken?: string
}

interface GmailMessage {
  id: string
  payload?: {
    headers?: Array<{ name: string; value: string }>
    parts?: Array<{
      mimeType: string
      body?: { data?: string }
      parts?: Array<{ mimeType: string; body?: { data?: string } }>
    }>
    body?: { data?: string }
    mimeType?: string
  }
  internalDate?: string
  snippet?: string
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  try {
    return Buffer.from(normalized, 'base64').toString('utf8')
  } catch {
    return ''
  }
}

function extractBody(msg: GmailMessage): string {
  if (!msg.payload) return msg.snippet || ''
  const { payload } = msg

  // Single-part
  if (payload.body?.data) {
    return base64UrlDecode(payload.body.data)
  }

  // Multipart — prefer text/plain, fall back to text/html stripped
  if (payload.parts) {
    const plain = payload.parts.find((p) => p.mimeType === 'text/plain')
    if (plain?.body?.data) return base64UrlDecode(plain.body.data)
    const html = payload.parts.find((p) => p.mimeType === 'text/html')
    if (html?.body?.data) {
      return base64UrlDecode(html.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    }
    // Nested multipart (alternative)
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = part.parts.find((p) => p.mimeType === 'text/plain')
        if (nested?.body?.data) return base64UrlDecode(nested.body.data)
      }
    }
  }

  return msg.snippet || ''
}

function headerVal(msg: GmailMessage, name: string): string {
  const h = msg.payload?.headers?.find(
    (x) => x.name.toLowerCase() === name.toLowerCase()
  )
  return h?.value || ''
}

async function listNewMessages(
  accessToken: string
): Promise<string[]> {
  // Filter by known booking senders, newer than 2 days (buffer for cron delays)
  const query = BOOKING_SENDERS.map((s) => `from:${s}`).join(' OR ')
  const fullQuery = `(${query}) newer_than:2d`
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(fullQuery)}&maxResults=20`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return []
  const data = (await res.json()) as GmailListResponse
  return (data.messages || []).map((m) => m.id)
}

async function fetchMessage(
  accessToken: string,
  messageId: string
): Promise<GmailMessage | null> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  return (await res.json()) as GmailMessage
}

async function processUser(
  userId: string,
  accessToken: string,
  refreshToken: string | null,
  baseUrl: string,
  botToken: string,
  admin: ReturnType<typeof getSupabaseAdmin>
): Promise<{ userId: string; checked: number; processed: number; errors: string[] }> {
  const errors: string[] = []
  let checked = 0
  let processed = 0
  let currentToken = accessToken

  // Try listing; if 401, refresh and retry once
  let messageIds = await listNewMessages(currentToken)
  if (messageIds.length === 0 && refreshToken) {
    const refreshed = await refreshAccessToken(refreshToken)
    if (refreshed) {
      currentToken = refreshed.access_token
      await admin
        .from('profiles')
        .update({ gmail_access_token: refreshed.access_token })
        .eq('id', userId)
      messageIds = await listNewMessages(currentToken)
    }
  }

  for (const msgId of messageIds) {
    checked++

    // Dedup u email_log
    const { data: existing } = await admin
      .from('email_log')
      .select('id')
      .eq('user_id', userId)
      .eq('gmail_message_id', msgId)
      .maybeSingle()
    if (existing) continue

    const msg = await fetchMessage(currentToken, msgId)
    if (!msg) {
      errors.push(`fetch failed: ${msgId}`)
      continue
    }

    const from = headerVal(msg, 'From')
    const subject = headerVal(msg, 'Subject')
    const date = headerVal(msg, 'Date')
    const body = extractBody(msg)

    // Forward to process-email endpoint
    try {
      const res = await fetch(`${baseUrl}/api/bot-process-email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          gmail_message_id: msgId,
          email_from: from,
          email_subject: subject,
          email_body: body.slice(0, 8000), // truncate huge bodies
          email_received_at: date || null,
        }),
      })
      if (res.ok) {
        processed++
      } else {
        errors.push(`process ${msgId}: HTTP ${res.status}`)
      }
    } catch (e) {
      errors.push(`process ${msgId}: ${(e as Error).message}`)
    }
  }

  return { userId, checked, processed, errors }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const cronSecret = process.env.CRON_SECRET
  const botToken = process.env.BOT_BEARER_TOKEN
  const authHeader = (req.headers.authorization ||
    req.headers.Authorization) as string | undefined
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()

  // Prihvaćamo ILI cron secret (Vercel ga šalje) ILI bot bearer token (za manual)
  const authorized =
    (cronSecret && token === cronSecret) ||
    (botToken && token === botToken)

  if (!authorized) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return
  }

  if (!botToken) {
    res
      .status(500)
      .json({ success: false, error: 'BOT_BEARER_TOKEN not configured' })
    return
  }

  const admin = getSupabaseAdmin()

  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, gmail_access_token, gmail_refresh_token, gmail_connected')
    .eq('gmail_connected', true)
    .not('gmail_access_token', 'is', null)

  if (error) {
    res.status(500).json({ success: false, error: error.message })
    return
  }

  const baseUrl =
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://bepobot-web-bepo1.vercel.app'

  const results = []
  for (const p of profiles || []) {
    try {
      const r = await processUser(
        p.id as string,
        p.gmail_access_token as string,
        (p.gmail_refresh_token as string) || null,
        baseUrl,
        botToken,
        admin
      )
      results.push(r)
    } catch (e) {
      results.push({
        userId: p.id,
        checked: 0,
        processed: 0,
        errors: [(e as Error).message],
      })
    }
  }

  res.status(200).json({
    success: true,
    users_polled: results.length,
    results,
  })
}
