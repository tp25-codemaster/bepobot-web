import { useEffect, useRef } from 'react'
import type { Reservation } from '../types/index'

interface CalendarReservationModalProps {
  reservation: Reservation | null
  onClose: () => void
}

function statusColor(status: string): string {
  const s = status?.toLowerCase() || ''
  if (s === 'confirmed' || s === 'active') return 'bg-green-100 border-green-400 text-green-800'
  if (s === 'pending') return 'bg-yellow-100 border-yellow-400 text-yellow-800'
  if (s === 'cancelled' || s === 'canceled') return 'bg-red-100 border-red-400 text-red-800'
  if (s === 'completed') return 'bg-gray-100 border-gray-400 text-gray-600'
  return 'bg-blue-100 border-blue-400 text-blue-800'
}

function statusLabel(status: string): string {
  const s = status?.toLowerCase() || ''
  if (s === 'confirmed') return 'Potvrđena'
  if (s === 'active') return 'Aktivna'
  if (s === 'pending') return 'Na čekanju'
  if (s === 'cancelled' || s === 'canceled') return 'Otkazana'
  if (s === 'completed') return 'Završena'
  return status
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn + 'T00:00:00')
  const b = new Date(checkOut + 'T00:00:00')
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

export default function CalendarReservationModal({ reservation, onClose }: CalendarReservationModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!reservation) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [reservation, onClose])

  if (!reservation) return null

  const nights = nightsBetween(reservation.check_in, reservation.check_out)
  const checkInFmt = new Date(reservation.check_in + 'T00:00:00').toLocaleDateString('hr-HR', {
    day: '2-digit', month: 'long', year: 'numeric'
  })
  const checkOutFmt = new Date(reservation.check_out + 'T00:00:00').toLocaleDateString('hr-HR', {
    day: '2-digit', month: 'long', year: 'numeric'
  })

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose()
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Detalji rezervacije</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Zatvori"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Guest name */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Gost</p>
            <p className="text-lg font-bold text-gray-900">{reservation.guest_name}</p>
          </div>

          {/* Apartment */}
          {reservation.apartments?.name && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Apartman</p>
              <p className="text-sm font-medium text-gray-800">{reservation.apartments.name}</p>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Check-in</p>
              <p className="text-sm font-medium text-gray-800">{checkInFmt}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Check-out</p>
              <p className="text-sm font-medium text-gray-800">{checkOutFmt}</p>
            </div>
          </div>

          {/* Nights */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Broj noći</p>
            <p className="text-sm font-medium text-gray-800">{nights} {nights === 1 ? 'noć' : nights < 5 ? 'noći' : 'noći'}</p>
          </div>

          {/* Status */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Status</p>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColor(reservation.status)}`}>
              {statusLabel(reservation.status)}
            </span>
          </div>

          {/* Contact */}
          {reservation.guest_contact && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Kontakt</p>
              <p className="text-sm font-medium text-gray-800">{reservation.guest_contact}</p>
            </div>
          )}

          {/* Guests count */}
          {reservation.guests_count !== undefined && reservation.guests_count !== null && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Broj gostiju</p>
              <p className="text-sm font-medium text-gray-800">{reservation.guests_count}</p>
            </div>
          )}

          {/* Notes */}
          {reservation.notes && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Napomene</p>
              <p className="text-sm text-gray-700">{reservation.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-4">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-700 transition-colors"
          >
            Zatvori
          </button>
        </div>
      </div>
    </div>
  )
}
