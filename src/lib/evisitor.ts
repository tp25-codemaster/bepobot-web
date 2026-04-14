// eVisitor API client — zove naš /api/evisitor-checkin endpoint
// (Vercel serverless funkcija u produkciji, Vite middleware u devu).
// Backend radi Login → CheckIn → Logout s kredencijalima trenutnog usera
// (povlači ih iz Supabase profiles tablice).

import { apiPost } from './apiClient'

export interface GuestCheckInData {
  Facility: string
  TouristName: string
  TouristSurname: string
  TouristMiddleName?: string
  Gender: 'muški' | 'ženski'
  DateOfBirth: string // yyyymmdd
  DocumentType: string
  DocumentNumber: string
  Citizenship: string
  CountryOfBirth?: string
  CountryOfResidence?: string
  CityOfResidence: string
  ResidenceAddress?: string
  StayFrom: string // yyyymmdd
  TimeStayFrom?: string
  ForeseenStayUntil: string // yyyymmdd
  TimeEstimatedStayUntil?: string
  ArrivalOrganisation?: 'I' | 'A'
  OfferedServiceType?: string
  TTPaymentCategory?: string
  _testMode?: boolean
}

export interface CheckInResponse {
  success: boolean
  testMode?: boolean
  touristId?: string
  touristName?: string
  facility?: string
  checkinStatus?: number
  checkinError?: string | null
  message?: string
  error?: string
}

export async function checkInGuest(
  data: GuestCheckInData
): Promise<CheckInResponse> {
  const res = await apiPost<CheckInResponse>('/api/evisitor-checkin', data)
  if (res.data) return res.data
  return {
    success: false,
    error: res.error || 'Nepoznata greška',
  }
}

export interface ConnectResponse {
  success: boolean
  message?: string
  username?: string
  error?: string
}

export async function connectEVisitor(
  username: string,
  password: string
): Promise<ConnectResponse> {
  const res = await apiPost<ConnectResponse>('/api/evisitor-connect', {
    username,
    password,
  })
  if (res.data) return res.data
  return { success: false, error: res.error || 'Nepoznata greška' }
}

export async function disconnectEVisitor(): Promise<ConnectResponse> {
  const res = await apiPost<ConnectResponse>('/api/evisitor-disconnect', {})
  if (res.data) return res.data
  return { success: false, error: res.error || 'Nepoznata greška' }
}
