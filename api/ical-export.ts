// GET /api/ical-export?apt=:apartment_id&token=:ical_export_token
//
// Public endpoint — no auth cookie needed.
// Returns an RFC 5545 iCal feed of all future BepoBot reservations for the apartment.
// Booking.com and Airbnb can subscribe to this URL to auto-block direct reservations.
//
// IMPORTANT: guest names are NOT exposed — summary is just "Rezervirano" to keep it private.

import { getSupabaseAdmin } from '../server/supabase.js'

interface VercelRequest {
  method?: string
  query: Record<string, string | string[] | undefined>
}
interface VercelResponse {
  status: (code: number) => VercelResponse
  setHeader: (name: string, value: string) => void
  send: (body: string) => void
  json: (data: unknown) => void
  end: () => void
}

function icalDate(dateStr: string): string {
  // dateStr is YYYY-MM-DD, iCal all-day format is YYYYMMDD
  return dateStr.replace(/-/g, '')
}

function icalTimestamp(): string {
  return new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const aptId = req.query.apt as string | undefined
  const token = req.query.token as string | undefined

  if (!aptId || !token) {
    res.status(400).json({ error: 'Missing apt or token' })
    return
  }

  const admin = getSupabaseAdmin()

  const { data: apt } = await admin
    .from('apartments')
    .select('id, name, ical_export_token')
    .eq('id', aptId)
    .eq('ical_export_token', token)
    .maybeSingle()

  if (!apt) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  const today = new Date().toISOString().slice(0, 10)

  const { data: reservations } = await admin
    .from('reservations')
    .select('id, check_in, check_out')
    .eq('apartment_id', aptId)
    .neq('status', 'cancelled')
    .gte('check_out', today)
    .order('check_in', { ascending: true })

  const dtstamp = icalTimestamp()
  const calName = `${apt.name} - BepoBot`

  const events = (reservations || []).map(r => [
    'BEGIN:VEVENT',
    `DTSTART;VALUE=DATE:${icalDate(r.check_in)}`,
    `DTEND;VALUE=DATE:${icalDate(r.check_out)}`,
    'SUMMARY:Rezervirano',
    `UID:${r.id}@bepobot.app`,
    `DTSTAMP:${dtstamp}`,
    'END:VEVENT',
  ].join('\r\n'))

  const ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BepoBot//BepoBot//HR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calName}`,
    'X-WR-TIMEZONE:Europe/Zagreb',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${apt.name.replace(/[^a-z0-9]/gi, '_')}.ics"`)
  res.setHeader('Cache-Control', 'no-cache, no-store')
  res.status(200).send(ical)
}
