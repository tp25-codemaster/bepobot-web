// POST /api/sync-ical
//
// Sinkronizira Booking.com i Airbnb iCal feedove za jedan ili sve apartmane.
// Kreira rezervacije za evente koji još ne postoje, detektira konflikte.
//
// Auth: Supabase JWT (poziva browser) ili BOT_BEARER_TOKEN (poziva cron).
// Body: { apartment_id?: string }  — ako nije naveden, sinkronizira sve apartmane korisnika.

import { getSupabaseAdmin, getUserSupabase } from '../../server/supabase.js'
import { parseICal, guestNameFromSummary } from '../../server/ical-parser.js'
import { findConflicts } from '../../server/conflict-check.js'
import { setCorsHeaders } from '../_lib/cors.js'
import { randomBytes } from 'node:crypto'

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

interface SyncResult {
  apartment_id: string
  apartment_name: string
  platform: 'booking.com' | 'airbnb'
  created: number
  updated: number
  skipped: number
  conflicts: number
  error?: string
}

function generateToken(): string {
  return randomBytes(24).toString('base64url')
}

async function fetchICalSafe(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': 'BepoBot/1.0 Calendar Sync' },
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

async function syncApartmentPlatform(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  apartment: { id: string; name: string; booking_ical_url: string | null; airbnb_ical_url: string | null },
  platform: 'booking.com' | 'airbnb'
): Promise<SyncResult> {
  const result: SyncResult = {
    apartment_id: apartment.id,
    apartment_name: apartment.name,
    platform,
    created: 0,
    updated: 0,
    skipped: 0,
    conflicts: 0,
  }

  const url = platform === 'booking.com' ? apartment.booking_ical_url : apartment.airbnb_ical_url
  if (!url) return result

  const raw = await fetchICalSafe(url)
  if (!raw) {
    result.error = 'Nije moguće dohvatiti iCal feed'
    return result
  }

  const events = parseICal(raw)

  for (const event of events) {
    // Skip events in the past (check_out before today)
    const today = new Date().toISOString().slice(0, 10)
    if (event.checkOut <= today) {
      result.skipped++
      continue
    }

    // Upsert by external_id
    const { data: existing } = await admin
      .from('reservations')
      .select('id, check_in, check_out, has_conflict')
      .eq('apartment_id', apartment.id)
      .eq('external_id', event.uid)
      .maybeSingle()

    if (existing) {
      // Update dates if they changed (Booking.com sometimes sends modifications)
      if (existing.check_in !== event.checkIn || existing.check_out !== event.checkOut) {
        await admin
          .from('reservations')
          .update({ check_in: event.checkIn, check_out: event.checkOut })
          .eq('id', existing.id)
        result.updated++
      } else {
        result.skipped++
      }
      continue
    }

    // Also check if an email-parsed reservation already covers this date range + platform
    const { data: emailMatch } = await admin
      .from('reservations')
      .select('id')
      .eq('apartment_id', apartment.id)
      .eq('platform', platform)
      .eq('check_in', event.checkIn)
      .eq('check_out', event.checkOut)
      .neq('status', 'cancelled')
      .maybeSingle()

    if (emailMatch) {
      // Link the external_id to the email-parsed reservation
      await admin
        .from('reservations')
        .update({ external_id: event.uid })
        .eq('id', emailMatch.id)
      result.updated++
      continue
    }

    // New reservation — check for conflicts with other platforms
    const conflicts = await findConflicts(admin, apartment.id, event.checkIn, event.checkOut)
    const hasConflict = conflicts.length > 0

    if (hasConflict) {
      result.conflicts++
      // Mark existing conflicting reservations
      for (const c of conflicts) {
        await admin.from('reservations').update({ has_conflict: true }).eq('id', c.id)
      }
    }

    const guestName = guestNameFromSummary(event.summary, platform)
    await admin.from('reservations').insert({
      user_id: userId,
      apartment_id: apartment.id,
      guest_name: guestName,
      check_in: event.checkIn,
      check_out: event.checkOut,
      status: 'confirmed',
      platform,
      external_id: event.uid,
      has_conflict: hasConflict,
      token: generateToken(),
      notes: event.summary.slice(0, 200),
    })
    result.created++
  }

  return result
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, 'POST, OPTIONS')

  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  // Auth: JWT ili BOT_BEARER_TOKEN
  const authHeader = (req.headers['authorization'] as string) || ''
  const botToken = process.env.BOT_BEARER_TOKEN

  let userId: string | null = null

  if (botToken && authHeader === `Bearer ${botToken}`) {
    // Bot/cron call: user_id must be in body
    const body = req.body as Record<string, string>
    userId = body?.user_id ?? null
    if (!userId) { res.status(400).json({ error: 'user_id required for bot auth' }); return }
  } else {
    // Browser JWT call
    const client = getUserSupabase(authHeader)
    if (!client) { res.status(401).json({ error: 'Unauthorized' }); return }
    const { data: { user } } = await client.auth.getUser()
    if (!user) { res.status(401).json({ error: 'Unauthorized' }); return }
    userId = user.id
  }

  const body = req.body as Record<string, string> | null
  const apartmentId = body?.apartment_id ?? null

  const admin = getSupabaseAdmin()

  // Fetch apartments
  let query = admin
    .from('apartments')
    .select('id, name, booking_ical_url, airbnb_ical_url')
    .eq('user_id', userId)
    .or('booking_ical_url.not.is.null,airbnb_ical_url.not.is.null')

  if (apartmentId) query = query.eq('id', apartmentId) as typeof query

  const { data: apartments, error } = await query
  if (error) { res.status(500).json({ error: error.message }); return }

  const results: SyncResult[] = []

  for (const apt of apartments || []) {
    if (apt.booking_ical_url) {
      results.push(await syncApartmentPlatform(admin, userId, apt, 'booking.com'))
    }
    if (apt.airbnb_ical_url) {
      results.push(await syncApartmentPlatform(admin, userId, apt, 'airbnb'))
    }
  }

  // Update last synced timestamp
  if (apartmentId) {
    await admin.from('apartments').update({ ical_last_synced_at: new Date().toISOString() }).eq('id', apartmentId)
  } else {
    const ids = (apartments || []).map(a => a.id)
    if (ids.length > 0) {
      await admin.from('apartments').update({ ical_last_synced_at: new Date().toISOString() }).in('id', ids)
    }
  }

  const totalConflicts = results.reduce((s, r) => s + r.conflicts, 0)
  res.status(200).json({
    success: true,
    synced: results.length,
    totalConflicts,
    results,
  })
}
