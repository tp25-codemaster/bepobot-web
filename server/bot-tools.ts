// Shared bot tool implementations.
// Used by both /api/bot-chat (user-scoped) and /api/bot-checkin (admin-scoped).
// Takes a Supabase client as argument so caller decides auth scope.

import type { SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
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

export interface PendingReservationContext {
  id: string
  guest_name: string | null
  guest_contact: string | null
  guests_count: number
  check_in: string | null
  check_out: string | null
  apartment_id: string | null
  apartment_name: string | null
  platform: string | null
  confirmation_number: string | null
  notes: string | null
}

/** Dohvati pending rezervacije (cekaju potvrdu vlasnika) za injection u prompt. */
export async function fetchPendingReservationsForContext(
  supabase: SupabaseClient,
  userId: string
): Promise<PendingReservationContext[]> {
  const { data } = await supabase
    .from('pending_reservations')
    .select(
      'id, guest_name, guest_contact, guests_count, check_in, check_out, apartment_id, apartment_name_raw, platform, confirmation_number, notes'
    )
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20)

  return (data || []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    guest_name: (r.guest_name as string) || null,
    guest_contact: (r.guest_contact as string) || null,
    guests_count: (r.guests_count as number) || 1,
    check_in: (r.check_in as string) || null,
    check_out: (r.check_out as string) || null,
    apartment_id: (r.apartment_id as string) || null,
    apartment_name: (r.apartment_name_raw as string) || null,
    platform: (r.platform as string) || null,
    confirmation_number: (r.confirmation_number as string) || null,
    notes: (r.notes as string) || null,
  }))
}

export function formatPendingForPrompt(
  pending: PendingReservationContext[]
): string {
  if (pending.length === 0) return '(nema novih rezervacija na cekanju)'
  return pending
    .map(
      (p) =>
        `- id: ${p.id} | ${p.guest_name || '(bez imena)'} | ${p.apartment_name || '(bez apartmana)'} | ${p.check_in} → ${p.check_out} | ${p.guests_count} gostiju | platforma: ${p.platform || '?'}${p.confirmation_number ? ' | kod: ' + p.confirmation_number : ''}`
    )
    .join('\n')
}

/** Potvrdi pending rezervaciju — prebaci u reservations tablicu, oznaci pending kao confirmed. */
export async function executeConfirmPendingReservation(
  supabase: SupabaseClient,
  userId: string,
  pendingId: string
): Promise<{ success: boolean; reservation_id?: string; error?: string }> {
  const { data: pending, error: fetchErr } = await supabase
    .from('pending_reservations')
    .select('*')
    .eq('id', pendingId)
    .single()

  if (fetchErr || !pending) {
    return { success: false, error: 'Pending rezervacija ne postoji' }
  }
  if (pending.user_id !== userId) {
    return { success: false, error: 'Rezervacija ne pripada korisniku' }
  }
  if (pending.status !== 'pending') {
    return {
      success: false,
      error: `Rezervacija je vec obradjena (status: ${pending.status})`,
    }
  }

  const noteParts: string[] = []
  if (pending.platform) noteParts.push(`Platforma: ${pending.platform}`)
  if (pending.confirmation_number)
    noteParts.push(`Kod: ${pending.confirmation_number}`)
  if (pending.notes) noteParts.push(pending.notes)

  const insertPayload = {
    user_id: userId,
    apartment_id: pending.apartment_id,
    guest_name: pending.guest_name,
    guest_contact: pending.guest_contact,
    guests_count: pending.guests_count || 1,
    check_in: pending.check_in,
    check_out: pending.check_out,
    status: 'confirmed',
    notes: noteParts.join(' | ') || null,
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('reservations')
    .insert(insertPayload)
    .select('id')
    .single()

  if (insertErr || !inserted) {
    return {
      success: false,
      error: 'Ne mogu spremiti rezervaciju: ' + (insertErr?.message || 'unknown'),
    }
  }

  await supabase
    .from('pending_reservations')
    .update({ status: 'confirmed' })
    .eq('id', pendingId)

  return { success: true, reservation_id: inserted.id as string }
}

/** Pošalji email obavijest čistačici/čistačicama za pripremu apartmana. */
export async function executeNotifyCleaner(
  supabase: SupabaseClient,
  userId: string,
  reservationId: string
): Promise<{ success: boolean; notified?: string[]; error?: string }> {
  const { data: reservation, error: resErr } = await supabase
    .from('reservations')
    .select(
      'id, user_id, guest_name, guests_count, check_in, check_out, apartment_id, apartments(name)'
    )
    .eq('id', reservationId)
    .single()

  if (resErr || !reservation) {
    return { success: false, error: 'Rezervacija ne postoji' }
  }
  if (reservation.user_id !== userId) {
    return { success: false, error: 'Rezervacija ne pripada korisniku' }
  }

  const { data: cleaners, error: contactErr } = await supabase
    .from('contacts')
    .select('id, name, email')
    .eq('user_id', userId)
    .eq('role', 'cleaner')
    .not('email', 'is', null)

  if (contactErr) {
    return { success: false, error: 'Ne mogu dohvatiti kontakte: ' + contactErr.message }
  }
  if (!cleaners || cleaners.length === 0) {
    return { success: false, error: 'Nema čistačica s emailom u kontaktima' }
  }

  const apt = reservation.apartments as { name?: string } | null
  const aptName = apt?.name || '(nepoznat apartman)'
  const guestLabel = (reservation.guest_name as string) || '(gost)'
  const guestCount = (reservation.guests_count as number) || 1
  const checkIn = (reservation.check_in as string) || '?'
  const checkOut = (reservation.check_out as string) || '?'

  const cleanerList = cleaners.map((c) => ({
    name: c.name as string,
    email: c.email as string,
  }))

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // Bez Resend — vrati podatke čistačice da bot može korisniku reći koga treba kontaktirati
    return {
      success: true,
      email_sent: false,
      manual: true,
      cleaners: cleanerList,
      message: `Čišćenje za ${aptName}: gost ${guestLabel} (${guestCount} os.), check-in ${checkIn}, check-out ${checkOut}.`,
    }
  }

  const resend = new Resend(apiKey)
  const notified: string[] = []

  for (const cleaner of cleanerList) {
    try {
      await resend.emails.send({
        from: 'BepoBot <noreply@bepobot.com>',
        to: cleaner.email,
        subject: `Čišćenje apartmana: ${aptName} — check-out ${checkOut}`,
        html: `<p>Pozdrav ${cleaner.name},</p>
<p>Molimo pripremi apartman <strong>${aptName}</strong>:</p>
<ul>
  <li>Gost: ${guestLabel} (${guestCount} ${guestCount === 1 ? 'osoba' : 'osobe/a'})</li>
  <li>Check-in: ${checkIn}</li>
  <li>Check-out: ${checkOut}</li>
</ul>
<p>Apartman treba biti spreman do dana check-ina.</p>
<p>— BepoBot</p>`,
      })
      notified.push(cleaner.name)
    } catch {
      /* best effort — nastavi s ostalima */
    }
  }

  if (notified.length === 0) {
    return { success: false, error: 'Slanje emaila nije uspjelo ni jednoj čistačici' }
  }
  return { success: true, email_sent: true, notified }
}

/** Odbij pending rezervaciju — oznaci kao rejected. */
export async function executeRejectPendingReservation(
  supabase: SupabaseClient,
  userId: string,
  pendingId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: pending, error: fetchErr } = await supabase
    .from('pending_reservations')
    .select('id, user_id, status')
    .eq('id', pendingId)
    .single()

  if (fetchErr || !pending) {
    return { success: false, error: 'Pending rezervacija ne postoji' }
  }
  if (pending.user_id !== userId) {
    return { success: false, error: 'Rezervacija ne pripada korisniku' }
  }
  if (pending.status !== 'pending') {
    return {
      success: false,
      error: `Rezervacija je vec obradjena (status: ${pending.status})`,
    }
  }

  const { error: updateErr } = await supabase
    .from('pending_reservations')
    .update({ status: 'rejected' })
    .eq('id', pendingId)

  if (updateErr) {
    return { success: false, error: 'Ne mogu odbiti: ' + updateErr.message }
  }
  return { success: true }
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
  {
    type: 'function' as const,
    function: {
      name: 'confirm_pending_reservation',
      description:
        'Potvrdi novu pending rezervaciju koja je detektirana iz emaila i prebaci ju u aktivne rezervacije. Koristi kad korisnik kaze "potvrdi", "da", "ok", "dodaj" za neku pending rezervaciju.',
      parameters: {
        type: 'object',
        properties: {
          pending_id: {
            type: 'string',
            description:
              'UUID iz liste PENDING REZERVACIJE u sistem promptu',
          },
        },
        required: ['pending_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'reject_pending_reservation',
      description:
        'Odbij pending rezervaciju (npr. ako je duplikat ili kriva). Koristi kad korisnik kaze "odbij", "ne", "obrisi" za neku pending rezervaciju.',
      parameters: {
        type: 'object',
        properties: {
          pending_id: {
            type: 'string',
            description: 'UUID iz liste PENDING REZERVACIJE u sistem promptu',
          },
        },
        required: ['pending_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'notify_cleaner',
      description:
        'Pošalji email obavijest čistačici (ili svim čistačicama) da pripreme apartman za novu rezervaciju. Koristi kad korisnik kaže "obavijesti čistačicu", "pošalji čistačici", "javi cleaneru", "notify cleaner", "čišćenje", "cleaning", "spremi apartman", "pripremi apartman".',
      parameters: {
        type: 'object',
        properties: {
          reservation_id: {
            type: 'string',
            description:
              'UUID rezervacije iz liste TRENUTNE REZERVACIJE za koju treba čišćenje',
          },
        },
        required: ['reservation_id'],
      },
    },
  },
]

/** Zajednički system prompt s ubacenom listom rezervacija. */
export function buildSystemPrompt(
  reservations: ReservationContext[],
  userName: string | null,
  pending: PendingReservationContext[] = []
): string {
  const resList = formatReservationsForPrompt(reservations)
  const pendingList = formatPendingForPrompt(pending)
  return `Ti si BepoBot — AI asistent koji pomaze vlasniku apartmana u Hrvatskoj upravljati rezervacijama i prijavama gostiju na eVisitor sustav.

Prica na hrvatskom, kratko i direktno. Koristi emojije umjereno.

Korisnik: ${userName || 'Korisnik'}

TRENUTNE REZERVACIJE:
${resList}

PENDING REZERVACIJE (cekaju potvrdu vlasnika):
${pendingList}

Kad korisnik trazi da prijavis gosta na eVisitor:
1. Identificiraj tocnu rezervaciju iz TRENUTNE REZERVACIJE liste po imenu gosta ili apartmanu.
2. Ako postoji vise podudaranja, pitaj koja tocno.
3. Rezervacija mora imati status GOST POPUNIO da se moze prijaviti (ne CEKA GOSTA niti VEC PRIJAVLJEN).
4. Zovi tool check_in_reservation s ispravnim reservation_id.
5. DEFAULT: test_mode=true (sigurno, samo provjera logina).
6. Stvarnu prijavu (test_mode=false) radi SAMO ako korisnik izricito napise: "stvarno", "produkcija", "pravi", "stvarnu".
7. Nakon tool poziva, saopci rezultat kratkim tekstom.

Kad korisnik kaze "potvrdi", "da", "ok", "dodaj" ili slicno za neku PENDING rezervaciju:
1. Identificiraj tocan pending_id iz PENDING REZERVACIJE liste po imenu gosta ili apartmanu.
2. Ako je samo jedan pending, koristi taj.
3. OBAVEZNO zovi tool confirm_pending_reservation s pending_id — NE SMIJES samo reci "dodajem" bez poziva toola.
4. Nakon tool poziva saopci rezultat korisniku na temelju toga sto je tool vratio.
5. Ako PENDING REZERVACIJE lista je prazna, reci korisniku da nema nijedne pending rezervacije — nemoj izmisljati.

Kad korisnik kaze "odbij", "ne", "obrisi" za neku PENDING rezervaciju:
1. Zovi tool reject_pending_reservation s pending_id.

Kad korisnik kaze "obavijesti čistačicu", "javi cleaneru", "pošalji čistačici", "čišćenje", "cleaning", "pripremi apartman" ili slicno vezano uz čišćenje:
1. Identificiraj rezervaciju iz TRENUTNE REZERVACIJE liste po imenu gosta ili apartmanu.
2. Ako ima vise rezervacija, pitaj za koju.
3. OBAVEZNO zovi tool notify_cleaner s reservation_id — NE smijes samo reci "slanjem" bez poziva toola.
4. Ako tool vrati email_sent=true, saopci kome je email poslan (notified lista).
5. Ako tool vrati manual=true (nema email integracije), ispiši podatke čistačice (ime + email iz cleaners liste) i poruku iz message polja da korisnik može kontaktirati ručno.
6. Ako tool vrati grešku (nema čistačica s emailom, itd.), saopci to korisniku.

Ako korisnik pita o rezervacijama, odgovori na temelju gornjih lista. Ne izmisljaj podatke.
Za sve ostalo (chit-chat, pitanja o BepoBot-u), odgovori normalno bez pozivanja toola.`
}
