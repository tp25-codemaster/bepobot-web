// POST /api/jobs/process-booking-email
//
// QStash worker — fetcha email sa Gmail API, parsira ga s Anthropic Claude Haiku
// (prompt caching na system promptu), dedupira i insertira u pending_reservations.
//
// Payload: { user_id, email_id, gmail_access_token, gmail_email }
// Caller: Cloudflare Worker (Gmail Push Notifications → QStash → ovdje)

import { getSupabaseAdmin } from '../../server/supabase.js'
import { verifyQStash } from '../_lib/qstash.js'

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
  gmail_access_token: string
  gmail_email: string
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

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

// Cached after first call — eliminira 90% input token troška na system promptu
const EMAIL_PARSER_SYSTEM = `Ti si parser koji cita email i odlucuje je li to nova rezervacija za iznajmljivaca apartmana u Hrvatskoj.

Zadatak: ekstrahiraj kljucne podatke u strukturirani JSON kroz tool call booking_data.

Pravila:
- Ako email NIJE rezervacija (newsletter, marketing, bill, reply, itd.) postavi is_booking=false i navedi razlog u reason_if_not.
- Ako email JEST rezervacija, ispuni polja. Za polja koja nisu dostupna, postavi null.
- Datumi MORAJU biti u formatu YYYY-MM-DD. Ako pise "15. lipnja 2026" pretvori u "2026-06-15".
- apartment_name je kljuc da mapiramo na host-ov apartman (npr. "Villa Panorama", "Apartman 2"). Ako nije eksplicitno, stavi null.
- source: booking.com ako je email s @booking.com, airbnb ako je s @airbnb.com, direct ako je direct inquiry, other inace.
- Na temelju from emaila mozes brzo odluciti izvor.
- Ako podaci su dvosmisleni postavi confidence=low.
- Ne izmisljaj. Ako nesto ne vidis u tekstu, ostavi null.`

const BOOKING_TOOL = {
  name: 'booking_data',
  description: 'Vraca strukturirane podatke parsirane iz email-a',
  input_schema: {
    type: 'object',
    properties: {
      is_booking: { type: 'boolean' },
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
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { parsed: null, error: 'ANTHROPIC_API_KEY not set' }

  const userContent =
    `Email metapodaci:\nFrom: ${from || '(nepoznato)'}\nSubject: ${subject || '(bez subjecta)'}\nReceived: ${receivedAt}\n\n` +
    `Tijelo emaila:\n${body.slice(0, 8000) || '(prazno)'}`

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 600,
        temperature: 0.1,
        system: [{ type: 'text', text: EMAIL_PARSER_SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userContent }],
        tools: [BOOKING_TOOL],
        tool_choice: { type: 'tool', name: 'booking_data' },
      }),
    })
    const data = (await res.json()) as {
      content?: Array<{ type: string; input: Record<string, unknown> }>
      error?: { message?: string }
    }
    if (!res.ok) {
      return { parsed: null, error: 'Anthropic: ' + (data.error?.message || `HTTP ${res.status}`) }
    }
    const toolUse = data.content?.find((c) => c.type === 'tool_use')
    if (!toolUse) return { parsed: null, error: 'Anthropic did not return tool_use' }
    return { parsed: toolUse.input as ParsedBooking }
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
  const { user_id, email_id, gmail_access_token } = payload

  if (!user_id || !email_id || !gmail_access_token) {
    res.status(400).json({ error: 'Missing required fields: user_id, email_id, gmail_access_token' })
    return
  }

  const admin = getSupabaseAdmin()

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
    // Return 200 — QStash ne treba retryati, Gmail fetch error je transient
    res.status(200).json({ success: false, error: 'Gmail fetch failed' })
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
    res.status(200).json({ success: false, error: parseErr || 'Parse failed' })
    return
  }

  if (!parsed.is_booking) {
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
    res.status(500).json({ success: false, error: 'Insert failed: ' + insertErr.message })
    return
  }

  res.status(200).json({ success: true, action: 'created' })
}
