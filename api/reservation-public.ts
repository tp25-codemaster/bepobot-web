// GET /api/reservation-public?token=xxx
//
// Javna anonimna ruta — gost otvara svoj link i dobije MINIMALNE podatke
// o rezervaciji. Čita kroz service role (bypass RLS) ali vraća samo
// sigurne podatke.

import { createHmac } from 'node:crypto'
import { getSupabaseAdmin } from '../server/supabase.js'
import { checkRateLimit, LIMITS } from './_lib/ratelimit.js'
import { setCorsHeaders } from './_lib/cors.js'

function getCsrfSecret(): string {
  return process.env.CSRF_SECRET || process.env.CREDENTIAL_ENCRYPTION_KEY || 'csrf-dev-fallback'
}

export function deriveCsrfToken(reservationToken: string): string {
  return createHmac('sha256', getCsrfSecret())
    .update(reservationToken)
    .digest('hex')
}

interface VercelRequest {
  method?: string
  query?: { [key: string]: string | string[] | undefined }
  url?: string
  headers?: { [key: string]: string | string[] | undefined }
}
interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (data: unknown) => void
  setHeader: (name: string, value: string) => void
  end: () => void
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  setCorsHeaders(res, 'GET, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  // Rate limit by IP — prevent token brute force
  const ip = (req.headers?.['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
    || (req.headers?.['x-real-ip'] as string | undefined)
    || 'unknown'
  const rl = await checkRateLimit('reservation-public', ip, LIMITS.PUBLIC)
  if (!rl.allowed) {
    res.status(429).json({ success: false, error: 'Too many requests' })
    return
  }

  let token: string | undefined
  if (req.query && typeof req.query.token === 'string') {
    token = req.query.token
  } else if (req.url) {
    const m = req.url.match(/[?&]token=([^&]+)/)
    if (m) token = decodeURIComponent(m[1])
  }
  token = token?.trim()

  if (!token) {
    res.status(400).json({ success: false, error: 'Missing token' })
    return
  }

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('reservations')
    .select(
      'id, token, guest_name, check_in, check_out, status, apartment_id, tourist_name, tourist_surname, evisitor_checked_in_at, completed_at'
    )
    .eq('token', token)
    .single()

  if (error || !data) {
    res.status(404).json({ success: false, error: 'Rezervacija ne postoji' })
    return
  }

  if (data.status === 'cancelled') {
    res.status(410).json({ success: false, error: 'Rezervacija je otkazana' })
    return
  }

  // Compute high-level status for guest UI
  let guestStatus: 'pending' | 'completed' | 'checked_in'
  if (data.evisitor_checked_in_at) guestStatus = 'checked_in'
  else if (data.tourist_name) guestStatus = 'completed'
  else guestStatus = 'pending'

  // Only reveal sensitive access info after the guest has submitted their data
  const guestHasSubmitted = !!data.completed_at

  // Fetch apartment info (safe fields only)
  let apartmentName: string | null = null
  let wifi: { ssid: string | null; password: string | null } | null = null
  let parking: string | null = null
  let rules: string | null = null
  let checkinInstructions: string | null = null
  if (data.apartment_id) {
    const { data: apt } = await admin
      .from('apartments')
      .select(
        'name, wifi_ssid, wifi_password, parking, rules, checkin_instructions'
      )
      .eq('id', data.apartment_id)
      .single()
    if (apt) {
      apartmentName = apt.name
      // wifi, parking and checkin_instructions are only returned after guest submits personal data
      if (guestHasSubmitted) {
        wifi = apt.wifi_ssid
          ? { ssid: apt.wifi_ssid, password: apt.wifi_password }
          : null
        parking = apt.parking
        checkinInstructions = apt.checkin_instructions
      }
      rules = apt.rules
    }
  }

  // CSRF token derived from reservation token — stateless, no Redis needed.
  // Guest must echo this back in the POST body of reservation-submit.
  const csrfToken = deriveCsrfToken(token)

  res.status(200).json({
    success: true,
    csrf_token: csrfToken,
    reservation: {
      host_label: data.guest_name,
      stay_from: data.check_in,
      stay_until: data.check_out,
      status: guestStatus,
      apartment_name: apartmentName,
      wifi,
      parking,
      rules,
      checkin_instructions: checkinInstructions,
    },
  })
}
