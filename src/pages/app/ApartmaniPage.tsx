import { useEffect, useState } from 'react'
import AppShell from '../../components/app/AppShell'
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
  booking_ical_url: string | null
  airbnb_ical_url: string | null
  ical_last_synced_at: string | null
}

const DEMO_APARTMENTS: Apartment[] = [
  { id: '1', name: 'Apartman 1 - Centar', wifi_ssid: 'ApartmanNet', wifi_password: 'pass1234', parking: 'Ispred kuce, mjesto 3', rules: null, checkin_instructions: null, evisitor_facility_code: '0000022', booking_ical_url: null, airbnb_ical_url: null, ical_last_synced_at: null },
  { id: '2', name: 'Apartman 2 - More', wifi_ssid: 'SeaView_WiFi', wifi_password: 'more2024', parking: 'Garaza, -1 kat', rules: null, checkin_instructions: null, evisitor_facility_code: null, booking_ical_url: null, airbnb_ical_url: null, ical_last_synced_at: null },
]

const EMPTY: Apartment = { id: '', name: '', wifi_ssid: '', wifi_password: '', parking: '', rules: '', checkin_instructions: '', evisitor_facility_code: '', booking_ical_url: '', airbnb_ical_url: '', ical_last_synced_at: null }

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

    const fields = {
      name: editing.name,
      wifi_ssid: editing.wifi_ssid || null,
      wifi_password: editing.wifi_password || null,
      parking: editing.parking || null,
      rules: editing.rules || null,
      checkin_instructions: editing.checkin_instructions || null,
      evisitor_facility_code: editing.evisitor_facility_code || null,
      booking_ical_url: editing.booking_ical_url || null,
      airbnb_ical_url: editing.airbnb_ical_url || null,
    }

    if (editing.id) {
      await supabase.from('apartments').update(fields).eq('id', editing.id)
    } else {
      await supabase.from('apartments').insert({ user_id: user!.id, ...fields })
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
            {apartments.length === 0 && !editing ? (
              <div className="text-center py-12 px-4">
                <svg viewBox="0 0 80 80" className="w-20 h-20 mx-auto mb-4 text-primary opacity-25" fill="currentColor">
                  <polygon points="40,8 72,36 8,36"/>
                  <rect x="10" y="36" width="60" height="36" rx="2"/>
                  <rect x="31" y="46" width="18" height="26" rx="2" fill="white" opacity="0.6"/>
                  <rect x="15" y="43" width="13" height="12" rx="1.5" fill="white" opacity="0.6"/>
                  <rect x="52" y="43" width="13" height="12" rx="1.5" fill="white" opacity="0.6"/>
                </svg>
                <h3 className="text-base font-semibold text-text mb-1">Nemate još apartmana</h3>
                <p className="text-sm text-text-muted max-w-xs mx-auto">Dodajte prvi apartman da počnete koristiti BepoBot. BepoBot će koristiti ove podatke za check-in info, eVisitor prijavu i koordinaciju čišćenja.</p>
                <button
                  onClick={() => setEditing({ ...EMPTY })}
                  className="mt-4 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 active:scale-95 transition-all"
                >
                  Dodaj prvi apartman
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {apartments.map(apt => (
                  <div key={apt.id} className="bg-white rounded-2xl border border-border overflow-hidden flex flex-col">
                    {/* Cover placeholder */}
                    <div className="h-24 bg-gradient-to-br from-primary/20 via-primary/10 to-indigo-100 flex items-center justify-center flex-shrink-0">
                      <svg viewBox="0 0 48 48" className="w-12 h-12 text-primary/40" fill="currentColor">
                        <polygon points="24,5 43,21 5,21"/>
                        <rect x="6" y="21" width="36" height="22" rx="1.5"/>
                        <rect x="18" y="28" width="12" height="15" rx="1.5" fill="white" opacity="0.7"/>
                        <rect x="9" y="26" width="8" height="7" rx="1" fill="white" opacity="0.7"/>
                        <rect x="31" y="26" width="8" height="7" rx="1" fill="white" opacity="0.7"/>
                      </svg>
                    </div>
                    <div className="p-3 flex flex-col gap-2 flex-1">
                      <h3 className="font-semibold text-text text-sm leading-tight">{apt.name}</h3>
                      <div className="space-y-1 flex-1">
                        {apt.evisitor_facility_code ? (
                          <div className="flex items-center gap-1.5 text-text-muted">
                            <span className="text-xs" aria-hidden="true">🏛️</span>
                            <span className="font-mono text-[10px] truncate">{apt.evisitor_facility_code}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-amber-600">
                            <span className="text-xs" aria-hidden="true">⚠️</span>
                            <span className="text-[10px]">Facility kod nije set</span>
                          </div>
                        )}
                        {apt.wifi_ssid && (
                          <div className="flex items-center gap-1.5 text-text-muted">
                            <span className="text-xs" aria-hidden="true">📶</span>
                            <span className="text-xs truncate">{apt.wifi_ssid}</span>
                          </div>
                        )}
                        {apt.parking && (
                          <div className="flex items-center gap-1.5 text-text-muted">
                            <span className="text-xs" aria-hidden="true">🅿️</span>
                            <span className="text-xs truncate">{apt.parking}</span>
                          </div>
                        )}
                      </div>
                      {/* iCal status */}
                      <div className="flex gap-1 flex-wrap mt-1">
                        {apt.booking_ical_url && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Booking ✓</span>
                        )}
                        {apt.airbnb_ical_url && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">Airbnb ✓</span>
                        )}
                        {apt.ical_last_synced_at && (
                          <span className="text-[9px] text-gray-400">
                            Sync {new Date(apt.ical_last_synced_at).toLocaleDateString('hr-HR')}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        <button
                          onClick={() => setEditing({ ...apt })}
                          className="flex-1 text-xs text-primary font-medium py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
                          aria-label={`Uredi apartman ${apt.name}`}
                        >
                          Uredi
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(apt.id)}
                          className="flex-1 text-xs text-red-500 font-medium py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          aria-label={`Obriši apartman ${apt.name}`}
                        >
                          Obriši
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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

            {/* iCal sync URLs */}
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Kalendar sinkronizacija</p>
              <div>
                <label className="block">
                  <span className="sr-only">Booking.com iCal URL</span>
                  <input
                    type="url"
                    value={editing.booking_ical_url || ''}
                    onChange={e => setEditing({ ...editing, booking_ical_url: e.target.value })}
                    placeholder="Booking.com iCal URL (https://admin.booking.com/...)"
                    aria-label="Booking.com iCal URL"
                    className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-300 outline-none font-mono text-xs"
                  />
                </label>
                <p className="text-[10px] text-text-muted mt-0.5">
                  Booking.com → Moji objekti → Kalendar → Izvoz iCal
                </p>
              </div>
              <div>
                <label className="block">
                  <span className="sr-only">Airbnb iCal URL</span>
                  <input
                    type="url"
                    value={editing.airbnb_ical_url || ''}
                    onChange={e => setEditing({ ...editing, airbnb_ical_url: e.target.value })}
                    placeholder="Airbnb iCal URL (https://www.airbnb.com/calendar/ical/...)"
                    aria-label="Airbnb iCal URL"
                    className="w-full px-3 py-2 border border-rose-200 rounded-lg text-sm focus:border-rose-400 focus:ring-1 focus:ring-rose-300 outline-none font-mono text-xs"
                  />
                </label>
                <p className="text-[10px] text-text-muted mt-0.5">
                  Airbnb → Kalendar → Dostupnost → Izvezi kalendar
                </p>
              </div>
            </div>

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
