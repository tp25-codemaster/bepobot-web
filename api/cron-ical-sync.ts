// GET /api/cron-ical-sync
//
// Vercel cron job — runs every 2 hours.
// Syncs iCal feeds for every user who has at least one apartment with a Booking.com or Airbnb URL.
// Auth: Vercel automatically sends Authorization: Bearer ${CRON_SECRET}.

import { getSupabaseAdmin } from '../server/supabase.js'
import { parseICal, guestNameFromSummary } from '../server/ical-parser.js'
import { findConflicts } from '../server/conflict-check.js'
import { randomBytes } from 'node:crypto'

interface VercelRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
}
interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (data: unknown) => void
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel injects CRON_SECRET automatically for cron jobs
  const cronSecret = process.env.CRON_SECRET
  const authHeader = (req.headers['authorization'] as string) || ''

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const admin = getSupabaseAdmin()

  const { data: apartments, error } = await admin
    .from('apartments')
    .select('id, name, user_id, booking_ical_url, airbnb_ical_url')
    .or('booking_ical_url.not.is.null,airbnb_ical_url.not.is.null')

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  const today = new Date().toISOString().slice(0, 10)
  let totalCreated = 0
  let totalConflicts = 0
  let totalErrors = 0

  for (const apt of apartments || []) {
    for (const platform of ['booking.com', 'airbnb'] as const) {
      const url = platform === 'booking.com' ? apt.booking_ical_url : apt.airbnb_ical_url
      if (!url) continue

      const raw = await fetchICalSafe(url)
      if (!raw) { totalErrors++; continue }

      const events = parseICal(raw)

      for (const event of events) {
        if (event.checkOut <= today) continue

        const { data: existing } = await admin
          .from('reservations')
          .select('id, check_in, check_out')
          .eq('apartment_id', apt.id)
          .eq('external_id', event.uid)
          .maybeSingle()

        if (existing) {
          if (existing.check_in !== event.checkIn || existing.check_out !== event.checkOut) {
            await admin.from('reservations').update({ check_in: event.checkIn, check_out: event.checkOut }).eq('id', existing.id)
          }
          continue
        }

        const { data: emailMatch } = await admin
          .from('reservations')
          .select('id')
          .eq('apartment_id', apt.id)
          .eq('platform', platform)
          .eq('check_in', event.checkIn)
          .eq('check_out', event.checkOut)
          .neq('status', 'cancelled')
          .maybeSingle()

        if (emailMatch) {
          await admin.from('reservations').update({ external_id: event.uid }).eq('id', emailMatch.id)
          continue
        }

        const conflicts = await findConflicts(admin, apt.id, event.checkIn, event.checkOut)
        const hasConflict = conflicts.length > 0
        if (hasConflict) {
          totalConflicts++
          for (const c of conflicts) {
            await admin.from('reservations').update({ has_conflict: true }).eq('id', c.id)
          }
        }

        await admin.from('reservations').insert({
          user_id: apt.user_id,
          apartment_id: apt.id,
          guest_name: guestNameFromSummary(event.summary, platform),
          check_in: event.checkIn,
          check_out: event.checkOut,
          status: 'confirmed',
          platform,
          external_id: event.uid,
          has_conflict: hasConflict,
          token: generateToken(),
          notes: event.summary.slice(0, 200),
        })
        totalCreated++
      }
    }

    await admin.from('apartments').update({ ical_last_synced_at: new Date().toISOString() }).eq('id', apt.id)
  }

  res.status(200).json({
    ok: true,
    apartments: (apartments || []).length,
    created: totalCreated,
    conflicts: totalConflicts,
    errors: totalErrors,
  })
}
