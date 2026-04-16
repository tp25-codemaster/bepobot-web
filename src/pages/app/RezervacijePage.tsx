import { useEffect, useRef, useState } from 'react'
import AppShell from '../../components/app/AppShell'
import EmptyState from '../../components/app/EmptyState'
import ConfirmModal from '../../components/ConfirmModal'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, isDemoMode } from '../../lib/supabase'
import {
  generateReservationToken,
  checkInReservation,
  formatCheckInError,
} from '../../lib/reservations'
import type { Apartment, Reservation } from '../../types/index'
import { formatDate, nights } from '../../lib/dateUtils'

const EMPTY: Omit<Reservation, 'id' | 'apartments'> = {
  apartment_id: '',
  guest_name: '',
  guest_contact: '',
  guests_count: 1,
  check_in: '',
  check_out: '',
  status: 'confirmed',
  notes: '',
  token: null,
  tourist_name: null,
  tourist_surname: null,
  completed_at: null,
  evisitor_checked_in_at: null,
  evisitor_tourist_id: null,
  evisitor_error: null,
}

export default function RezervacijePage() {
  const { user } = useAuth()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<(Reservation & { isNew?: boolean }) | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to edit form when it opens (so user doesn't lose it at bottom
  // of the list after clicking "Uredi" on a card near the top).
  useEffect(() => {
    if (editing && formRef.current) {
      // Short delay so the form has actually rendered
      const t = setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
      return () => clearTimeout(t)
    }
  }, [editing])

  useEffect(() => {
    if (isDemoMode) {
      setLoading(false)
      return
    }
    if (!user) return
    loadData()
  }, [user])

  async function loadData() {
    setLoading(true)
    const [resResult, aptResult] = await Promise.all([
      supabase
        .from('reservations')
        .select('*, apartments(name)')
        .eq('user_id', user!.id)
        .order('check_in', { ascending: true }),
      supabase
        .from('apartments')
        .select('id, name')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true }),
    ])
    setReservations((resResult.data as Reservation[]) || [])
    setApartments((aptResult.data as Apartment[]) || [])
    setLoading(false)
  }

  const today = new Date().toISOString().split('T')[0]

  const filtered = reservations.filter(r => {
    if (filter === 'upcoming') return r.check_out >= today && r.status !== 'cancelled'
    if (filter === 'past') return r.check_out < today || r.status === 'completed'
    return true
  })

  async function handleSave() {
    if (!editing || !editing.guest_name.trim() || !editing.apartment_id || !editing.check_in || !editing.check_out) return
    setSaving(true)

    const data = {
      apartment_id: editing.apartment_id,
      guest_name: editing.guest_name,
      guest_contact: editing.guest_contact || null,
      guests_count: editing.guests_count,
      check_in: editing.check_in,
      check_out: editing.check_out,
      status: editing.status,
      notes: editing.notes || null,
    }

    if (editing.isNew) {
      // Auto-generate self-checkin token on create
      await supabase
        .from('reservations')
        .insert({ ...data, user_id: user!.id, token: generateReservationToken() })
    } else {
      await supabase.from('reservations').update(data).eq('id', editing.id)
    }

    await loadData()
    setEditing(null)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('reservations').delete().eq('id', id)
    setDeleteConfirmId(null)
    await loadData()
  }

  function getAptName(aptId: string) {
    return apartments.find(a => a.id === aptId)?.name || 'Nepoznat'
  }

  const statusColors = {
    confirmed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
    completed: 'bg-gray-100 text-gray-600',
  }
  const statusLabels = { confirmed: 'Potvrđeno', cancelled: 'Otkazano', completed: 'Završeno' }

  return (
    <AppShell title="Rezervacije">
      <div className="p-4 space-y-3">
        {/* Filter tabs */}
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          {(['upcoming', 'past', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === f ? 'bg-white text-text shadow-sm' : 'text-text-muted'
              }`}
            >
              {f === 'upcoming' ? 'Nadolazeće' : f === 'past' ? 'Prošle' : 'Sve'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {filtered.map(r => (
              <ReservationCard
                key={r.id}
                r={r}
                apartmentName={r.apartments?.name || getAptName(r.apartment_id ?? '')}
                formatDate={formatDate}
                nights={nights}
                statusColors={statusColors}
                statusLabels={statusLabels}
                onEdit={() => setEditing({ ...r })}
                onDelete={() => setDeleteConfirmId(r.id)}
                onRefresh={loadData}
              />
            ))}

            {filtered.length === 0 && !editing && (
              <EmptyState
                icon="📅"
                title={filter === 'upcoming' ? 'Nema nadolazećih rezervacija' : filter === 'past' ? 'Nema prošlih rezervacija' : 'Još nemate rezervacija'}
                description={apartments.length === 0
                  ? 'Prvo dodajte apartman u bočnom meniju, pa se vratite ovdje.'
                  : 'Dodajte ručno ili pustite BepoBota da automatski hvata booking emailove iz Gmaila.'}
              />
            )}

            {!editing && (
              <button
                onClick={() => setEditing({ ...EMPTY, id: '', isNew: true, apartment_id: apartments[0]?.id || '' } as any)}
                disabled={apartments.length === 0}
                className="w-full py-3 border-2 border-dashed border-border rounded-xl text-text-muted text-sm font-medium hover:border-primary hover:text-primary transition-colors disabled:opacity-40"
              >
                {apartments.length === 0 ? 'Prvo dodajte apartman' : '+ Nova rezervacija'}
              </button>
            )}
          </>
        )}

        {/* Form */}
        {editing && (
          <div
            ref={formRef}
            className="bg-white rounded-xl border-2 border-primary/30 p-4 space-y-3 scroll-mt-24"
          >
            <h3 className="font-semibold text-text text-sm">
              {editing.isNew ? 'Nova rezervacija' : 'Uredi rezervaciju'}
            </h3>

            <div>
              <label className="block text-xs text-text-muted mb-1">
                Apartman *
              </label>
              <select
                value={editing.apartment_id}
                onChange={e => setEditing({ ...editing, apartment_id: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg text-sm outline-none bg-white transition-colors ${
                  !editing.apartment_id
                    ? 'border-red-400 focus:border-red-500 ring-1 ring-red-200'
                    : 'border-border focus:border-primary'
                }`}
              >
                <option value="">— odaberi apartman —</option>
                {apartments.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              {!editing.apartment_id && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <span>⚠️</span>
                  <span>Apartman je obavezan za prijavu na eVisitor</span>
                </p>
              )}
            </div>

            <input
              type="text"
              value={editing.guest_name}
              onChange={e => setEditing({ ...editing, guest_name: e.target.value })}
              placeholder="Ime gosta *"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={editing.guest_contact || ''}
                onChange={e => setEditing({ ...editing, guest_contact: e.target.value })}
                placeholder="Kontakt (tel/email)"
                className="px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
              <input
                type="number"
                min={1}
                max={20}
                value={editing.guests_count}
                onChange={e => setEditing({ ...editing, guests_count: parseInt(e.target.value) || 1 })}
                placeholder="Broj gostiju"
                className="px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-text-muted mb-1">Dolazak *</label>
                <input
                  type="date"
                  value={editing.check_in}
                  onChange={e => setEditing({ ...editing, check_in: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Odlazak *</label>
                <input
                  type="date"
                  value={editing.check_out}
                  onChange={e => setEditing({ ...editing, check_out: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary outline-none"
                />
              </div>
            </div>

            {!editing.isNew && (
              <select
                value={editing.status}
                onChange={e => setEditing({ ...editing, status: e.target.value as Reservation['status'] })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary outline-none bg-white"
              >
                <option value="confirmed">Potvrđeno</option>
                <option value="completed">Završeno</option>
                <option value="cancelled">Otkazano</option>
              </select>
            )}

            <textarea
              value={editing.notes || ''}
              onChange={e => setEditing({ ...editing, notes: e.target.value })}
              placeholder="Napomene (opcionalno)"
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
            />

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !editing.guest_name.trim() || !editing.apartment_id || !editing.check_in || !editing.check_out}
                className="flex-1 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Spremam...' : 'Spremi'}
              </button>
              <button
                onClick={() => setEditing(null)}
                className="flex-1 py-2 bg-gray-100 text-text-muted text-sm font-medium rounded-lg"
              >
                Odustani
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={deleteConfirmId !== null}
        title="Obriši rezervaciju"
        message="Jesi li siguran/a da želiš obrisati ovu rezervaciju? Ova radnja se ne može poništiti."
        confirmLabel="Obriši"
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
        danger
      />
    </AppShell>
  )
}

// ─── ReservationCard with self-checkin section ────────────────────────────

interface ReservationCardProps {
  r: Reservation
  apartmentName: string
  formatDate: (d: string) => string
  nights: (a: string, b: string) => number
  statusColors: Record<string, string>
  statusLabels: Record<string, string>
  onEdit: () => void
  onDelete: () => void
  onRefresh: () => void
}

function ReservationCard({
  r,
  apartmentName,
  formatDate,
  nights,
  statusColors,
  statusLabels,
  onEdit,
  onDelete,
  onRefresh,
}: ReservationCardProps) {
  const [copied, setCopied] = useState(false)
  const [generatingToken, setGeneratingToken] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const hasGuestData = Boolean(r.tourist_name)
  const hasEvisitorCheckin = Boolean(r.evisitor_checked_in_at)
  const link = r.token ? `${window.location.origin}/checkin/${r.token}` : ''

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  async function handleGenerateToken() {
    setGeneratingToken(true)
    const token = generateReservationToken()
    await supabase.from('reservations').update({ token }).eq('id', r.id)
    setGeneratingToken(false)
    onRefresh()
  }

  async function handleCheckIn(testMode: boolean) {
    setCheckingIn(true)
    setError(null)
    setResult(null)
    const res = await checkInReservation(r.id, testMode)
    if (res.success) {
      setResult(testMode ? 'Test OK ✓' : 'Prijavljeno na eVisitor ✓')
      // Ne refreshamo za test mode — ništa se na backendu ne mijenja,
      // a refresh bi remountao karticu i obrisao poruku.
      if (!testMode) onRefresh()
    } else {
      setError(formatCheckInError(res))
    }
    setCheckingIn(false)
  }

  // Guest check-in status pill (shows self-checkin state, independent of host status)
  let selfCheckinBadge: { label: string; cls: string } | null = null
  if (r.token) {
    if (hasEvisitorCheckin) {
      selfCheckinBadge = { label: '✓ Prijavljen', cls: 'bg-green-100 text-green-700' }
    } else if (hasGuestData) {
      selfCheckinBadge = { label: '📝 Popunjeno', cls: 'bg-blue-100 text-blue-700' }
    } else {
      selfCheckinBadge = { label: '⏳ Čeka gosta', cls: 'bg-yellow-100 text-yellow-800' }
    }
  }

  return (
    <div className="bg-white rounded-xl border border-border p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-semibold text-text">{r.guest_name}</div>
          <div className="text-xs text-text-muted">
            {apartmentName} · {r.guests_count} {r.guests_count === 1 ? 'gost' : 'gostiju'}
          </div>
        </div>
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[r.status]}`}>
          {statusLabels[r.status]}
        </span>
      </div>
      <div className="flex items-center gap-4 text-sm text-text-muted mb-2">
        <span>📅 {formatDate(r.check_in)} → {formatDate(r.check_out)}</span>
        <span className="text-xs">({nights(r.check_in, r.check_out)} noći)</span>
      </div>
      {r.notes && (
        <div className="text-xs text-text-muted bg-gray-50 rounded-lg p-2 mb-2">📝 {r.notes}</div>
      )}

      {/* Self-checkin section */}
      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wide">
            Self check-in
          </div>
          {selfCheckinBadge && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${selfCheckinBadge.cls}`}>
              {selfCheckinBadge.label}
            </span>
          )}
        </div>

        {!r.token ? (
          <button
            onClick={handleGenerateToken}
            disabled={generatingToken}
            className="w-full py-2 text-xs font-medium border-2 border-dashed border-border rounded-lg text-text-muted hover:border-primary hover:text-primary transition-colors"
          >
            {generatingToken ? 'Generiram...' : '🔗 Generiraj link za gosta'}
          </button>
        ) : (
          <div className="space-y-2">
            {hasGuestData && (
              <div className="text-xs bg-blue-50 border border-blue-200 rounded p-2">
                👤 {r.tourist_name} {r.tourist_surname}
                {r.completed_at && (
                  <div className="text-blue-600 mt-0.5">
                    Popunjeno {new Date(r.completed_at).toLocaleString('hr-HR')}
                  </div>
                )}
              </div>
            )}
            {hasEvisitorCheckin && r.evisitor_checked_in_at && (
              <div className="text-xs bg-green-50 border border-green-200 rounded p-2 text-green-800">
                🏛️ eVisitor: prijavljen {new Date(r.evisitor_checked_in_at).toLocaleString('hr-HR')}
                {r.evisitor_tourist_id && <> · ID {r.evisitor_tourist_id}</>}
              </div>
            )}
            {result && (
              <div className="text-xs bg-green-50 border border-green-200 rounded p-2 text-green-700">
                {result}
              </div>
            )}
            {error && (
              <div className="text-xs bg-red-50 border border-red-200 rounded p-2 text-red-700 break-words">
                {error}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleCopyLink}
                className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-text-muted font-medium rounded-lg transition-colors"
              >
                {copied ? '✓ Kopirano' : '📋 Kopiraj link'}
              </button>
              {hasGuestData && !hasEvisitorCheckin && (
                <>
                  <button
                    onClick={() => handleCheckIn(true)}
                    disabled={checkingIn}
                    className="text-xs px-3 py-1.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    🧪 Test
                  </button>
                  <button
                    onClick={() => handleCheckIn(false)}
                    disabled={checkingIn}
                    className="text-xs px-3 py-1.5 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    🏛️ Prijavi na eVisitor
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-3">
        <button onClick={onEdit} className="text-xs text-primary font-medium">Uredi</button>
        <button onClick={onDelete} className="text-xs text-red-500 font-medium">Obriši</button>
      </div>
    </div>
  )
}
