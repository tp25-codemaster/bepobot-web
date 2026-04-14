// GET /api/reservation-public?token=xxx
//
// Javna anonimna ruta — gost otvara svoj link i dobije MINIMALNE podatke
// o rezervaciji. Čita kroz service role (bypass RLS) ali vraća samo
// sigurne podatke.

import { getSupabaseAdmin } from '../server/supabase.js'

interface VercelRequest {
  method?: string
  query?: { [key: string]: string | string[] | undefined }
  url?: string
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
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
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
      wifi = apt.wifi_ssid
        ? { ssid: apt.wifi_ssid, password: apt.wifi_password }
        : null
      parking = apt.parking
      rules = apt.rules
      checkinInstructions = apt.checkin_instructions
    }
  }

  res.status(200).json({
    success: true,
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
