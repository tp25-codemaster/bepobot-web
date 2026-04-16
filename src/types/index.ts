/**
 * Shared domain types used across multiple pages.
 * Single source of truth — import from here, not from page files.
 */

// ─── Apartment ────────────────────────────────────────────────────────────────

export interface Apartment {
  id: string
  name: string
}

// ─── Reservation ─────────────────────────────────────────────────────────────
// Full union of all fields used across DashboardPage, RezervacijePage,
// KalendarPage, and GostiPage. Optional fields may be absent depending
// on the query select used by the calling page.

export interface Reservation {
  id: string
  guest_name: string
  apartment_id?: string
  guest_contact?: string | null
  guests_count?: number
  check_in: string
  check_out: string
  status: 'confirmed' | 'cancelled' | 'completed' | string
  notes?: string | null
  token?: string | null
  tourist_name?: string | null
  tourist_surname?: string | null
  completed_at?: string | null
  evisitor_checked_in_at?: string | null
  evisitor_tourist_id?: string | null
  evisitor_error?: string | null
  platform?: string
  apartment_name_raw?: string
  apartments?: { name: string } | null
}

// ─── PendingReservation ───────────────────────────────────────────────────────

export interface PendingReservation {
  id: string
  guest_name: string
  apartment_name_raw: string
  check_in: string
  check_out: string
  platform: string
}

// ─── ReservationRow (guest detail, used in GostiPage) ─────────────────────────

export interface ReservationRow {
  id: string
  tourist_name: string | null
  tourist_surname: string | null
  gender: string | null
  date_of_birth: string | null
  document_type: string | null
  document_number: string | null
  citizenship: string | null
  city_of_residence: string | null
  residence_address: string | null
  guest_email: string | null
  guest_phone: string | null
  check_in: string | null
  check_out: string | null
  apartment_id: string | null
  completed_at: string | null
  evisitor_checked_in_at: string | null
  created_at: string
  apartments?: { name: string } | null
}

// ─── GuestAggregate (used in GostiPage) ──────────────────────────────────────

export interface GuestAggregate {
  key: string
  name: string
  surname: string
  email: string | null
  phone: string | null
  citizenship: string | null
  city: string | null
  dateOfBirth: string | null
  documentNumber: string | null
  stays: ReservationRow[]
  totalStays: number
  lastStay: string | null
  totalNights: number
}
