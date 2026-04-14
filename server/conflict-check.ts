// Provjera preklapanja datuma rezervacija za dani apartman.
// Koristi se iz:
//   - RezervacijePage (kad host ručno kreira/uredi)
//   - bot-create-from-email (kad bot kreira iz email parse-a)
//   - bot tools kasnije kad dodamo create_reservation

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ConflictingReservation {
  id: string
  guest_name: string
  check_in: string
  check_out: string
  status: string
  source_hint: string | null
}

/**
 * Nađi rezervacije koje se preklapaju s danom periodom.
 *
 * Pravilo preklapanja (standardna turistička praksa):
 *   postojeća.check_in < novi.check_out  &&  postojeća.check_out > novi.check_in
 *
 * → Check-in/check-out istog dana (npr 15.06 odlazak, 15.06 dolazak) se NE smatra
 *   konfliktom jer je 15.06 i kraj starog i početak novog boravka.
 *
 * Ignorira cancelled rezervacije. Ignorira @excludeId ako je zadano (za edit flow).
 */
export async function findConflicts(
  supabase: SupabaseClient,
  apartmentId: string,
  checkIn: string,
  checkOut: string,
  excludeReservationId?: string
): Promise<ConflictingReservation[]> {
  const query = supabase
    .from('reservations')
    .select('id, guest_name, check_in, check_out, status, notes')
    .eq('apartment_id', apartmentId)
    .neq('status', 'cancelled')
    .lt('check_in', checkOut)
    .gt('check_out', checkIn)

  const { data, error } = await query
  if (error || !data) return []

  return data
    .filter((r: Record<string, unknown>) => r.id !== excludeReservationId)
    .map((r: Record<string, unknown>) => ({
      id: r.id as string,
      guest_name: (r.guest_name as string) || '(bez imena)',
      check_in: r.check_in as string,
      check_out: r.check_out as string,
      status: r.status as string,
      source_hint: (r.notes as string | null) || null,
    }))
}
