import { useEffect, useState } from 'react'
import AppShell from '../../components/app/AppShell'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, isDemoMode } from '../../lib/supabase'
import CalendarReservationModal from '../../components/CalendarReservationModal'
import type { Reservation } from '../../types/index'

interface ApartmentSync {
  id: string
  name: string
  booking_ical_url: string | null
  airbnb_ical_url: string | null
  ical_export_token: string | null
  ical_last_synced_at: string | null
}

const DAYS = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned']
const MONTHS = ['Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj',
  'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac']

type ViewMode = 'month' | 'week'

function platformClasses(r: Reservation): string {
  if (r.has_conflict) return 'bg-orange-100 border-orange-500 text-orange-900'
  const p = r.platform || 'direct'
  if (p === 'booking.com') return 'bg-blue-100 border-blue-500 text-blue-900'
  if (p === 'airbnb') return 'bg-rose-100 border-rose-500 text-rose-900'
  // direct or fallback — use status colour
  const s = r.status?.toLowerCase() || ''
  if (s === 'confirmed' || s === 'active') return 'bg-emerald-100 border-emerald-500 text-emerald-900'
  if (s === 'pending') return 'bg-yellow-100 border-yellow-400 text-yellow-800'
  if (s === 'cancelled' || s === 'canceled') return 'bg-red-100 border-red-400 text-red-800'
  if (s === 'completed') return 'bg-gray-100 border-gray-400 text-gray-600'
  return 'bg-emerald-100 border-emerald-500 text-emerald-900'
}

function platformLabel(r: Reservation): string {
  if (r.has_conflict) return '⚠️ ' + r.guest_name.split(' ')[0]
  return r.guest_name.split(' ')[0]
}

export default function KalendarPage() {
  const { user } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncingAptId, setSyncingAptId] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [syncOpen, setSyncOpen] = useState(false)
  const [apartments, setApartments] = useState<ApartmentSync[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const today = new Date()
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startOffset = firstDay === 0 ? 6 : firstDay - 1

  // Week view: compute the 7-day window containing currentDate
  const weekStart = (() => {
    const d = new Date(currentDate)
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1 // Monday-based
    d.setDate(d.getDate() - dow)
    return d
  })()
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  useEffect(() => {
    if (isDemoMode || !user) return
    loadReservations()
    loadApartments()
  }, [user, currentDate])

  async function loadApartments() {
    const { data } = await supabase
      .from('apartments')
      .select('id, name, booking_ical_url, airbnb_ical_url, ical_export_token, ical_last_synced_at')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: true })
    setApartments((data as ApartmentSync[]) || [])
  }

  async function handleSyncAll() {
    if (syncing) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/sync-ical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({}),
      })
      const json = await res.json() as { totalConflicts?: number; results?: Array<{ created: number }> }
      const created = (json.results || []).reduce((s, r) => s + r.created, 0)
      setSyncMsg(
        json.totalConflicts
          ? `⚠️ ${created} novih, ${json.totalConflicts} KONFLIKATA!`
          : `✓ Sinkronizirano — ${created} novih`
      )
      void loadReservations()
      void loadApartments()
    } catch {
      setSyncMsg('Greška pri sync-u')
    } finally {
      setSyncing(false)
    }
  }

  async function handleSyncApt(aptId: string) {
    if (syncingAptId) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setSyncingAptId(aptId)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/sync-ical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ apartment_id: aptId }),
      })
      const json = await res.json() as { totalConflicts?: number; results?: Array<{ created: number }> }
      const created = (json.results || []).reduce((s, r) => s + r.created, 0)
      setSyncMsg(
        json.totalConflicts
          ? `⚠️ ${created} novih, ${json.totalConflicts} KONFLIKATA!`
          : `✓ ${created} novih rezervacija`
      )
      void loadReservations()
      void loadApartments()
    } catch {
      setSyncMsg('Greška pri sync-u')
    } finally {
      setSyncingAptId(null)
    }
  }

  function exportUrl(apt: ApartmentSync): string {
    return `${window.location.origin}/api/ical-export?apt=${apt.id}&token=${apt.ical_export_token}`
  }

  async function copyExportUrl(apt: ApartmentSync) {
    await navigator.clipboard.writeText(exportUrl(apt))
    setCopiedId(apt.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function loadReservations() {
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

    const { data } = await supabase
      .from('reservations')
      .select('id, guest_name, guest_contact, guests_count, check_in, check_out, status, notes, platform, has_conflict, apartments(name)')
      .eq('user_id', user!.id)
      .lte('check_in', monthEnd)
      .gte('check_out', monthStart)

    setReservations((data as unknown as Reservation[]) || [])
  }

  function getReservationsForDay(day: number, y = year, m = month): Reservation[] {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return reservations.filter(r => r.check_in <= dateStr && r.check_out > dateStr)
  }

  function getReservationsForDate(date: Date): Reservation[] {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return reservations.filter(r => r.check_in <= dateStr && r.check_out > dateStr)
  }

  const isToday = (day: number, y = year, m = month) =>
    day === today.getDate() && m === today.getMonth() && y === today.getFullYear()

  const isTodayDate = (date: Date) =>
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()

  function goToPrevMonth() {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  function goToNextMonth() {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  function goToPrevWeek() {
    const d = new Date(currentDate)
    d.setDate(d.getDate() - 7)
    setCurrentDate(d)
  }

  function goToNextWeek() {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + 7)
    setCurrentDate(d)
  }

  // Touch/swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return
    const diff = touchStart - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      if (viewMode === 'month') {
        if (diff > 0) goToNextMonth()
        else goToPrevMonth()
      } else {
        if (diff > 0) goToNextWeek()
        else goToPrevWeek()
      }
    }
    setTouchStart(null)
  }

  // Header label
  const headerLabel = viewMode === 'month'
    ? `${MONTHS[month]} ${year}`
    : (() => {
        const end = weekDays[6]
        if (weekDays[0].getMonth() === end.getMonth()) {
          return `${weekDays[0].getDate()}–${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
        }
        return `${weekDays[0].getDate()} ${MONTHS[weekDays[0].getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
      })()

  return (
    <AppShell title="Kalendar">
      <CalendarReservationModal
        reservation={selectedReservation}
        onClose={() => setSelectedReservation(null)}
      />

      <div className="p-4">
        {/* View toggle */}
        <div className="flex items-center justify-center gap-1 mb-3">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === 'month'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Mjesec
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === 'week'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Tjedan
            </button>
          </div>
        </div>

        {/* Month/Week navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={viewMode === 'month' ? goToPrevMonth : goToPrevWeek}
            className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 rounded-xl text-gray-500 text-xl font-light leading-none transition-colors"
          >
            ‹
          </button>
          <h2 className="text-base font-bold text-gray-900 tracking-tight">
            {headerLabel}
          </h2>
          <button
            onClick={viewMode === 'month' ? goToNextMonth : goToNextWeek}
            className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 rounded-xl text-gray-500 text-xl font-light leading-none transition-colors"
          >
            ›
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1.5 tracking-wide uppercase">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid — swipeable */}
        <div
          className="grid grid-cols-7 select-none border-l border-t border-gray-100 rounded-xl overflow-hidden shadow-sm"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {viewMode === 'month' ? (
            <>
              {Array.from({ length: startOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[76px] border-r border-b border-gray-100 bg-gray-50/60" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dayRes = getReservationsForDay(day)
                const todayDay = isToday(day)
                return (
                  <div
                    key={day}
                    className={`min-h-[76px] border-r border-b border-gray-100 p-1.5 transition-colors ${
                      todayDay ? 'bg-blue-50' : 'hover:bg-gray-50/80'
                    }`}
                  >
                    {/* Day number */}
                    <div className="flex justify-center mb-1">
                      {todayDay ? (
                        <span className="flex items-center justify-center w-7 h-7 bg-blue-600 text-white rounded-full font-bold text-sm shadow-sm">
                          {day}
                        </span>
                      ) : (
                        <span className="flex items-center justify-center w-7 h-7 text-sm font-medium text-gray-700">
                          {day}
                        </span>
                      )}
                    </div>
                    {/* Reservations */}
                    {dayRes.slice(0, 2).map(r => (
                      <button
                        key={r.id}
                        onClick={() => setSelectedReservation(r)}
                        className={`w-full truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-tight mb-0.5 text-left transition-all hover:opacity-90 active:scale-95 ${platformClasses(r)}`}
                        title={`${r.guest_name} — ${r.apartments?.name}`}
                      >
                        {platformLabel(r)}
                      </button>
                    ))}
                    {dayRes.length > 2 && (
                      <div className="text-[10px] text-gray-400 text-center font-medium">+{dayRes.length - 2}</div>
                    )}
                  </div>
                )
              })}
            </>
          ) : (
            /* Week view — 7 days */
            weekDays.map((date) => {
              const dayRes = getReservationsForDate(date)
              const todayDay = isTodayDate(date)
              return (
                <div
                  key={date.toISOString()}
                  className={`min-h-[76px] border-r border-b border-gray-100 p-1.5 transition-colors ${
                    todayDay ? 'bg-blue-50' : 'hover:bg-gray-50/80'
                  }`}
                >
                  <div className="flex justify-center mb-1">
                    {todayDay ? (
                      <span className="flex items-center justify-center w-7 h-7 bg-blue-600 text-white rounded-full font-bold text-sm shadow-sm">
                        {date.getDate()}
                      </span>
                    ) : (
                      <span className="flex items-center justify-center w-7 h-7 text-sm font-medium text-gray-700">
                        {date.getDate()}
                      </span>
                    )}
                  </div>
                  {dayRes.slice(0, 3).map(r => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedReservation(r)}
                      className={`w-full truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-tight mb-0.5 text-left transition-all hover:opacity-90 active:scale-95 ${platformClasses(r)}`}
                      title={`${r.guest_name} — ${r.apartments?.name}`}
                    >
                      {platformLabel(r)}
                    </button>
                  ))}
                  {dayRes.length > 3 && (
                    <div className="text-[10px] text-gray-400 text-center font-medium">+{dayRes.length - 3}</div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Legenda po platformi */}
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { label: 'Booking.com', dot: 'bg-blue-500', cls: 'bg-blue-50 text-blue-800' },
            { label: 'Airbnb', dot: 'bg-rose-500', cls: 'bg-rose-50 text-rose-800' },
            { label: 'Direktno', dot: 'bg-emerald-500', cls: 'bg-emerald-50 text-emerald-800' },
            { label: '⚠️ Konflikt', dot: 'bg-orange-500', cls: 'bg-orange-50 text-orange-800' },
          ].map(({ label, dot, cls }) => (
            <div key={label} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold ${cls}`}>
              <span className={`w-2 h-2 rounded-full ${dot}`} />
              {label}
            </div>
          ))}
        </div>

        {/* Sync panel */}
        {!isDemoMode && (
          <div className="mt-4 border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setSyncOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <span className="text-sm font-semibold text-gray-700">↻ Kalendar sinkronizacija</span>
              <span className="text-gray-400 text-xs">{syncOpen ? '▲' : '▼'}</span>
            </button>

            {syncOpen && (
              <div className="p-4 space-y-4 bg-white">
                {syncMsg && (
                  <div className={`text-xs font-medium px-3 py-2 rounded-xl ${syncMsg.includes('KONFLIKAT') ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {syncMsg}
                  </div>
                )}

                {/* Po apartmanu */}
                {apartments.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-2">Nema apartmana s konfiguriranim iCal URL-ovima.<br />Dodaj ih u Moji apartmani → Uredi.</p>
                ) : (
                  <div className="space-y-3">
                    {apartments.map(apt => (
                      <div key={apt.id} className="border border-border rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-900">{apt.name}</span>
                          <div className="flex gap-1">
                            {apt.booking_ical_url
                              ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Booking ✓</span>
                              : <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">Booking —</span>
                            }
                            {apt.airbnb_ical_url
                              ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">Airbnb ✓</span>
                              : <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">Airbnb —</span>
                            }
                          </div>
                        </div>

                        {/* BepoBot export URL */}
                        {apt.ical_export_token && (
                          <div>
                            <p className="text-[10px] text-gray-400 mb-1">BepoBot → Booking/Airbnb (kopiraj i dodaj kao "Uvezi kalendar")</p>
                            <div className="flex gap-1.5">
                              <div className="flex-1 px-2 py-1.5 bg-gray-50 border border-border rounded-lg font-mono text-[9px] text-gray-500 truncate">
                                {exportUrl(apt)}
                              </div>
                              <button
                                onClick={() => void copyExportUrl(apt)}
                                className="shrink-0 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                              >
                                {copiedId === apt.id ? '✓' : 'Kopiraj'}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          {apt.ical_last_synced_at ? (
                            <span className="text-[10px] text-gray-400">
                              Zadnji sync: {new Date(apt.ical_last_synced_at).toLocaleString('hr-HR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400">Još nije sinkronizirano</span>
                          )}
                          {(apt.booking_ical_url || apt.airbnb_ical_url) && (
                            <button
                              onClick={() => void handleSyncApt(apt.id)}
                              disabled={!!syncingAptId}
                              className="text-xs font-semibold px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                            >
                              {syncingAptId === apt.id ? 'Sync...' : '↻ Sync'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Sync sve */}
                <button
                  onClick={() => void handleSyncAll()}
                  disabled={syncing || syncingAptId !== null}
                  className="w-full py-2.5 text-sm font-semibold rounded-xl bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {syncing ? 'Sinkroniziram sve...' : '↻ Sync sve apartmane'}
                </button>

                <p className="text-[10px] text-gray-400 text-center">
                  Auto-sync svaka 2h. Booking/Airbnb URL-ove postavljaš u Moji apartmani → Uredi.
                </p>
              </div>
            )}
          </div>
        )}

        {/* This month's reservations list */}
        {reservations.length > 0 && (
          <div className="mt-5 space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              {viewMode === 'month' ? 'Ovaj mjesec' : 'Ovaj tjedan'}
            </h3>
            {(viewMode === 'month' ? reservations : reservations.filter(r => {
              const ci = new Date(r.check_in + 'T00:00:00')
              const co = new Date(r.check_out + 'T00:00:00')
              const ws = weekDays[0]
              const we = weekDays[6]
              return ci <= we && co > ws
            })).map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedReservation(r)}
                className="w-full text-left bg-white rounded-2xl border border-gray-200 px-4 py-3 flex items-center justify-between hover:bg-gray-50 hover:shadow-sm active:bg-gray-100 transition-all shadow-sm"
              >
                <div className="min-w-0 flex-1 mr-3">
                  <div className="text-sm font-semibold text-gray-900 truncate">{r.guest_name}</div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">
                    {r.apartments?.name} · {new Date(r.check_in + 'T00:00:00').toLocaleDateString('hr-HR')} → {new Date(r.check_out + 'T00:00:00').toLocaleDateString('hr-HR')}
                  </div>
                </div>
                <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-xl ${platformClasses(r)}`}>
                  {r.has_conflict ? '⚠️ Konflikt' : r.platform === 'booking.com' ? 'Booking.com' : r.platform === 'airbnb' ? 'Airbnb' : r.status === 'confirmed' ? 'Direktno' : r.status === 'pending' ? 'Na čekanju' : r.status === 'cancelled' ? 'Otkazana' : 'Završena'}
                </span>
              </button>
            ))}
          </div>
        )}

        {reservations.length === 0 && !isDemoMode && (
          <div className="mt-6 bg-gray-50 rounded-xl p-6 text-center">
            <p className="text-gray-400 text-sm">Nema rezervacija za ovaj period.</p>
          </div>
        )}
      </div>
    </AppShell>
  )
}
