// POST /api/reservation-submit
//
// Javna anonimna ruta — gost šalje svoje osobne podatke preko linka/tokena.
// Backend validira token, sprema podatke u reservations tablicu, i označava
// status kao "completed".

import { getSupabaseAdmin } from '../server/supabase.js'
import { checkRateLimit, LIMITS } from './_lib/ratelimit.js'
import { setCorsHeaders } from './_lib/cors.js'
import { deriveCsrfToken } from './reservation-public.js'

interface VercelRequest {
  method?: string
  body: unknown
  headers?: { [key: string]: string | string[] | undefined }
}
interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (data: unknown) => void
  setHeader: (name: string, value: string) => void
  end: () => void
}

interface GuestPayload {
  token?: string
  csrf_token?: string
  tourist_name?: string
  tourist_surname?: string
  gender?: 'muški' | 'ženski'
  date_of_birth?: string // YYYY-MM-DD
  document_type?: string
  document_number?: string
  citizenship?: string
  city_of_residence?: string
  residence_address?: string
  guest_email?: string
  guest_phone?: string
}

const REQUIRED_FIELDS: (keyof GuestPayload)[] = [
  'tourist_name',
  'tourist_surname',
  'gender',
  'date_of_birth',
  'document_type',
  'document_number',
  'citizenship',
  'city_of_residence',
]

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  setCorsHeaders(res, 'POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  // Rate limit by IP — strict (10/min, prevents spam)
  const ip = (req.headers?.['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
    || (req.headers?.['x-real-ip'] as string | undefined)
    || 'unknown'
  const rl = await checkRateLimit('reservation-submit', ip, LIMITS.PUBLIC_STRICT)
  if (!rl.allowed) {
    res.status(429).json({ success: false, error: 'Too many requests' })
    return
  }

  let payload: GuestPayload
  try {
    payload =
      typeof req.body === 'string'
        ? (JSON.parse(req.body) as GuestPayload)
        : (req.body as GuestPayload)
  } catch (e) {
    res.status(400).json({
      success: false,
      error: 'Invalid JSON body: ' + (e as Error).message,
    })
    return
  }

  const token = payload.token?.trim()
  if (!token) {
    res.status(400).json({ success: false, error: 'Missing token' })
    return
  }

  // CSRF validation — token must match the HMAC derived from the reservation token
  const csrfToken = payload.csrf_token?.trim()
  if (!csrfToken || csrfToken !== deriveCsrfToken(token)) {
    res.status(403).json({ success: false, error: 'Invalid or missing CSRF token' })
    return
  }

  for (const field of REQUIRED_FIELDS) {
    if (!payload[field] || !String(payload[field]).trim()) {
      res.status(400).json({
        success: false,
        error: `Polje "${field}" je obavezno`,
      })
      return
    }
  }

  const admin = getSupabaseAdmin()

  // Fetch + validate state
  const { data: existing, error: fetchErr } = await admin
    .from('reservations')
    .select('id, status, evisitor_checked_in_at')
    .eq('token', token)
    .single()
  if (fetchErr || !existing) {
    res.status(404).json({ success: false, error: 'Rezervacija ne postoji' })
    return
  }
  if (existing.status === 'cancelled') {
    res.status(410).json({ success: false, error: 'Rezervacija je otkazana' })
    return
  }
  if (existing.evisitor_checked_in_at) {
    res.status(409).json({
      success: false,
      error: 'Ova rezervacija je već prijavljena na eVisitor',
    })
    return
  }

  // Update (NE diramo host-side "status" kolonu; koristi tourist_* za signal)
  const { error: updateErr } = await admin
    .from('reservations')
    .update({
      tourist_name: payload.tourist_name!.trim(),
      tourist_surname: payload.tourist_surname!.trim(),
      gender: payload.gender,
      date_of_birth: payload.date_of_birth,
      document_type: payload.document_type,
      document_number: payload.document_number!.trim(),
      citizenship: payload.citizenship,
      city_of_residence: payload.city_of_residence!.trim(),
      residence_address: payload.residence_address?.trim() || null,
      guest_email: payload.guest_email?.trim() || null,
      guest_phone: payload.guest_phone?.trim() || null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', existing.id)

  if (updateErr) {
    res.status(500).json({
      success: false,
      error: 'Ne mogu spremiti: ' + updateErr.message,
    })
    return
  }

  res.status(200).json({
    success: true,
    message: 'Hvala! Vaši podaci su poslani domaćinu.',
  })
}
