// POST /api/gmail-webhook
//
// Google Cloud Pub/Sub push endpoint for Gmail notifications.
//
// Flow:
//   1. Google Pub/Sub pushes { message: { data: <base64-json> } }
//   2. Decode data → { emailAddress, historyId }
//   3. Look up user by emailAddress (profiles.gmail_email)
//   4. Fetch Gmail history since last historyId → get new message IDs
//   5. For each new message → fetch email → call bot-process-email
//   6. Update last_history_id in profile
//
// This replaces n8n polling workflow (Gmail Booking Monitor v2).
// Scales to unlimited users because Google pushes to us instead of us polling.
//
// Setup (one-time manual steps):
//   1. Create Pub/Sub topic: gmail-webhook-topic in Google Cloud Console
//   2. Give Gmail publish permission on the topic
//      Service account: gmail-api-push@system.gserviceaccount.com
//      Role: Pub/Sub Publisher
//   3. Set env var: PUBSUB_WEBHOOK_SECRET=<random 32+ char secret>
//   4. Create Pub/Sub subscription (push):
//      Endpoint: https://bepobot-web.vercel.app/api/gmail-webhook?token=<PUBSUB_WEBHOOK_SECRET>
//      Ack deadline: 600s

import { getSupabaseAdmin } from '../server/supabase.js'
import { Client } from '@upstash/qstash'

interface VercelRequest {
  method?: string
  body: unknown
  query: { [key: string]: string | string[] | undefined }
  headers: { [key: string]: string | string[] | undefined }
}
interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (data: unknown) => void
  setHeader: (name: string, value: string) => void
  end: () => void
}

interface PubSubMessage {
  message?: {
    data?: string
    messageId?: string
    publishTime?: string
  }
  subscription?: string
}

interface GmailNotification {
  emailAddress: string
  historyId: string
}

async function refreshToken(userId: string): Promise<string | null> {
  // Call our own refresh endpoint internally
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

async function fetchGmailHistory(
  accessToken: string,
  startHistoryId: string,
): Promise<string[]> {
  // Fetch history.list to get message IDs added since last historyId
  // https://developers.google.com/gmail/api/reference/rest/v1/users.history/list
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${startHistoryId}&historyTypes=messageAdded`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    console.error('Gmail history fetch failed:', res.status, await res.text())
    return []
  }
  const data = await res.json() as {
    history?: Array<{ messagesAdded?: Array<{ message: { id: string } }> }>
  }
  const ids = new Set<string>()
  for (const h of data.history || []) {
    for (const m of h.messagesAdded || []) {
      ids.add(m.message.id)
    }
  }
  return Array.from(ids)
}

async function fetchGmailMessage(
  accessToken: string,
  messageId: string,
): Promise<{
  id: string
  from: string
  subject: string
  body: string
  receivedAt: string
} | null> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const data = await res.json() as {
    id: string
    internalDate: string
    payload: {
      headers: Array<{ name: string; value: string }>
      parts?: Array<{ mimeType: string; body?: { data?: string } }>
      body?: { data?: string }
    }
    snippet?: string
  }

  const headers = data.payload?.headers || []
  const getHeader = (name: string) =>
    (headers.find((h) => h.name.toLowerCase() === name.toLowerCase()) || { value: '' }).value

  // Extract body (plain text preferred)
  let body = ''
  const parts = data.payload?.parts || (data.payload ? [data.payload] : [])
  for (const part of parts) {
    if (part?.mimeType === 'text/plain' && part?.body?.data) {
      body = Buffer.from(part.body.data, 'base64').toString('utf-8')
      break
    }
  }
  if (!body && data.payload?.body?.data) {
    body = Buffer.from(data.payload.body.data, 'base64').toString('utf-8')
  }
  if (!body) body = data.snippet || ''

  return {
    id: data.id,
    from: getHeader('From'),
    subject: getHeader('Subject'),
    body: body.substring(0, 5000),
    receivedAt: data.internalDate
      ? new Date(parseInt(data.internalDate, 10)).toISOString()
      : new Date().toISOString(),
  }
}

const APP_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'https://bepobot-web.vercel.app'

async function enqueueEmailJob(
  userId: string,
  messageId: string,
): Promise<void> {
  const token = (process.env.QSTASH_TOKEN || '').trim()
  if (!token) {
    console.error('QSTASH_TOKEN not set — falling back to sync processing')
    return
  }
  try {
    const qstash = new Client({ token })
    await qstash.publishJSON({
      url: `${APP_URL}/api/jobs/process-booking-email`,
      body: {
        user_id: userId,
        email_id: messageId,
      },
      retries: 3,
    })
  } catch (err) {
    console.error('Failed to enqueue email job:', err)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // Validate shared secret — set PUBSUB_WEBHOOK_SECRET and include in subscription URL as ?token=<secret>
  const webhookSecret = (process.env.PUBSUB_WEBHOOK_SECRET || '').trim()
  if (!webhookSecret) {
    console.error('PUBSUB_WEBHOOK_SECRET not configured')
    res.status(500).end()
    return
  }
  const incomingToken = (req.query.token as string | undefined) || ''
  if (incomingToken !== webhookSecret) {
    res.status(401).end()
    return
  }

  // Parse Pub/Sub push envelope
  const body = req.body as PubSubMessage
  const rawData = body?.message?.data
  if (!rawData) {
    // ACK to prevent retries for malformed messages
    res.status(204).end()
    return
  }

  let notification: GmailNotification
  try {
    const decoded = Buffer.from(rawData, 'base64').toString('utf-8')
    notification = JSON.parse(decoded)
  } catch (err) {
    console.error('Failed to parse Pub/Sub message:', err)
    res.status(204).end()
    return
  }

  const { emailAddress, historyId } = notification
  if (!emailAddress || !historyId) {
    res.status(204).end()
    return
  }

  // Look up user by Gmail email address
  const supabase = getSupabaseAdmin()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, gmail_last_history_id')
    .eq('gmail_email', emailAddress)
    .eq('gmail_connected', true)
    .single()

  if (!profile) {
    console.log(`No connected user found for ${emailAddress}`)
    res.status(204).end()
    return
  }

  // Refresh access token (always fresh for webhook)
  const accessToken = await refreshToken(profile.id)
  if (!accessToken) {
    console.error(`Failed to refresh token for ${profile.id}`)
    // Return 500 so Pub/Sub retries. If token was revoked, gmail-refresh already set
    // gmail_connected=false, so the next retry will find no profile and ACK cleanly.
    res.status(500).end()
    return
  }

  // Fetch history from last known historyId (or current historyId - 1)
  const lastHistoryId = profile.gmail_last_history_id || historyId
  const messageIds = await fetchGmailHistory(accessToken, lastHistoryId)

  // Enqueue each new message as a QStash job (async, retries built-in)
  // Limit to 20 per push to stay within Vercel function timeout
  for (const msgId of messageIds.slice(0, 20)) {
    await enqueueEmailJob(profile.id, msgId)
  }

  // Update last historyId so we don't reprocess on next push
  await supabase
    .from('profiles')
    .update({ gmail_last_history_id: historyId })
    .eq('id', profile.id)

  // ACK the push
  res.status(204).end()
}
