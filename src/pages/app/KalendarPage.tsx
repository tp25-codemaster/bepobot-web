import { useState } from 'react'
import AppShell from '../../components/app/AppShell'

const DAYS = ['Pon', 'Uto', 'Sri', 'Cet', 'Pet', 'Sub', 'Ned']
const MONTHS = ['Sijecanj', 'Veljaca', 'Ozujak', 'Travanj', 'Svibanj', 'Lipanj',
  'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac']

export default function KalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  // Monday-based offset
  const startOffset = firstDay === 0 ? 6 : firstDay - 1

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1))
  }
  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  return (
    <AppShell title="Kalendar">
      <div className="p-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg text-text-muted">
            ‹
          </button>
          <h2 className="text-lg font-semibold text-text">
            {MONTHS[month]} {year}
          </h2>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg text-text-muted">
            ›
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-xs font-medium text-text-muted py-2">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            return (
              <button
                key={day}
                className={`aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                  isToday(day)
                    ? 'bg-primary text-white'
                    : 'hover:bg-primary/10 text-text'
                }`}
              >
                {day}
              </button>
            )
          })}
        </div>

        {/* Placeholder for reservations */}
        <div className="mt-6 bg-gray-50 rounded-xl p-4 text-center">
          <p className="text-text-muted text-sm">
            Rezervacije ce se prikazivati ovdje nakon povezivanja sa Supabaseom.
          </p>
          <p className="text-xs text-text-muted mt-1">
            Kliknite na datum da pitajte bota "Sto imam [datum]?"
          </p>
        </div>
      </div>
    </AppShell>
  )
}
