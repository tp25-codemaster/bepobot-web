import { useEffect, useState } from 'react'
import AppShell from '../../components/app/AppShell'
import EmptyState from '../../components/app/EmptyState'
import ConfirmModal from '../../components/ConfirmModal'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, isDemoMode } from '../../lib/supabase'

interface Apartment {
  id: string
  name: string
  wifi_ssid: string | null
  wifi_password: string | null
  parking: string | null
  rules: string | null
  checkin_instructions: string | null
  evisitor_facility_code: string | null
}

const DEMO_APARTMENTS: Apartment[] = [
  { id: '1', name: 'Apartman 1 - Centar', wifi_ssid: 'ApartmanNet', wifi_password: 'pass1234', parking: 'Ispred kuce, mjesto 3', rules: null, checkin_instructions: null, evisitor_facility_code: '0000022' },
  { id: '2', name: 'Apartman 2 - More', wifi_ssid: 'SeaView_WiFi', wifi_password: 'more2024', parking: 'Garaza, -1 kat', rules: null, checkin_instructions: null, evisitor_facility_code: null },
]

const EMPTY: Apartment = { id: '', name: '', wifi_ssid: '', wifi_password: '', parking: '', rules: '', checkin_instructions: '', evisitor_facility_code: '' }

export default function ApartmaniPage() {
  const { user } = useAuth()
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Apartment | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Load apartments
  useEffect(() => {
    if (isDemoMode) {
      setApartments(DEMO_APARTMENTS)
      setLoading(false)
      return
    }
    if (!user) return
    loadApartments()
  }, [user])

  async function loadApartments() {
    setLoading(true)
    const { data } = await supabase
      .from('apartments')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: true })
    setApartments((data as Apartment[]) || [])
    setLoading(false)
  }

  async function handleSave() {
    if (!editing || !editing.name.trim()) return
    setSaving(true)

    if (isDemoMode) {
      if (editing.id) {
        setApartments(prev => prev.map(a => a.id === editing.id ? editing : a))
      } else {
        setApartments(prev => [...prev, { ...editing, id: Date.now().toString() }])
      }
      setEditing(null)
      setSaving(false)
      return
    }

    if (editing.id) {
      // Update
      await supabase
        .from('apartments')
        .update({
          name: editing.name,
          wifi_ssid: editing.wifi_ssid || null,
          wifi_password: editing.wifi_password || null,
          parking: editing.parking || null,
          rules: editing.rules || null,
          checkin_instructions: editing.checkin_instructions || null,
          evisitor_facility_code: editing.evisitor_facility_code || null,
        })
        .eq('id', editing.id)
    } else {
      // Insert
      await supabase
        .from('apartments')
        .insert({
          user_id: user!.id,
          name: editing.name,
          wifi_ssid: editing.wifi_ssid || null,
          wifi_password: editing.wifi_password || null,
          parking: editing.parking || null,
          rules: editing.rules || null,
          checkin_instructions: editing.checkin_instructions || null,
          evisitor_facility_code: editing.evisitor_facility_code || null,
        })
    }

    await loadApartments()
    setEditing(null)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (isDemoMode) {
      setApartments(prev => prev.filter(a => a.id !== id))
      setDeleteConfirmId(null)
      return
    }

    await supabase.from('apartments').delete().eq('id', id)
    setDeleteConfirmId(null)
    await loadApartments()
  }

  return (
    <AppShell title="Moji apartmani">
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {apartments.map(apt => (
              <div key={apt.id} className="bg-white rounded-xl border border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-text">{apt.name}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditing({ ...apt })}
                      className="text-xs text-primary font-medium"
                      aria-label={`Uredi apartman ${apt.name}`}
                    >
                      Uredi
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(apt.id)}
                      className="text-xs text-red-500 font-medium"
                      aria-label={`Obriši apartman ${apt.name}`}
                    >
                      Obriši
                    </button>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {apt.evisitor_facility_code ? (
                    <div className="flex items-center gap-2 text-text-muted">
                      <span aria-hidden="true">🏛️</span>
                      <span className="font-mono text-xs">eVisitor: {apt.evisitor_facility_code}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-600">
                      <span aria-hidden="true">⚠️</span>
                      <span className="text-xs">eVisitor Facility kod nije postavljen</span>
                    </div>
                  )}
                  {apt.wifi_ssid && (
                    <div className="flex items-center gap-2 text-text-muted">
                      <span aria-hidden="true">📶</span>
                      <span>{apt.wifi_ssid} / {apt.wifi_password}</span>
                    </div>
                  )}
                  {apt.parking && (
                    <div className="flex items-center gap-2 text-text-muted">
                      <span aria-hidden="true">🅿️</span>
                      <span>{apt.parking}</span>
                    </div>
                  )}
                  {apt.rules && (
                    <div className="flex items-center gap-2 text-text-muted">
                      <span aria-hidden="true">📋</span>
                      <span>{apt.rules}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {apartments.length === 0 && !editing && (
              <EmptyState
                icon="🏠"
                title="Nemate još apartmana"
                description="Dodajte prvi apartman da počnete koristiti BepoBot. BepoBot će koristiti ove podatke za check-in info, eVisitor prijavu i koordinaciju čišćenja."
                actionLabel="Dodaj prvi apartman"
                onAction={() => setEditing({ ...EMPTY })}
              />
            )}

            {!editing && (
              <button
                onClick={() => setEditing({ ...EMPTY })}
                className="w-full py-3 border-2 border-dashed border-border rounded-xl text-text-muted text-sm font-medium hover:border-primary hover:text-primary transition-colors"
              >
                + Dodaj apartman
              </button>
            )}
          </>
        )}

        {/* Edit/Add form */}
        {editing && (
          <div className="bg-white rounded-xl border-2 border-primary/30 p-4 space-y-3">
            <h3 className="font-semibold text-text text-sm">
              {editing.id ? 'Uredi apartman' : 'Novi apartman'}
            </h3>
            <label className="block">
              <span className="sr-only">Naziv apartmana (obavezno)</span>
              <input
                type="text"
                value={editing.name}
                onChange={e => setEditing({ ...editing, name: e.target.value })}
                placeholder="Naziv apartmana *"
                aria-label="Naziv apartmana"
                aria-required="true"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </label>
            <div>
              <label className="block">
                <span className="sr-only">eVisitor Facility kod</span>
                <input
                  type="text"
                  value={editing.evisitor_facility_code || ''}
                  onChange={e => setEditing({ ...editing, evisitor_facility_code: e.target.value })}
                  placeholder="eVisitor Facility kod (npr. 0000022)"
                  aria-label="eVisitor Facility kod"
                  aria-describedby="evisitor-hint"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono"
                />
              </label>
              <p id="evisitor-hint" className="text-xs text-text-muted mt-1">
                🏛️ Kod koji eVisitor koristi za ovaj objekt. Potreban za auto prijavu gostiju.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="sr-only">WiFi naziv</span>
                <input
                  type="text"
                  value={editing.wifi_ssid || ''}
                  onChange={e => setEditing({ ...editing, wifi_ssid: e.target.value })}
                  placeholder="WiFi naziv"
                  aria-label="WiFi naziv"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              </label>
              <label className="block">
                <span className="sr-only">WiFi lozinka</span>
                <input
                  type="text"
                  value={editing.wifi_password || ''}
                  onChange={e => setEditing({ ...editing, wifi_password: e.target.value })}
                  placeholder="WiFi lozinka"
                  aria-label="WiFi lozinka"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              </label>
            </div>
            <label className="block">
              <span className="sr-only">Parking upute</span>
              <input
                type="text"
                value={editing.parking || ''}
                onChange={e => setEditing({ ...editing, parking: e.target.value })}
                placeholder="Parking upute"
                aria-label="Parking upute"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </label>
            <label className="block">
              <span className="sr-only">Pravila kuće</span>
              <textarea
                value={editing.rules || ''}
                onChange={e => setEditing({ ...editing, rules: e.target.value })}
                placeholder="Pravila kuce (opcionalno)"
                aria-label="Pravila kuće"
                rows={2}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
              />
            </label>
            <label className="block">
              <span className="sr-only">Check-in upute</span>
              <textarea
                value={editing.checkin_instructions || ''}
                onChange={e => setEditing({ ...editing, checkin_instructions: e.target.value })}
                placeholder="Check-in upute (opcionalno)"
                aria-label="Check-in upute"
                rows={2}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
              />
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !editing.name.trim()}
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
        title="Obriši apartman"
        message="Jesi li siguran/a da želiš obrisati ovaj apartman? Ova radnja se ne može poništiti."
        confirmLabel="Obriši"
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
        danger
      />
    </AppShell>
  )
}
