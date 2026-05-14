// POST /api/reservation-checkin
//
// Host triggers eVisitor check-in za popunjenu rezervaciju. Povlači guest
// podatke iz reservations tablice, Facility kod iz apartmana, kredencijale
// iz profila — pa zove istu runEVisitorCheckIn funkciju.

import {
  runEVisitorCheckIn,
  type GuestCheckInInput,
} from '../../server/evisitor.js'
import { decrypt } from '../../server/crypto.js'
import { getUserSupabase, getCurrentUser } from '../../server/supabase.js'
import { setCorsHeaders } from '../_lib/cors.js'

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
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  const authHeader = (req.headers.authorization ||
    req.headers.Authorization) as string | undefined
  const supabase = getUserSupabase(authHeader)
  if (!supabase) {
    res.status(401).json({ success: false, error: 'Missing Authorization' })
    return
  }
  const user = await getCurrentUser(supabase)
  if (!user) {
    res.status(401).json({ success: false, error: 'Invalid session' })
    return
  }

  let payload: { reservation_id?: string; test_mode?: boolean }
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

  const reservationId = payload.reservation_id
  if (!reservationId) {
    res
      .status(400)
      .json({ success: false, error: 'reservation_id je obavezan' })
    return
  }

  // Fetch reservation — RLS ensures only host's own
  const { data: reservation, error: resErr } = await supabase
    .from('reservations')
    .select(
      'id, apartment_id, status, tourist_name, tourist_surname, gender, date_of_birth, document_type, document_number, citizenship, city_of_residence, residence_address, check_in, check_out, evisitor_checked_in_at'
    )
    .eq('id', reservationId)
    .single()

  if (resErr || !reservation) {
    res.status(404).json({ success: false, error: 'Rezervacija ne postoji' })
    return
  }
  if (!reservation.tourist_name) {
    res.status(400).json({
      success: false,
      error: 'Gost još nije popunio svoje podatke',
    })
    return
  }
  if (reservation.evisitor_checked_in_at) {
    res.status(409).json({
      success: false,
      error: 'Gost je već prijavljen na eVisitor',
    })
    return
  }

  // Fetch apartment for Facility code
  if (!reservation.apartment_id) {
    res
      .status(400)
      .json({ success: false, error: 'Rezervacija nema apartman' })
    return
  }
  const { data: apt } = await supabase
    .from('apartments')
    .select('evisitor_facility_code')
    .eq('id', reservation.apartment_id)
    .single()

  if (!apt?.evisitor_facility_code) {
    res.status(400).json({
      success: false,
      error: 'Apartman nema eVisitor Facility kod',
    })
    return
  }

  // Fetch profile for credentials
  const { data: profile } = await supabase
    .from('profiles')
    .select('evisitor_username, evisitor_password, evisitor_connected')
    .eq('id', user.id)
    .single()

  if (
    !profile?.evisitor_connected ||
    !profile.evisitor_username ||
    !profile.evisitor_password
  ) {
    res.status(400).json({
      success: false,
      error: 'eVisitor nije povezan u profilu',
    })
    return
  }

  let password: string
  try {
    password = decrypt(profile.evisitor_password)
  } catch (e) {
    res.status(500).json({
      success: false,
      error: 'Ne mogu dekriptirati kredencijale: ' + (e as Error).message,
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

  // Update reservation on real success
  if (result.success && !payload.test_mode) {
    await supabase
      .from('reservations')
      .update({
        evisitor_checked_in_at: new Date().toISOString(),
        evisitor_tourist_id: result.touristId || null,
        evisitor_error: null,
      })
      .eq('id', reservation.id)
  } else if (!result.success && !payload.test_mode) {
    await supabase
      .from('reservations')
      .update({
        evisitor_error: result.checkinError || result.error || 'unknown',
      })
      .eq('id', reservation.id)
  }

  // Audit log
  if (!payload.test_mode) {
    try {
      await supabase.from('evisitor_log').insert({
        user_id: user.id,
        action: 'checkin',
        guest_name:
          `${reservation.tourist_name || ''} ${reservation.tourist_surname || ''}`.trim() ||
          'nepoznat',
        apartment_name: apt.evisitor_facility_code,
        evisitor_id: result.touristId || null,
        status: result.success ? 'success' : 'error',
        error_message: result.success ? null : result.checkinError || null,
      })
    } catch {
      /* audit best-effort */
    }
  }

  res.status(result.success ? 200 : 502).json(result)
}
