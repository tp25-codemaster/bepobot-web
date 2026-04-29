// Minimal iCal (RFC 5545) parser for Booking.com and Airbnb calendar feeds.
// Handles DATE and DATETIME values, folded lines, and CRLF/LF line endings.

export interface ICalEvent {
  uid: string
  checkIn: string  // YYYY-MM-DD
  checkOut: string // YYYY-MM-DD (exclusive — guests leave this day)
  summary: string
  description: string
}

function unfold(raw: string): string {
  // RFC 5545 line folding: CRLF + single whitespace = continuation
  return raw.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function parseICalDate(value: string): string | null {
  // DATE: 20260601 → 2026-06-01
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value.split('T')[0])
  if (!dateOnly) return null
  return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`
}

export function parseICal(raw: string): ICalEvent[] {
  const lines = unfold(raw).split('\n')
  const events: ICalEvent[] = []

  let inEvent = false
  let current: Record<string, string> = {}

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true
      current = {}
      continue
    }
    if (trimmed === 'END:VEVENT') {
      inEvent = false
      const uid = current['UID'] || ''
      const dtstart = current['DTSTART'] || current['DTSTART;VALUE=DATE'] || ''
      const dtend = current['DTEND'] || current['DTEND;VALUE=DATE'] || ''
      const checkIn = parseICalDate(dtstart)
      const checkOut = parseICalDate(dtend)

      if (uid && checkIn && checkOut) {
        events.push({
          uid,
          checkIn,
          checkOut,
          summary: current['SUMMARY'] || '',
          description: (current['DESCRIPTION'] || '').replace(/\\n/g, '\n'),
        })
      }
      continue
    }

    if (!inEvent) continue

    // Split key:value — key may have params (e.g. DTSTART;VALUE=DATE)
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx < 0) continue
    const key = trimmed.slice(0, colonIdx).toUpperCase()
    const val = trimmed.slice(colonIdx + 1)

    // Store both raw key and the base key (without params) for easier lookup
    current[key] = val
    const baseKey = key.split(';')[0]
    if (baseKey !== key) current[baseKey] = val
  }

  return events
}

// Extract a human-readable guest label from Booking.com / Airbnb summary
export function guestNameFromSummary(summary: string, platform: 'booking.com' | 'airbnb'): string {
  if (platform === 'booking.com') {
    // "CLOSED - Booking 1234567890" or "Booking.com - Reservation 1234567890"
    const match = /(\d{7,})/.exec(summary)
    return match ? `Booking.com #${match[1]}` : 'Booking.com gost'
  }
  // Airbnb: "Airbnb (Not available)" — no guest name for privacy
  return 'Airbnb gost'
}
