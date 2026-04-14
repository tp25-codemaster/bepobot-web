// GET /api/bot-reservations?user_id=xxx
// Lista rezervacija za host userId. Bot to injecta u system prompt
// kako bi Claude znao koje rezervacije postoje i koji im je ID.
//
// Auth: shared bearer token (BOT_BEARER_TOKEN), ne Supabase JWT.

import { getSupabaseAdmin } from '../server/supabase.js'

interface VercelRequest {
  method?: string
  query?: { [key: string]: string | string[] | undefined }
  url?: string
  headers: { [key: string]: string | string[] | undefined }
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  const expected = process.env.BOT_BEARER_TOKEN
  if (!expected) {
    res
      .status(500)
      .json({ success: false, error: 'BOT_BEARER_TOKEN not configured' })
    return
  }
  const authHeader = (req.headers.authorization ||
    req.headers.Authorization) as string | undefined
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
  if (!token || token !== expected) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return
  }

  // Extract user_id from query
  let userId: string | undefined
  if (req.query && typeof req.query.user_id === 'string') {
    userId = req.query.user_id
  } else if (req.url) {
    const m = req.url.match(/[?&]user_id=([^&]+)/)
    if (m) userId = decodeURIComponent(m[1])
  }
  userId = userId?.trim()

  if (!userId) {
    res.status(400).json({ success: false, error: 'Missing user_id' })
    return
  }

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('reservations')
    .select(
      'id, guest_name, guests_count, check_in, check_out, status, apartment_id, tourist_name, tourist_surname, evisitor_checked_in_at, apartments(name, evisitor_facility_code)'
    )
    .eq('user_id', userId)
    .neq('status', 'cancelled')
    .order('check_in', { ascending: true })
    .limit(20)

  if (error) {
    res.status(500).json({ success: false, error: error.message })
    return
  }

  // Shape the response compactly for LLM consumption
  const simplified = (data || []).map((r: Record<string, unknown>) => {
    const apt = r.apartments as { name?: string; evisitor_facility_code?: string } | null
    const hasGuestData = Boolean(r.tourist_name)
    const isCheckedIn = Boolean(r.evisitor_checked_in_at)
    let selfCheckinStatus: string
    if (isCheckedIn) selfCheckinStatus = 'checked_in'
    else if (hasGuestData) selfCheckinStatus = 'completed'
    else selfCheckinStatus = 'pending'
    return {
      id: r.id,
      host_label: r.guest_name,
      guests_count: r.guests_count,
      check_in: r.check_in,
      check_out: r.check_out,
      apartment_name: apt?.name || null,
      apartment_has_facility_code: Boolean(apt?.evisitor_facility_code),
      self_checkin_status: selfCheckinStatus,
      guest_name: hasGuestData
        ? `${r.tourist_name} ${r.tourist_surname || ''}`.trim()
        : null,
    }
  })

  res.status(200).json({ success: true, reservations: simplified })
}
