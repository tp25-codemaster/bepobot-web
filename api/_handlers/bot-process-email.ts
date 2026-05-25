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

import { getSupabaseAdmin } from '../../server/supabase.js'
import { findConflicts } from '../../server/conflict-check.js'
import { randomUUID, randomBytes } from 'node:crypto'
import { checkRateLimit, LIMITS } from '../_lib/ratelimit.js'
import { setCorsHeaders } from '../_lib/cors.js'
import { withSentry, captureError } from '../_lib/sentry.js'

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
  is_inquiry?: boolean
  inquiry_summary?: string | null
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

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'anthropic/claude-haiku-4.5'

const SYSTEM_PROMPT = `Ti si parser koji cita email i odlucuje je li to POTVRĐENA nova rezervacija za iznajmljivaca apartmana u Hrvatskoj.

Zadatak: ekstrahiraj kljucne podatke u strukturirani JSON kroz tool call booking_data.

PRAVILA ZA is_booking:
- TRUE samo ako je email POTVRDA rezervacije (booking confirmation). Mora imati: gost, datumi dolaska/odlaska.
- FALSE za: newsletter, marketing, review request, cancellation, modification request, upit gosta koji jos nije potvrdjen, bills, spam, random emailovi.
- Upit "Can I book June 15-18?" je FALSE — nije potvrda, samo pitanje.
- Cancellation email je FALSE — rezervacija se OTKAZUJE, ne kreira.

POUZDANOST (confidence):
- high: email dolazi s @booking.com, @airbnb.com, @vrbo.com i ima jasne datume i ime gosta
- medium: direct booking s jasnim datumima i imenom gosta ali nije velika platforma
- low: datumi su dvosmisleni, ili nedostaje bitna informacija, ili nije jasno je li stvarno potvrda

IZVOR (source):
- Gledaj From adresu: no-reply@booking.com → booking.com; @airbnb.com → airbnb; direct email → direct
- Booking.com i Airbnb emailovi su uvijek standardnog formata i lako prepoznatljivi

UPITI (is_inquiry):
- Ako je is_booking=false ali email IZGLEDA kao upit za rezervaciju (osoba pita za dostupnost, cijenu, uvjete) postavi is_inquiry=true.
- inquiry_summary: kratki sažetak upita na hrvatskom, max 2 rečenice. Što osoba traži, koji datumi (ako ih ima), koliko gostiju.
- Primjer: "Gost Marko pita za dostupnost 10-15. lipnja za 2 osobe. Zanima ga cijena i parkiranje."
- Ako is_booking=true, is_inquiry=false.
- Spam, newsletter, bill → is_inquiry=false.

OSTALA PRAVILA:
- Datumi MORAJU biti YYYY-MM-DD. "15 May 2026" → "2026-05-15". "15. lipnja 2026" → "2026-06-15".
- apartment_name: naziv apartmana iz emaila (npr. "Villa Panorama", "Apartman 2"). Ako nije u emailu, null.
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
        is_inquiry: { type: 'boolean', description: 'True ako je upit za rezervaciju (nije potvrda)' },
        inquiry_summary: { type: ['string', 'null'], description: 'Kratki sažetak upita na hrvatskom, max 2 rečenice' },
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

async function parseWithHaiku(
  payload: EmailPayload
): Promise<{ parsed: ParsedBooking | null; error?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return { parsed: null, error: 'OPENROUTER_API_KEY not set' }

  const userContent =
    `Email metapodaci:\n` +
    `From: ${payload.email_from || '(nepoznato)'}\n` +
    `Subject: ${payload.email_subject || '(bez subjecta)'}\n` +
    `Received: ${payload.email_received_at || '(bez vremena)'}\n\n` +
    `Tijelo emaila:\n${payload.email_body || '(prazno)'}`

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://bepobot-web-bepo1.vercel.app',
        'X-Title': 'BepoBot Email Parser',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        tools: [BOOKING_TOOL],
        tool_choice: { type: 'function', function: { name: 'booking_data' } },
        max_tokens: 600,
        temperature: 0.1,
      }),
    })
    const data = (await res.json()) as {
      choices?: Array<{
        message?: {
          tool_calls?: Array<{ function: { arguments: string } }>
        }
      }>
      error?: { message?: string }
    }
    if (!res.ok) {
      return {
        parsed: null,
        error: 'LLM: ' + (data.error?.message || `HTTP ${res.status}`),
      }
    }
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0]
    if (!toolCall) {
      return { parsed: null, error: 'Haiku did not return tool_call' }
    }
    const args =
      typeof toolCall.function.arguments === 'string'
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments
    return { parsed: args as ParsedBooking }
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

async function handler(
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

  // 2. Parse s Haiku
  const { parsed, error: parseErr } = await parseWithHaiku(payload)

  if (!parsed) {
    captureError(new Error(parseErr || 'Parse failed'), { userId: payload.user_id, email_subject: payload.email_subject })
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

  // 3. Ako nije booking → provjeri je li upit, pa logiraj
  if (!parsed.is_booking) {
    const action = parsed.is_inquiry ? 'inquiry' : 'not_booking'
    await admin.from('email_log').insert({
      user_id: payload.user_id,
      gmail_message_id: payload.gmail_message_id || null,
      email_from: payload.email_from || null,
      email_subject: payload.email_subject || null,
      email_received_at: payload.email_received_at || null,
      is_booking: false,
      parsed_data: parsed,
      action,
      ...(parsed.is_inquiry && parsed.inquiry_summary
        ? { inquiry_summary: parsed.inquiry_summary }
        : {}),
    })
    res.status(200).json({
      success: true,
      action,
      reason: parsed.reason_if_not || null,
      ...(parsed.is_inquiry ? { inquiry_summary: parsed.inquiry_summary } : {}),
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

  const platformValue =
    parsed.source === 'booking.com' ? 'booking.com' :
    parsed.source === 'airbnb' ? 'airbnb' : 'direct'

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
    platform: platformValue,
    notes: `Auto from ${parsed.source || 'email'}: ${payload.email_subject || ''}`.slice(0, 500),
    token: publicToken,
    guest_email: parsed.guest_email || null,
    guest_phone: parsed.guest_phone || null,
  })

  if (insertErr) {
    captureError(insertErr, { userId: payload.user_id, reservationId: newReservationId })
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

export default withSentry(handler)
