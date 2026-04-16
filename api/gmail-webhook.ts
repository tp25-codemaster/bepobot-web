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
//   3. Create Pub/Sub subscription (push):
//      Endpoint: https://bepobot-web.vercel.app/api/gmail-webhook
//      Ack deadline: 600s
//      No authentication (we validate via the email lookup itself)

import { getSupabaseAdmin } from '../server/supabase.js'

interface VercelRequest {
  method?: string
  body: unknown
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

async function callProcessEmail(userId: string, email: {
  id: string
  from: string
  subject: string
  body: string
  receivedAt: string
}): Promise<void> {
  const secret = (process.env.BOT_BEARER_TOKEN || '').trim()
  if (!secret) {
    console.error('BOT_BEARER_TOKEN not set')
    return
  }
  try {
    await fetch('https://bepobot-web.vercel.app/api/bot-process-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        user_id: userId,
        gmail_message_id: email.id,
        email_from: email.from,
        email_subject: email.subject,
        email_body: email.body,
        email_received_at: email.receivedAt,
      }),
    })
  } catch (err) {
    console.error('Failed to call bot-process-email:', err)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
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
    res.status(204).end()
    return
  }

  // Fetch history from last known historyId (or current historyId - 1)
  const lastHistoryId = profile.gmail_last_history_id || historyId
  const messageIds = await fetchGmailHistory(accessToken, lastHistoryId)

  // Limit to 10 per push to avoid function timeout
  for (const msgId of messageIds.slice(0, 10)) {
    const email = await fetchGmailMessage(accessToken, msgId)
    if (!email) continue

    // Only process booking-looking emails (basic filter)
    const fromLower = email.from.toLowerCase()
    const subjectLower = email.subject.toLowerCase()
    const isBookingCandidate =
      fromLower.includes('booking.com') ||
      fromLower.includes('airbnb.com') ||
      subjectLower.includes('reservation') ||
      subjectLower.includes('booking') ||
      subjectLower.includes('rezervacij')
    if (!isBookingCandidate) continue

    await callProcessEmail(profile.id, email)
  }

  // Update last historyId so we don't reprocess on next push
  await supabase
    .from('profiles')
    .update({ gmail_last_history_id: historyId })
    .eq('id', profile.id)

  // ACK the push
  res.status(204).end()
}
