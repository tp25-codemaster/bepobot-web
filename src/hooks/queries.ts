// Shared TanStack Query hooks for BepoBot data.
//
// All hooks:
// - Scope by user.id automatically
// - Cache for 5 min (default), refetch on manual invalidation
// - Return typed data + loading/error states
//
// Usage:
//   const { data: reservations, isLoading } = useReservations()
//
// Invalidate after mutation:
//   const qc = useQueryClient()
//   qc.invalidateQueries({ queryKey: ['reservations'] })

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { supabase, isDemoMode } from '../lib/supabase'

// ========== Reservations ==========

export interface ReservationRow {
  id: string
  apartment_id: string | null
  guest_name: string
  guest_contact: string | null
  guests_count: number
  check_in: string
  check_out: string
  status: string
  notes: string | null
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
  completed_at: string | null
  evisitor_checked_in_at: string | null
  created_at: string
  apartments: { name: string } | null
}

export function useReservations() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['reservations', user?.id],
    queryFn: async () => {
      if (!user || isDemoMode) return [] as ReservationRow[]
      const { data, error } = await supabase
        .from('reservations')
        .select(
          'id, apartment_id, guest_name, guest_contact, guests_count, check_in, check_out, status, notes, tourist_name, tourist_surname, gender, date_of_birth, document_type, document_number, citizenship, city_of_residence, residence_address, guest_email, guest_phone, completed_at, evisitor_checked_in_at, created_at, apartments(name)'
        )
        .eq('user_id', user.id)
        .order('check_in', { ascending: true })
      if (error) throw error
      return (data || []).map((r: any) => ({
        ...r,
        apartments: Array.isArray(r.apartments) ? r.apartments[0] || null : r.apartments,
      })) as ReservationRow[]
    },
    enabled: !!user && !isDemoMode,
  })
}

// ========== Apartments ==========

export interface ApartmentRow {
  id: string
  name: string
  wifi_ssid: string | null
  wifi_password: string | null
  parking: string | null
  rules: string | null
  checkin_instructions: string | null
  evisitor_facility_code: string | null
  created_at: string
}

export function useApartments() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['apartments', user?.id],
    queryFn: async () => {
      if (!user || isDemoMode) return [] as ApartmentRow[]
      const { data, error } = await supabase
        .from('apartments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data || []) as ApartmentRow[]
    },
    enabled: !!user && !isDemoMode,
  })
}

// ========== Contacts ==========

export interface ContactRow {
  id: string
  name: string
  role: 'cleaner' | 'cohost' | 'maintenance'
  phone: string | null
  email: string | null
}

export function useContacts() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['contacts', user?.id],
    queryFn: async () => {
      if (!user || isDemoMode) return [] as ContactRow[]
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data || []) as ContactRow[]
    },
    enabled: !!user && !isDemoMode,
  })
}

// ========== Pending reservations ==========

export interface PendingReservation {
  id: string
  apartment_name_raw: string
  guest_name: string
  guest_contact: string | null
  guests_count: number
  check_in: string
  check_out: string
  platform: string
  status: string
}

export function usePendingReservations() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['pending_reservations', user?.id],
    queryFn: async () => {
      if (!user || isDemoMode) return [] as PendingReservation[]
      const { data, error } = await supabase
        .from('pending_reservations')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
      if (error) throw error
      return (data || []) as PendingReservation[]
    },
    enabled: !!user && !isDemoMode,
  })
}

// ========== Guests without email (count only) ==========

export function useGuestsWithoutEmailCount() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['guests_without_email_count', user?.id],
    queryFn: async () => {
      if (!user || isDemoMode) return 0
      const { count } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('guest_email', null)
        .not('tourist_name', 'is', null)
      return count || 0
    },
    enabled: !!user && !isDemoMode,
  })
}

// ========== Email Inquiries ==========

export interface InquiryRow {
  id: string
  email_from: string | null
  email_subject: string | null
  email_received_at: string | null
  inquiry_summary: string | null
  parsed_data: {
    guest_name?: string | null
    guest_email?: string | null
    check_in_date?: string | null
    check_out_date?: string | null
    guest_count?: number | null
    inquiry_summary?: string | null
  } | null
  created_at: string
}

export function useInquiries() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['inquiries', user?.id],
    queryFn: async () => {
      if (!user || isDemoMode) return [] as InquiryRow[]
      const { data, error } = await supabase
        .from('email_log')
        .select('id, email_from, email_subject, email_received_at, inquiry_summary, parsed_data, created_at')
        .eq('user_id', user.id)
        .eq('action', 'inquiry')
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return (data || []) as InquiryRow[]
    },
    enabled: !!user && !isDemoMode,
    staleTime: 2 * 60 * 1000,
  })
}

// ========== Utility: invalidate all user data ==========

export function useInvalidateUserData() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['reservations'] })
    qc.invalidateQueries({ queryKey: ['apartments'] })
    qc.invalidateQueries({ queryKey: ['contacts'] })
    qc.invalidateQueries({ queryKey: ['pending_reservations'] })
    qc.invalidateQueries({ queryKey: ['guests_without_email_count'] })
  }
}
