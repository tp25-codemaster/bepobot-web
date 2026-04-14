// Shared bot tool implementations.
// Used by both /api/bot-chat (user-scoped) and /api/bot-checkin (admin-scoped).
// Takes a Supabase client as argument so caller decides auth scope.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  runEVisitorCheckIn,
  type GuestCheckInInput,
  type EVisitorResult,
} from './evisitor.js'
import { decrypt } from './crypto.js'

function dateToEvisitor(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.replaceAll('-', '')
}

export interface ReservationContext {
  id: string
  host_label: string
  guests_count: number
  check_in: string | null
  check_out: string | null
  apartment_name: string | null
  apartment_has_facility_code: boolean
  self_checkin_status: 'pending' | 'completed' | 'checked_in'
  guest_name: string | null
}

/**
 * Dohvati rezervacije za user-a — za injection u system prompt.
 * Radi i s user-scoped i s admin supabase klijentom.
 */
export async function fetchReservationsForContext(
  supabase: SupabaseClient,
  userId: string
): Promise<ReservationContext[]> {
  const { data } = await supabase
    .from('reservations')
    .select(
      'id, guest_name, guests_count, check_in, check_out, status, apartment_id, tourist_name, tourist_surname, evisitor_checked_in_at, apartments(name, evisitor_facility_code)'
    )
    .eq('user_id', userId)
    .neq('status', 'cancelled')
    .order('check_in', { ascending: true })
    .limit(20)

  return (data || []).map((r: Record<string, unknown>) => {
    const apt = r.apartments as { name?: string; evisitor_facility_code?: string } | null
    const hasGuestData = Boolean(r.tourist_name)
    const isCheckedIn = Boolean(r.evisitor_checked_in_at)
    let selfCheckinStatus: ReservationContext['self_checkin_status']
    if (isCheckedIn) selfCheckinStatus = 'checked_in'
    else if (hasGuestData) selfCheckinStatus = 'completed'
    else selfCheckinStatus = 'pending'
    return {
      id: r.id as string,
      host_label: (r.guest_name as string) || '(bez labela)',
      guests_count: (r.guests_count as number) || 1,
      check_in: (r.check_in as string) || null,
      check_out: (r.check_out as string) || null,
      apartment_name: apt?.name || null,
      apartment_has_facility_code: Boolean(apt?.evisitor_facility_code),
      self_checkin_status: selfCheckinStatus,
      guest_name: hasGuestData
        ? `${r.tourist_name as string} ${(r.tourist_surname as string) || ''}`.trim()
        : null,
    }
  })
}

/** Formatiraj listu rezervacija za system prompt (compact human-readable). */
export function formatReservationsForPrompt(
  reservations: ReservationContext[]
): string {
  if (reservations.length === 0) return '(nema aktivnih rezervacija)'
  return reservations
    .map((r) => {
      const status =
        r.self_checkin_status === 'checked_in'
          ? 'VEC PRIJAVLJEN'
          : r.self_checkin_status === 'completed'
            ? 'GOST POPUNIO'
            : 'CEKA GOSTA'
      return `- id: ${r.id} | ${r.host_label} | ${r.apartment_name || '(bez apartmana)'} | ${r.check_in} → ${r.check_out} | ${status}${r.guest_name ? ' | gost: ' + r.guest_name : ''}`
    })
    .join('\n')
}

/**
 * Izvrši check_in_reservation tool call. Jedinstvena logika za sve bot backend-ove.
 * Vraća EVisitorResult + side-effects (update reservations row, evisitor_log).
 */
export async function executeCheckInReservation(
  supabase: SupabaseClient,
  userId: string,
  reservationId: string,
  testMode: boolean
): Promise<EVisitorResult> {
  // 1. Fetch reservation
  const { data: reservation, error: resErr } = await supabase
    .from('reservations')
    .select(
      'id, user_id, apartment_id, tourist_name, tourist_surname, gender, date_of_birth, document_type, document_number, citizenship, city_of_residence, residence_address, check_in, check_out, evisitor_checked_in_at'
    )
    .eq('id', reservationId)
    .single()

  if (resErr || !reservation) {
    return { success: false, error: 'Rezervacija ne postoji' }
  }
  if (reservation.user_id !== userId) {
    return { success: false, error: 'Rezervacija ne pripada korisniku' }
  }
  if (!reservation.tourist_name) {
    return {
      success: false,
      error: 'Gost još nije popunio svoje podatke',
    }
  }
  if (reservation.evisitor_checked_in_at) {
    return {
      success: false,
      error: 'Gost je već prijavljen na eVisitor',
    }
  }

  // 2. Apartment
  if (!reservation.apartment_id) {
    return { success: false, error: 'Rezervacija nema apartman' }
  }
  const { data: apt } = await supabase
    .from('apartments')
    .select('evisitor_facility_code')
    .eq('id', reservation.apartment_id)
    .single()
  if (!apt?.evisitor_facility_code) {
    return { success: false, error: 'Apartman nema eVisitor Facility kod' }
  }

  // 3. Credentials
  const { data: profile } = await supabase
    .from('profiles')
    .select('evisitor_username, evisitor_password, evisitor_connected')
    .eq('id', userId)
    .single()

  if (
    !profile?.evisitor_connected ||
    !profile.evisitor_username ||
    !profile.evisitor_password
  ) {
    return {
      success: false,
      error: 'eVisitor nije povezan u profilu',
    }
  }

  let password: string
  try {
    password = decrypt(profile.evisitor_password)
  } catch (e) {
    return {
      success: false,
      error: 'Ne mogu dekriptirati kredencijale: ' + (e as Error).message,
    }
  }

  // 4. Run check-in
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
    _testMode: testMode,
  }

  const result = await runEVisitorCheckIn(guestInput, {
    username: profile.evisitor_username,
    password,
  })

  // 5. Side-effects on real mode
  if (result.success && !testMode) {
    await supabase
      .from('reservations')
      .update({
        evisitor_checked_in_at: new Date().toISOString(),
        evisitor_tourist_id: result.touristId || null,
        evisitor_error: null,
      })
      .eq('id', reservation.id)

    try {
      await supabase.from('evisitor_log').insert({
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
  } else if (!result.success && !testMode) {
    await supabase
      .from('reservations')
      .update({
        evisitor_error: result.checkinError || result.error || 'unknown',
      })
      .eq('id', reservation.id)

    try {
      await supabase.from('evisitor_log').insert({
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

  return result
}

/** Tool definicije za Claude (OpenAI-compatible format). */
export const BOT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'check_in_reservation',
      description:
        'Prijavi gosta na eVisitor sustav. Vraća rezultat prijave.',
      parameters: {
        type: 'object',
        properties: {
          reservation_id: {
            type: 'string',
            description:
              'UUID rezervacije iz liste TRENUTNE REZERVACIJE u sistem promptu',
          },
          test_mode: {
            type: 'boolean',
            description:
              'true = samo Login provjera (sigurno), false = stvarna prijava u HR registar (nepovratno)',
          },
        },
        required: ['reservation_id', 'test_mode'],
      },
    },
  },
]

/** Zajednički system prompt s ubacenom listom rezervacija. */
export function buildSystemPrompt(
  reservations: ReservationContext[],
  userName: string | null
): string {
  const resList = formatReservationsForPrompt(reservations)
  return `Ti si BepoBot — AI asistent koji pomaze vlasniku apartmana u Hrvatskoj upravljati rezervacijama i prijavama gostiju na eVisitor sustav.

Prica na hrvatskom, kratko i direktno. Koristi emojije umjereno.

Korisnik: ${userName || 'Korisnik'}

TRENUTNE REZERVACIJE:
${resList}

Kad korisnik trazi da prijavis gosta na eVisitor:
1. Identificiraj tocnu rezervaciju iz gornje liste po imenu gosta ili apartmanu.
2. Ako postoji vise podudaranja, pitaj koja tocno.
3. Rezervacija mora imati status GOST POPUNIO da se moze prijaviti (ne CEKA GOSTA niti VEC PRIJAVLJEN).
4. Zovi tool check_in_reservation s ispravnim reservation_id.
5. DEFAULT: test_mode=true (sigurno, samo provjera logina).
6. Stvarnu prijavu (test_mode=false) radi SAMO ako korisnik izricito napise: "stvarno", "produkcija", "pravi", "stvarnu".
7. Nakon tool poziva, saopci rezultat kratkim tekstom.

Ako korisnik pita o rezervacijama, odgovori na temelju gornje liste. Ne izmisljaj podatke.
Za sve ostalo (chit-chat, pitanja o BepoBot-u), odgovori normalno bez pozivanja toola.`
}
