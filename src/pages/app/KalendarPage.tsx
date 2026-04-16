import { useEffect, useState } from 'react'
import AppShell from '../../components/app/AppShell'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, isDemoMode } from '../../lib/supabase'
import CalendarReservationModal from '../../components/CalendarReservationModal'
import type { Reservation } from '../../types/index'

const DAYS = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned']
const MONTHS = ['Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj',
  'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac']

type ViewMode = 'month' | 'week'

function statusClasses(status: string): string {
  const s = status?.toLowerCase() || ''
  if (s === 'confirmed' || s === 'active') return 'bg-green-100 border-green-400 text-green-800'
  if (s === 'pending') return 'bg-yellow-100 border-yellow-400 text-yellow-800'
  if (s === 'cancelled' || s === 'canceled') return 'bg-red-100 border-red-400 text-red-800'
  if (s === 'completed') return 'bg-gray-100 border-gray-400 text-gray-600'
  return 'bg-blue-100 border-blue-400 text-blue-800'
}

export default function KalendarPage() {
  const { user } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [touchStart, setTouchStart] = useState<number | null>(null)

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
  }, [user, currentDate])

  async function loadReservations() {
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

    const { data } = await supabase
      .from('reservations')
      .select('id, guest_name, guest_contact, guests_count, check_in, check_out, status, notes, apartments(name)')
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
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 text-xl font-light leading-none"
          >
            ‹
          </button>
          <h2 className="text-base font-semibold text-gray-900">
            {headerLabel}
          </h2>
          <button
            onClick={viewMode === 'month' ? goToNextMonth : goToNextWeek}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 text-xl font-light leading-none"
          >
            ›
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid — swipeable */}
        <div
          className="grid grid-cols-7 gap-1 select-none"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {viewMode === 'month' ? (
            <>
              {Array.from({ length: startOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[64px]" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dayRes = getReservationsForDay(day)
                const todayDay = isToday(day)
                return (
                  <div
                    key={day}
                    className={`min-h-[64px] rounded-lg p-1 transition-colors ${
                      todayDay ? 'bg-blue-50 ring-1 ring-blue-400' : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* Day number */}
                    <div className="flex justify-center mb-0.5">
                      {todayDay ? (
                        <span className="flex items-center justify-center w-7 h-7 bg-blue-600 text-white rounded-full font-bold text-sm">
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
                        className={`w-full truncate rounded border px-1 text-xs font-medium leading-tight mb-0.5 text-left transition-opacity hover:opacity-80 active:opacity-60 ${statusClasses(r.status)}`}
                        title={`${r.guest_name} — ${r.apartments?.name}`}
                      >
                        {r.guest_name.split(' ')[0]}
                      </button>
                    ))}
                    {dayRes.length > 2 && (
                      <div className="text-[10px] text-gray-400 text-center">+{dayRes.length - 2}</div>
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
                  className={`min-h-[64px] rounded-lg p-1 transition-colors ${
                    todayDay ? 'bg-blue-50 ring-1 ring-blue-400' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-center mb-0.5">
                    {todayDay ? (
                      <span className="flex items-center justify-center w-7 h-7 bg-blue-600 text-white rounded-full font-bold text-sm">
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
                      className={`w-full truncate rounded border px-1 text-xs font-medium leading-tight mb-0.5 text-left transition-opacity hover:opacity-80 active:opacity-60 ${statusClasses(r.status)}`}
                      title={`${r.guest_name} — ${r.apartments?.name}`}
                    >
                      {r.guest_name.split(' ')[0]}
                    </button>
                  ))}
                  {dayRes.length > 3 && (
                    <div className="text-[10px] text-gray-400 text-center">+{dayRes.length - 3}</div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Status legend */}
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { label: 'Potvrđena', cls: 'bg-green-100 border-green-400 text-green-800' },
            { label: 'Na čekanju', cls: 'bg-yellow-100 border-yellow-400 text-yellow-800' },
            { label: 'Otkazana', cls: 'bg-red-100 border-red-400 text-red-800' },
            { label: 'Završena', cls: 'bg-gray-100 border-gray-400 text-gray-600' },
          ].map(({ label, cls }) => (
            <div key={label} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cls}`}>
              {label}
            </div>
          ))}
        </div>

        {/* This month's reservations list */}
        {reservations.length > 0 && (
          <div className="mt-5 space-y-2">
            <h3 className="text-sm font-semibold text-gray-800">
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
                className="w-full text-left bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div>
                  <div className="text-sm font-semibold text-gray-900">{r.guest_name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {r.apartments?.name} · {new Date(r.check_in + 'T00:00:00').toLocaleDateString('hr-HR')} → {new Date(r.check_out + 'T00:00:00').toLocaleDateString('hr-HR')}
                  </div>
                </div>
                <span className={`ml-3 shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${statusClasses(r.status)}`}>
                  {r.status}
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
