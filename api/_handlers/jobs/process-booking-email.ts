// POST /api/jobs/process-booking-email
//
// QStash worker — fetcha email sa Gmail API, parsira ga s Anthropic Claude Haiku
// (prompt caching na system promptu), dedupira i insertira u pending_reservations.
//
// Payload: { user_id, email_id }  — token se fetcha iz DB, nikad ne prolazi kroz QStash
// Caller: gmail-webhook.ts (Gmail Push Notifications → QStash → ovdje)

import { getSupabaseAdmin } from '../../../server/supabase.js'
import { verifyQStash } from '../../_lib/qstash.js'
import { safeDecrypt } from '../../../server/crypto.js'

async function updateEmailLogV3(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  emailId: string,
  updates: {
    email_from?: string | null
    email_subject?: string | null
    parsed_booking?: boolean
    reservation_created?: boolean
    error?: string
  }
): Promise<void> {
  try {
    await admin
      .from('email_log_v3')
      .update(updates)
      .eq('user_id', userId)
      .eq('gmail_message_id', emailId)
  } catch (err) {
    console.error('email_log_v3 update failed (non-fatal):', err)
  }
}

interface VercelRequest {
  method?: string
  body: unknown
  headers: { [key: string]: string | string[] | undefined }
}
interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (data: unknown) => void
  end: () => void
}

interface WorkerPayload {
  user_id: string
  email_id: string
}

interface GmailPart {
  mimeType: string
  body?: { data?: string }
  parts?: GmailPart[]
}

interface GmailMessage {
  id: string
  internalDate?: string
  payload?: {
    headers?: Array<{ name: string; value: string }>
    body?: { data?: string }
    parts?: GmailPart[]
  }
}

interface ParsedBooking {
  is_booking: boolean
  is_inquiry?: boolean
  inquiry_summary?: string | null
  reason_if_not?: string
  source?: string
  apartment_name?: string | null
  guest_name?: string | null
  guest_surname?: string | null
  guest_email?: string | null
  guest_phone?: string | null
  guest_count?: number | null
  check_in_date?: string | null
  check_out_date?: string | null
  total_price?: number | null
  currency?: string | null
  confidence?: 'high' | 'medium' | 'low'
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'anthropic/claude-haiku-4.5'

const EMAIL_PARSER_SYSTEM = `Ti si parser koji cita email i odlucuje je li to POTVRĐENA nova rezervacija za iznajmljivaca apartmana u Hrvatskoj.

Zadatak: ekstrahiraj kljucne podatke u strukturirani JSON kroz tool call booking_data.

PRAVILA ZA is_booking:
- TRUE samo ako je email POTVRDA rezervacije (booking confirmation). Mora imati: gost, datumi dolaska/odlaska.
- FALSE za: newsletter, marketing, review request, cancellation, modification request, upit gosta koji jos nije potvrdjen, bills, spam, random emailovi.
- Upit "Can I book June 15-18?" je FALSE — nije potvrda, samo pitanje.
- Cancellation email je FALSE — rezervacija se OTKAZUJE, ne kreira.

UPITI (is_inquiry):
- Ako je is_booking=false ali email IZGLEDA kao upit za rezervaciju (osoba pita za dostupnost, cijenu, uvjete) postavi is_inquiry=true.
- inquiry_summary: kratki sažetak upita na hrvatskom, max 2 rečenice.
- Ako is_booking=true, is_inquiry=false.
- Spam, newsletter, bill → is_inquiry=false.

OSTALA PRAVILA:
- Datumi MORAJU biti YYYY-MM-DD. "15. lipnja 2026" → "2026-06-15".
- source: booking.com/@booking.com, airbnb/@airbnb.com, direct/direct inquiry, other inace.
- Ne izmisljaj. Ako nesto ne vidis u tekstu, ostavi null.`

const BOOKING_TOOL = {
  type: 'function' as const,
  function: {
    name: 'booking_data',
    description: 'Vraca strukturirane podatke parsirane iz email-a',
    parameters: {
      type: 'object',
      properties: {
        is_booking: { type: 'boolean' },
        is_inquiry: { type: 'boolean' },
        inquiry_summary: { type: ['string', 'null'] },
        reason_if_not: { type: 'string' },
        source: { type: 'string', enum: ['booking.com', 'airbnb', 'direct', 'other'] },
        apartment_name: { type: ['string', 'null'] },
        guest_name: { type: ['string', 'null'] },
        guest_surname: { type: ['string', 'null'] },
        guest_email: { type: ['string', 'null'] },
        guest_phone: { type: ['string', 'null'] },
        guest_count: { type: ['integer', 'null'] },
        check_in_date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
        check_out_date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
        total_price: { type: ['number', 'null'] },
        currency: { type: ['string', 'null'] },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
      required: ['is_booking'],
    },
  },
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf-8')
}

function extractBody(msg: GmailMessage): string {
  const payload = msg.payload
  if (!payload) return ''

  if (payload.body?.data) return decodeBase64Url(payload.body.data)

  function findTextPlain(parts?: GmailPart[]): string | null {
    if (!parts) return null
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data)
      }
      const nested = findTextPlain(part.parts)
      if (nested) return nested
    }
    return null
  }

  return findTextPlain(payload.parts) || ''
}

function getHeader(msg: GmailMessage, name: string): string {
  return (
    msg.payload?.headers?.find(
      (h) => h.name.toLowerCase() === name.toLowerCase()
    )?.value || ''
  )
}

async function fetchGmailMessage(
  emailId: string,
  accessToken: string
): Promise<GmailMessage | null> {
  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok) return null
    return res.json() as Promise<GmailMessage>
  } catch {
    return null
  }
}

async function parseWithAnthropic(
  from: string,
  subject: string,
  body: string,
  receivedAt: string
): Promise<{ parsed: ParsedBooking | null; error?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return { parsed: null, error: 'OPENROUTER_API_KEY not set' }

  const userContent =
    `Email metapodaci:\nFrom: ${from || '(nepoznato)'}\nSubject: ${subject || '(bez subjecta)'}\nReceived: ${receivedAt}\n\n` +
    `Tijelo emaila:\n${body.slice(0, 8000) || '(prazno)'}`

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://bepobot-web.vercel.app',
        'X-Title': 'BepoBot Email Parser',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: EMAIL_PARSER_SYSTEM },
          { role: 'user', content: userContent },
        ],
        tools: [BOOKING_TOOL],
        tool_choice: { type: 'function', function: { name: 'booking_data' } },
        max_tokens: 1500,
        temperature: 0.1,
      }),
    })
    const data = (await res.json()) as {
      choices?: Array<{ message?: { tool_calls?: Array<{ function: { arguments: string } }> } }>
      error?: { message?: string }
    }
    if (!res.ok) {
      return { parsed: null, error: 'LLM: ' + (data.error?.message || `HTTP ${res.status}`) }
    }
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0]
    if (!toolCall) return { parsed: null, error: 'LLM did not return tool_call' }
    return { parsed: JSON.parse(toolCall.function.arguments) as ParsedBooking }
  } catch (e) {
    return { parsed: null, error: (e as Error).message }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const valid = await verifyQStash(req)
  if (!valid) {
    res.status(401).json({ error: 'Invalid QStash signature' })
    return
  }

  const payload = (req.body || {}) as Partial<WorkerPayload>
  const { user_id, email_id } = payload

  if (!user_id || !email_id) {
    res.status(400).json({ error: 'Missing required fields: user_id, email_id' })
    return
  }

  const admin = getSupabaseAdmin()

  // Refresh access token (expires every hour)
  const emailApiSecret = (process.env.EMAIL_API_SECRET || '').trim()
  const appUrl = (process.env.APP_URL || 'https://bepobot-web.vercel.app').replace(/\/$/, '')
  let gmail_access_token = ''
  if (emailApiSecret) {
    try {
      const refreshRes = await fetch(`${appUrl}/api/gmail-refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id, secret: emailApiSecret }),
      })
      const refreshData = await refreshRes.json() as { success?: boolean; access_token?: string }
      if (refreshData.success && refreshData.access_token) {
        gmail_access_token = refreshData.access_token
      }
    } catch { /* fallback to stored token */ }
  }

  // Fallback: use stored token if refresh failed
  if (!gmail_access_token) {
    const { data: profile } = await admin
      .from('profiles')
      .select('gmail_access_token')
      .eq('id', user_id)
      .single()
    if (!profile?.gmail_access_token) {
      res.status(400).json({ error: 'No Gmail access token for user' })
      return
    }
    gmail_access_token = safeDecrypt(profile.gmail_access_token)
  }

  // 1. Dedup — provjeri je li email već procesiran
  const { data: existing } = await admin
    .from('pending_reservations')
    .select('id')
    .eq('user_id', user_id)
    .eq('gmail_message_id', email_id)
    .maybeSingle()

  if (existing) {
    res.status(200).json({ success: true, duplicate: true })
    return
  }

  // 2. Fetch email sa Gmail API
  const msg = await fetchGmailMessage(email_id, gmail_access_token)
  if (!msg) {
    console.error(`[process-email] Gmail fetch failed for email_id=${email_id} user_id=${user_id}`)
    res.status(500).json({ success: false, error: 'Gmail fetch failed' })
    return
  }

  const from = getHeader(msg, 'from')
  const subject = getHeader(msg, 'subject')
  const body = extractBody(msg)
  const receivedAt = msg.internalDate
    ? new Date(parseInt(msg.internalDate, 10)).toISOString()
    : new Date().toISOString()

  // 3. Parse s Anthropic (system prompt se cachira od drugog requesta)
  const { parsed, error: parseErr } = await parseWithAnthropic(from, subject, body, receivedAt)

  if (!parsed) {
    console.error(`[process-email] Anthropic parse failed: ${parseErr}`)
    res.status(500).json({ success: false, error: parseErr || 'Parse failed' })
    return
  }

  if (!parsed.is_booking) {
    await updateEmailLogV3(admin, user_id, email_id, {
      email_from: from || null,
      email_subject: subject || null,
      parsed_booking: false,
      reservation_created: false,
    })
    res.status(200).json({
      success: true,
      action: 'not_booking',
      reason: parsed.reason_if_not || 'Not a booking email',
    })
    return
  }

  // 4. Insert u pending_reservations — host potvrđuje ručno
  const guestName =
    [parsed.guest_name, parsed.guest_surname].filter(Boolean).join(' ').trim() || null

  const { error: insertErr } = await admin.from('pending_reservations').insert({
    user_id,
    gmail_message_id: email_id,
    email_from: from || null,
    email_subject: subject || null,
    email_received_at: receivedAt,
    parsed_data: parsed,
    guest_name: guestName,
    guest_email: parsed.guest_email || null,
    guest_phone: parsed.guest_phone || null,
    check_in: parsed.check_in_date || null,
    check_out: parsed.check_out_date || null,
    source: parsed.source || 'other',
    apartment_name_raw: parsed.apartment_name || null,
    confidence: parsed.confidence || 'low',
    status: 'pending',
  })

  if (insertErr) {
    await updateEmailLogV3(admin, user_id, email_id, {
      email_from: from || null,
      email_subject: subject || null,
      parsed_booking: true,
      reservation_created: false,
      error: insertErr.message,
    })
    res.status(500).json({ success: false, error: 'Insert failed: ' + insertErr.message })
    return
  }

  await updateEmailLogV3(admin, user_id, email_id, {
    email_from: from || null,
    email_subject: subject || null,
    parsed_booking: true,
    reservation_created: true,
  })
  res.status(200).json({ success: true, action: 'created' })
}
