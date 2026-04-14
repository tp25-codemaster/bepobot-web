// Reservations API client (both host-authed and public guest endpoints).
// Host CRUD se radi direktno kroz supabase client u RezervacijePage.
// Ovdje su samo pomoćni API-end point pozivi za self-checkin flow.

import { apiPost } from './apiClient'

export interface PublicReservation {
  host_label: string
  stay_from: string | null
  stay_until: string | null
  status: 'pending' | 'completed' | 'checked_in'
  apartment_name: string | null
  wifi: { ssid: string | null; password: string | null } | null
  parking: string | null
  rules: string | null
  checkin_instructions: string | null
}

/**
 * Generiraj token za public self-checkin link. Koristi browser crypto
 * za nagađanje-otporni random (24 bajta → 32 char base64url).
 */
export function generateReservationToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Public — nema JWT, anonimno. Koristi se na /checkin/:token stranici. */
export async function fetchPublicReservation(
  token: string
): Promise<{ success: boolean; reservation?: PublicReservation; error?: string }> {
  try {
    const res = await fetch(
      `/api/reservation-public?token=${encodeURIComponent(token)}`
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { success: false, error: data.error || `HTTP ${res.status}` }
    }
    return data
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export interface GuestSubmitInput {
  token: string
  tourist_name: string
  tourist_surname: string
  gender: 'muški' | 'ženski'
  date_of_birth: string
  document_type: string
  document_number: string
  citizenship: string
  city_of_residence: string
  residence_address?: string
  guest_email?: string
  guest_phone?: string
}

/** Public — gost šalje svoje podatke. */
export async function submitGuestData(
  input: GuestSubmitInput
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/reservation-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { success: false, error: data.error || `HTTP ${res.status}` }
    }
    return data
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export interface ReservationCheckInResult {
  success: boolean
  testMode?: boolean
  message?: string
  error?: string
  checkinError?: string | null
  checkinStatus?: number
  touristId?: string
  touristName?: string
}

/** Host — okine eVisitor check-in iz rezervacije koja ima popunjen tourist_*. */
export async function checkInReservation(
  reservationId: string,
  testMode = false
): Promise<ReservationCheckInResult> {
  const res = await apiPost<ReservationCheckInResult>(
    '/api/reservation-checkin',
    { reservation_id: reservationId, test_mode: testMode }
  )
  if (res.data) return res.data
  return { success: false, error: res.error || 'Greška' }
}

/** Formatiraj rezultat check-ina u user-friendly poruku. */
export function formatCheckInError(res: ReservationCheckInResult): string {
  const parts: string[] = []
  if (res.error) parts.push(res.error)
  if (res.checkinError) parts.push(res.checkinError)
  if (res.checkinStatus !== undefined) parts.push(`HTTP ${res.checkinStatus}`)
  if (res.message && parts.length === 0) parts.push(res.message)
  return parts.join(' · ') || 'Nepoznata greška'
}
