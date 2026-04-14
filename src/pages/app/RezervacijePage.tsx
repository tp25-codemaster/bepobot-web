import { useEffect, useState } from 'react'
import AppShell from '../../components/app/AppShell'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, isDemoMode } from '../../lib/supabase'

interface Apartment {
  id: string
  name: string
}

interface Reservation {
  id: string
  apartment_id: string
  guest_name: string
  guest_contact: string | null
  guests_count: number
  check_in: string
  check_out: string
  status: 'confirmed' | 'cancelled' | 'completed'
  notes: string | null
  apartments?: { name: string }
}

const EMPTY: Omit<Reservation, 'id' | 'apartments'> = {
  apartment_id: '',
  guest_name: '',
  guest_contact: '',
  guests_count: 1,
  check_in: '',
  check_out: '',
  status: 'confirmed',
  notes: '',
}

export default function RezervacijePage() {
  const { user } = useAuth()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<(Reservation & { isNew?: boolean }) | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming')

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
      await supabase.from('reservations').insert({ ...data, user_id: user!.id })
    } else {
      await supabase.from('reservations').update(data).eq('id', editing.id)
    }

    await loadData()
    setEditing(null)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Obrisati rezervaciju?')) return
    await supabase.from('reservations').delete().eq('id', id)
    await loadData()
  }

  function formatDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  function nights(checkIn: string, checkOut: string) {
    const d1 = new Date(checkIn)
    const d2 = new Date(checkOut)
    return Math.round((d2.getTime() - d1.getTime()) / 86400000)
  }

  function getAptName(aptId: string) {
    return apartments.find(a => a.id === aptId)?.name || 'Nepoznat'
  }

  const statusColors = {
    confirmed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
    completed: 'bg-gray-100 text-gray-600',
  }
  const statusLabels = { confirmed: 'Potvrđeno', cancelled: 'Otkazano', completed: 'Zavrseno' }

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
              {f === 'upcoming' ? 'Nadolazece' : f === 'past' ? 'Prosle' : 'Sve'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-text-muted py-8">Ucitavanje...</div>
        ) : (
          <>
            {filtered.map(r => (
              <div key={r.id} className="bg-white rounded-xl border border-border p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-text">{r.guest_name}</div>
                    <div className="text-xs text-text-muted">
                      {r.apartments?.name || getAptName(r.apartment_id)} · {r.guests_count} {r.guests_count === 1 ? 'gost' : 'gostiju'}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[r.status]}`}>
                    {statusLabels[r.status]}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-text-muted mb-2">
                  <span>📅 {formatDate(r.check_in)} → {formatDate(r.check_out)}</span>
                  <span className="text-xs">({nights(r.check_in, r.check_out)} noci)</span>
                </div>
                {r.notes && (
                  <div className="text-xs text-text-muted bg-gray-50 rounded-lg p-2 mb-2">📝 {r.notes}</div>
                )}
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setEditing({ ...r })} className="text-xs text-primary font-medium">Uredi</button>
                  <button onClick={() => handleDelete(r.id)} className="text-xs text-red-500 font-medium">Obrisi</button>
                </div>
              </div>
            ))}

            {filtered.length === 0 && !editing && (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">📅</div>
                <div className="text-text-muted text-sm">
                  {filter === 'upcoming' ? 'Nema nadolazecih rezervacija.' : 'Nema rezervacija.'}
                </div>
              </div>
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
          <div className="bg-white rounded-xl border-2 border-primary/30 p-4 space-y-3">
            <h3 className="font-semibold text-text text-sm">
              {editing.isNew ? 'Nova rezervacija' : 'Uredi rezervaciju'}
            </h3>

            <select
              value={editing.apartment_id}
              onChange={e => setEditing({ ...editing, apartment_id: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary outline-none bg-white"
            >
              <option value="">Odaberi apartman *</option>
              {apartments.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

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
                <option value="completed">Zavrseno</option>
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
    </AppShell>
  )
}
