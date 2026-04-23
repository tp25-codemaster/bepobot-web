// POST /api/bot-process-email
//
// Procesuje jedan email. End-to-end:
//   1. Deduplikacija po gmail_message_id
//   2. Claude Haiku parse (generic prompt — bit će zamijenjen s few-shot kad
//      stignu pravi primjeri iz Booking.com / Airbnb)
//   3. Ako je booking → pronađi apartman po imenu
//   4. Conflict check
//   5. Ako je clean → kreira rezervaciju + token (guest self-checkin link)
//   6. Upiše sve u email_log
//
// Auth: shared BOT_BEARER_TOKEN (zove ga cron job, ne browser).
//
// NAPOMENA: sistem prompt je GENERIC — vjerojatno će griješiti na exotic
// formatima mailova. Kad Tonko pošalje prave primjere, refaktoriraj s few-shot.

import { getSupabaseAdmin } from '../server/supabase.js'
import { findConflicts } from '../server/conflict-check.js'
import { randomUUID, randomBytes } from 'node:crypto'
import { checkRateLimit, LIMITS } from './_lib/ratelimit.js'
import { setCorsHeaders } from './_lib/cors.js'

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

interface EmailPayload {
  user_id: string
  gmail_message_id?: string
  email_from?: string
  email_subject?: string
  email_body?: string
  email_received_at?: string
}

interface ParsedBooking {
  is_booking: boolean
  reason_if_not?: string
  source?: 'booking.com' | 'airbnb' | 'direct' | 'other'
  apartment_name?: string | null
  guest_name?: string | null
  guest_surname?: string | null
  guest_email?: string | null
  guest_phone?: string | null
  guest_count?: number | null
  check_in_date?: string | null // YYYY-MM-DD
  check_out_date?: string | null // YYYY-MM-DD
  total_price?: number | null
  currency?: string | null
  confidence?: 'high' | 'medium' | 'low'
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5'

const SYSTEM_PROMPT = `Ti si parser koji cita email i odlucuje je li to nova rezervacija za iznajmljivaca apartmana u Hrvatskoj.

Zadatak: ekstrahiraj kljucne podatke u strukturirani JSON kroz tool call booking_data.

Pravila:
- Ako email NIJE rezervacija (newsletter, marketing, bill, reply, itd.) postavi is_booking=false i navedi razlog u reason_if_not.
- Ako email JEST rezervacija, ispuni polja. Za polja koja nisu dostupna, postavi null.
- Datumi MORAJU biti u formatu YYYY-MM-DD. Ako u emailu pise "15. lipnja 2026" pretvori u "2026-06-15".
- apartment_name je kljuc da mapiramo na host-ov apartman (npr. "Villa Panorama", "Apartman 2", "Galerija"). Ako nije eksplicitno, stavi null.
- source: booking.com ako je email s @booking.com, airbnb ako je s @airbnb.com, direct ako je direct inquiry, other inace.
- Pazi — na temelju from emaila mozes brzo odluciti izvor. Npr. no-reply@booking.com → booking.com.
- Ako podaci su dvosmisleni (npr. datumi mogu biti i dolazak i odlazak) postavi confidence=low.

Ne izmisljaj. Ako nesto ne vidis u tekstu, ostavi null.`

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

if (!process.env.BOT_BEARER_TOKEN) {
  // BOT_BEARER_TOKEN rotation: set new value in Vercel env vars, update all callers
  // (bot-gmail-poll, n8n workflows, Telegram bot) to use the new token, then remove the old one.
  // There is no grace period — rotating immediately will break in-flight requests.
  console.warn('[bot-process-email] BOT_BEARER_TOKEN not configured — all requests will be rejected')
}

async function parseWithAnthropic(
  payload: EmailPayload
): Promise<{ parsed: ParsedBooking | null; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { parsed: null, error: 'ANTHROPIC_API_KEY not set' }

  const userContent =
    `Email metapodaci:\n` +
    `From: ${payload.email_from || '(nepoznato)'}\n` +
    `Subject: ${payload.email_subject || '(bez subjecta)'}\n` +
    `Received: ${payload.email_received_at || '(bez vremena)'}\n\n` +
    `Tijelo emaila:\n${payload.email_body || '(prazno)'}`

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        temperature: 0.1,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
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
      return {
        parsed: null,
        error: 'Anthropic: ' + (data.error?.message || `HTTP ${res.status}`),
      }
    }
    const toolUse = data.content?.find((c) => c.type === 'tool_use')
    if (!toolUse) {
      return { parsed: null, error: 'Anthropic did not return tool_use' }
    }
    return { parsed: toolUse.input as ParsedBooking }
  } catch (e) {
    return { parsed: null, error: (e as Error).message }
  }
}

function generateToken(): string {
  // 24 random bytes → base64url unguessable token
  return randomBytes(24)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function matchApartment(
  apartments: Array<{ id: string; name: string }>,
  candidate: string | null | undefined
): { id: string; name: string } | null {
  if (!candidate) return null
  const needle = candidate.toLowerCase().trim()
  // Exact match first
  const exact = apartments.find((a) => a.name.toLowerCase() === needle)
  if (exact) return exact
  // Includes match
  const fuzzy = apartments.find(
    (a) =>
      a.name.toLowerCase().includes(needle) ||
      needle.includes(a.name.toLowerCase())
  )
  return fuzzy || null
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  const expected = process.env.BOT_BEARER_TOKEN
  const authHeader = (req.headers.authorization ||
    req.headers.Authorization) as string | undefined
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
  if (!expected || !token || token !== expected) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return
  }

  let payload: EmailPayload
  try {
    payload =
      typeof req.body === 'string'
        ? (JSON.parse(req.body) as EmailPayload)
        : (req.body as EmailPayload)
  } catch (e) {
    res.status(400).json({
      success: false,
      error: 'Invalid JSON: ' + (e as Error).message,
    })
    return
  }

  if (!payload.user_id) {
    res.status(400).json({ success: false, error: 'user_id je obavezan' })
    return
  }

  // Rate limit per user_id — prevents spam processing
  const rl = await checkRateLimit('bot-process-email', payload.user_id, LIMITS.BOT_ENDPOINT)
  if (!rl.allowed) {
    res.status(429).json({ success: false, error: 'Too many requests' })
    return
  }

  // Enforce field length limits to prevent LLM overload
  if (payload.email_from && payload.email_from.length > 320) {
    payload.email_from = payload.email_from.slice(0, 320)
  }
  if (payload.email_subject && payload.email_subject.length > 998) {
    payload.email_subject = payload.email_subject.slice(0, 998)
  }
  if (payload.email_body && payload.email_body.length > 8000) {
    payload.email_body = payload.email_body.slice(0, 8000)
  }

  const admin = getSupabaseAdmin()

  // 1. Dedup po gmail_message_id
  if (payload.gmail_message_id) {
    const { data: existing } = await admin
      .from('email_log')
      .select('id, action, reservation_id')
      .eq('user_id', payload.user_id)
      .eq('gmail_message_id', payload.gmail_message_id)
      .maybeSingle()
    if (existing) {
      res.status(200).json({
        success: true,
        duplicate: true,
        previous_action: existing.action,
        reservation_id: existing.reservation_id,
      })
      return
    }
  }

  // 2. Parse s Anthropic (system prompt se cachira od drugog requesta)
  const { parsed, error: parseErr } = await parseWithAnthropic(payload)

  if (!parsed) {
    await admin.from('email_log').insert({
      user_id: payload.user_id,
      gmail_message_id: payload.gmail_message_id || null,
      email_from: payload.email_from || null,
      email_subject: payload.email_subject || null,
      email_received_at: payload.email_received_at || null,
      is_booking: false,
      parse_error: parseErr || 'unknown',
      action: 'error',
    })
    res.status(500).json({ success: false, error: parseErr || 'Parse failed' })
    return
  }

  // 3. Ako nije booking → log + exit
  if (!parsed.is_booking) {
    await admin.from('email_log').insert({
      user_id: payload.user_id,
      gmail_message_id: payload.gmail_message_id || null,
      email_from: payload.email_from || null,
      email_subject: payload.email_subject || null,
      email_received_at: payload.email_received_at || null,
      is_booking: false,
      parsed_data: parsed,
      action: 'not_booking',
    })
    res.status(200).json({
      success: true,
      action: 'not_booking',
      reason: parsed.reason_if_not || null,
    })
    return
  }

  // 4. Validacija osnovnih polja
  if (!parsed.check_in_date || !parsed.check_out_date) {
    await admin.from('email_log').insert({
      user_id: payload.user_id,
      gmail_message_id: payload.gmail_message_id || null,
      email_from: payload.email_from || null,
      email_subject: payload.email_subject || null,
      email_received_at: payload.email_received_at || null,
      is_booking: true,
      parsed_data: parsed,
      action: 'skipped',
      parse_error: 'Nedostaju datumi',
    })
    res.status(200).json({
      success: true,
      action: 'skipped',
      reason: 'Haiku nije mogao ekstrahirati check_in/check_out',
      parsed,
    })
    return
  }

  // 5. Fetch host apartments za matching
  const { data: apartments } = await admin
    .from('apartments')
    .select('id, name, evisitor_facility_code')
    .eq('user_id', payload.user_id)
  const apartmentList = (apartments || []).map((a: Record<string, unknown>) => ({
    id: a.id as string,
    name: a.name as string,
  }))

  const matchedApartment = matchApartment(apartmentList, parsed.apartment_name)

  // Ako ne može matchati apartman, kreira rezervaciju BEZ apartment_id
  // (host će ručno riješiti)
  const apartmentId = matchedApartment?.id || null

  // 6. Conflict check (samo ako imamo apartman)
  let conflicts: Awaited<ReturnType<typeof findConflicts>> = []
  if (apartmentId) {
    conflicts = await findConflicts(
      admin,
      apartmentId,
      parsed.check_in_date,
      parsed.check_out_date
    )
  }

  if (conflicts.length > 0) {
    await admin.from('email_log').insert({
      user_id: payload.user_id,
      gmail_message_id: payload.gmail_message_id || null,
      email_from: payload.email_from || null,
      email_subject: payload.email_subject || null,
      email_received_at: payload.email_received_at || null,
      is_booking: true,
      parsed_data: parsed,
      action: 'conflict',
      conflict_reservation_ids: conflicts.map((c) => c.id),
    })
    res.status(200).json({
      success: true,
      action: 'conflict',
      parsed,
      conflicts,
    })
    return
  }

  // 7. Create reservation
  const guestName =
    [parsed.guest_name, parsed.guest_surname].filter(Boolean).join(' ').trim() ||
    '(nepoznat gost)'
  const newReservationId = randomUUID()
  const publicToken = generateToken()

  const { error: insertErr } = await admin.from('reservations').insert({
    id: newReservationId,
    user_id: payload.user_id,
    apartment_id: apartmentId,
    guest_name: guestName,
    guest_contact: parsed.guest_email || parsed.guest_phone || null,
    guests_count: parsed.guest_count || 1,
    check_in: parsed.check_in_date,
    check_out: parsed.check_out_date,
    status: 'confirmed',
    notes: `Auto from ${parsed.source || 'email'}: ${payload.email_subject || ''}`.slice(0, 500),
    token: publicToken,
    guest_email: parsed.guest_email || null,
    guest_phone: parsed.guest_phone || null,
  })

  if (insertErr) {
    await admin.from('email_log').insert({
      user_id: payload.user_id,
      gmail_message_id: payload.gmail_message_id || null,
      email_from: payload.email_from || null,
      email_subject: payload.email_subject || null,
      email_received_at: payload.email_received_at || null,
      is_booking: true,
      parsed_data: parsed,
      action: 'error',
      parse_error: insertErr.message,
    })
    res.status(500).json({
      success: false,
      error: 'Insert failed: ' + insertErr.message,
    })
    return
  }

  // 8. Log success
  await admin.from('email_log').insert({
    user_id: payload.user_id,
    gmail_message_id: payload.gmail_message_id || null,
    email_from: payload.email_from || null,
    email_subject: payload.email_subject || null,
    email_received_at: payload.email_received_at || null,
    is_booking: true,
    parsed_data: parsed,
    action: 'created',
    reservation_id: newReservationId,
  })

  res.status(200).json({
    success: true,
    action: 'created',
    reservation_id: newReservationId,
    token: publicToken,
    matched_apartment: matchedApartment,
    parsed,
  })
}
