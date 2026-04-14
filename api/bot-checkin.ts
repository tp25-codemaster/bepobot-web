// POST /api/bot-checkin
//
// Bot-to-backend endpoint. Autenticirano shared bearer tokenom
// (ne kroz Supabase JWT — bot nema user session, samo machine identity).
//
// Body: { user_id, reservation_id, test_mode }
// Koristi service role Supabase klijent (bypass RLS) ali eksplicitno provjerava
// da reservation.user_id == user_id iz body-ja — defense in depth.

import {
  runEVisitorCheckIn,
  type GuestCheckInInput,
} from '../server/evisitor.js'
import { decrypt } from '../server/crypto.js'
import { getSupabaseAdmin } from '../server/supabase.js'

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

function dateToEvisitor(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.replaceAll('-', '')
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  // Bearer auth
  const expected = process.env.BOT_BEARER_TOKEN
  if (!expected) {
    res.status(500).json({
      success: false,
      error: 'BOT_BEARER_TOKEN not configured on server',
    })
    return
  }
  const authHeader = (req.headers.authorization ||
    req.headers.Authorization) as string | undefined
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
  if (!token || token !== expected) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return
  }

  let payload: {
    user_id?: string
    reservation_id?: string
    test_mode?: boolean
  }
  try {
    payload =
      typeof req.body === 'string' ? JSON.parse(req.body) : (req.body as object)
  } catch (e) {
    res.status(400).json({
      success: false,
      error: 'Invalid JSON body: ' + (e as Error).message,
    })
    return
  }

  const userId = payload.user_id?.trim()
  const reservationId = payload.reservation_id?.trim()
  if (!userId || !reservationId) {
    res
      .status(400)
      .json({ success: false, error: 'user_id i reservation_id obavezni' })
    return
  }

  const admin = getSupabaseAdmin()

  // Fetch reservation with defensive user_id check
  const { data: reservation, error: resErr } = await admin
    .from('reservations')
    .select(
      'id, user_id, apartment_id, tourist_name, tourist_surname, gender, date_of_birth, document_type, document_number, citizenship, city_of_residence, residence_address, check_in, check_out, evisitor_checked_in_at'
    )
    .eq('id', reservationId)
    .single()

  if (resErr || !reservation) {
    res.status(404).json({ success: false, error: 'Rezervacija ne postoji' })
    return
  }
  if (reservation.user_id !== userId) {
    res
      .status(403)
      .json({ success: false, error: 'Rezervacija ne pripada tom korisniku' })
    return
  }
  if (!reservation.tourist_name) {
    res
      .status(400)
      .json({ success: false, error: 'Gost još nije popunio podatke' })
    return
  }
  if (reservation.evisitor_checked_in_at) {
    res
      .status(409)
      .json({ success: false, error: 'Već prijavljen na eVisitor' })
    return
  }

  // Fetch apartment
  if (!reservation.apartment_id) {
    res.status(400).json({ success: false, error: 'Rezervacija nema apartman' })
    return
  }
  const { data: apt } = await admin
    .from('apartments')
    .select('evisitor_facility_code')
    .eq('id', reservation.apartment_id)
    .single()
  if (!apt?.evisitor_facility_code) {
    res
      .status(400)
      .json({ success: false, error: 'Apartman nema eVisitor Facility kod' })
    return
  }

  // Fetch host profile for credentials
  const { data: profile } = await admin
    .from('profiles')
    .select('evisitor_username, evisitor_password, evisitor_connected')
    .eq('id', userId)
    .single()

  if (
    !profile?.evisitor_connected ||
    !profile.evisitor_username ||
    !profile.evisitor_password
  ) {
    res
      .status(400)
      .json({ success: false, error: 'eVisitor nije povezan u profilu' })
    return
  }

  let password: string
  try {
    password = decrypt(profile.evisitor_password)
  } catch (e) {
    res.status(500).json({
      success: false,
      error: 'Decrypt failed: ' + (e as Error).message,
    })
    return
  }

  const guestInput: GuestCheckInInput = {
    Facility: apt.evisitor_facility_code,
    TouristName: reservation.tourist_name || '',
    TouristSurname: reservation.tourist_surname || '',
    Gender: reservation.gender || '',
    DateOfBirth: dateToEvisitor(reservation.date_of_birth),
    DocumentType: reservation.document_type || '',
    DocumentNumber: reservation.document_number || '',
    Citizenship: reservation.citizenship || '',
    CountryOfBirth: reservation.citizenship || '',
    CountryOfResidence: reservation.citizenship || '',
    CityOfResidence: reservation.city_of_residence || '',
    ResidenceAddress: reservation.residence_address || '-',
    StayFrom: dateToEvisitor(reservation.check_in),
    TimeStayFrom: '14:00',
    ForeseenStayUntil: dateToEvisitor(reservation.check_out),
    TimeEstimatedStayUntil: '10:00',
    ArrivalOrganisation: 'I',
    OfferedServiceType: 'noćenje',
    TTPaymentCategory: '11',
    _testMode: payload.test_mode === true,
  }

  const result = await runEVisitorCheckIn(guestInput, {
    username: profile.evisitor_username,
    password,
  })

  if (result.success && !payload.test_mode) {
    await admin
      .from('reservations')
      .update({
        evisitor_checked_in_at: new Date().toISOString(),
        evisitor_tourist_id: result.touristId || null,
        evisitor_error: null,
      })
      .eq('id', reservation.id)

    try {
      await admin.from('evisitor_log').insert({
        user_id: userId,
        action: 'checkin',
        guest_name:
          `${reservation.tourist_name || ''} ${reservation.tourist_surname || ''}`.trim(),
        apartment_name: apt.evisitor_facility_code,
        evisitor_id: result.touristId || null,
        status: 'success',
      })
    } catch {
      /* best effort */
    }
  } else if (!result.success && !payload.test_mode) {
    await admin
      .from('reservations')
      .update({
        evisitor_error: result.checkinError || result.error || 'unknown',
      })
      .eq('id', reservation.id)

    try {
      await admin.from('evisitor_log').insert({
        user_id: userId,
        action: 'checkin',
        guest_name:
          `${reservation.tourist_name || ''} ${reservation.tourist_surname || ''}`.trim(),
        apartment_name: apt.evisitor_facility_code,
        status: 'error',
        error_message: result.checkinError || result.error || null,
      })
    } catch {
      /* best effort */
    }
  }

  res.status(result.success ? 200 : 502).json(result)
}
