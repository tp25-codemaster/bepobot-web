import { useEffect, useState } from 'react'
import AppShell from '../../components/app/AppShell'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, isDemoMode } from '../../lib/supabase'

const DAYS = ['Pon', 'Uto', 'Sri', 'Cet', 'Pet', 'Sub', 'Ned']
const MONTHS = ['Sijecanj', 'Veljaca', 'Ozujak', 'Travanj', 'Svibanj', 'Lipanj',
  'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac']

interface Reservation {
  id: string
  guest_name: string
  check_in: string
  check_out: string
  status: string
  apartments: { name: string } | null
}

export default function KalendarPage() {
  const { user } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [reservations, setReservations] = useState<Reservation[]>([])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  const startOffset = firstDay === 0 ? 6 : firstDay - 1

  useEffect(() => {
    if (isDemoMode || !user) return
    loadReservations()
  }, [user, currentDate])

  async function loadReservations() {
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${daysInMonth}`

    const { data } = await supabase
      .from('reservations')
      .select('id, guest_name, check_in, check_out, status, apartments(name)')
      .eq('user_id', user!.id)
      .neq('status', 'cancelled')
      .lte('check_in', monthEnd)
      .gte('check_out', monthStart)

    setReservations((data as unknown as Reservation[]) || [])
  }

  function getReservationsForDay(day: number): Reservation[] {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return reservations.filter(r => r.check_in <= dateStr && r.check_out > dateStr)
  }

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  // Color per apartment (rotate)
  const aptColors = ['bg-primary/20 text-primary', 'bg-amber-100 text-amber-700', 'bg-purple-100 text-purple-700', 'bg-rose-100 text-rose-700']
  const aptColorMap = new Map<string, string>()
  let colorIdx = 0
  reservations.forEach(r => {
    const aptName = r.apartments?.name || '?'
    if (!aptColorMap.has(aptName)) {
      aptColorMap.set(aptName, aptColors[colorIdx % aptColors.length])
      colorIdx++
    }
  })

  return (
    <AppShell title="Kalendar">
      <div className="p-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 hover:bg-gray-100 rounded-lg text-text-muted text-lg">
            ‹
          </button>
          <h2 className="text-lg font-semibold text-text">
            {MONTHS[month]} {year}
          </h2>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 hover:bg-gray-100 rounded-lg text-text-muted text-lg">
            ›
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-xs font-medium text-text-muted py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[60px]" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dayRes = getReservationsForDay(day)
            return (
              <div
                key={day}
                className={`min-h-[60px] rounded-lg p-1 text-xs transition-colors ${
                  isToday(day) ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-gray-50'
                }`}
              >
                <div className={`font-medium mb-0.5 ${isToday(day) ? 'text-primary' : 'text-text'}`}>
                  {day}
                </div>
                {dayRes.slice(0, 2).map(r => (
                  <div
                    key={r.id}
                    className={`truncate rounded px-0.5 text-[9px] font-medium leading-tight mb-0.5 ${
                      aptColorMap.get(r.apartments?.name || '?') || aptColors[0]
                    }`}
                    title={`${r.guest_name} - ${r.apartments?.name}`}
                  >
                    {r.guest_name.split(' ')[0]}
                  </div>
                ))}
                {dayRes.length > 2 && (
                  <div className="text-[9px] text-text-muted">+{dayRes.length - 2}</div>
                )}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        {reservations.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {Array.from(aptColorMap.entries()).map(([name, color]) => (
              <div key={name} className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${color}`}>
                {name}
              </div>
            ))}
          </div>
        )}

        {/* This month's reservations list */}
        {reservations.length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-semibold text-text">Ovaj mjesec</h3>
            {reservations.map(r => (
              <div key={r.id} className="bg-white rounded-lg border border-border p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-text">{r.guest_name}</div>
                  <div className="text-xs text-text-muted">
                    {r.apartments?.name} · {new Date(r.check_in + 'T00:00:00').toLocaleDateString('hr-HR')} → {new Date(r.check_out + 'T00:00:00').toLocaleDateString('hr-HR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {reservations.length === 0 && !isDemoMode && (
          <div className="mt-6 bg-gray-50 rounded-xl p-4 text-center">
            <p className="text-text-muted text-sm">Nema rezervacija za ovaj mjesec.</p>
          </div>
        )}
      </div>
    </AppShell>
  )
}
