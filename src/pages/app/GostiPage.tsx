import { useEffect, useMemo, useState } from 'react'
import AppShell from '../../components/app/AppShell'
import ConfirmModal from '../../components/ConfirmModal'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { ReservationRow, GuestAggregate } from '../../types/index'
import { formatDate, nights } from '../../lib/dateUtils'

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-teal-500', 'bg-green-500',
  'bg-amber-500', 'bg-orange-500', 'bg-red-500', 'bg-pink-500',
]

const COUNTRY_FLAGS: Record<string, string> = {
  HRV: '🇭🇷',
  ITA: '🇮🇹',
  DEU: '🇩🇪',
  AUT: '🇦🇹',
  SVN: '🇸🇮',
  HUN: '🇭🇺',
  CZE: '🇨🇿',
  POL: '🇵🇱',
  FRA: '🇫🇷',
  GBR: '🇬🇧',
  USA: '🇺🇸',
}

export default function GostiPage() {
  const { user, profile, session } = useAuth()
  const [rows, setRows] = useState<ReservationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<GuestAggregate | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [findingContacts, setFindingContacts] = useState(false)
  const [contactResult, setContactResult] = useState<string | null>(null)
  const [minStays, setMinStays] = useState(0)
  const [confirmImport, setConfirmImport] = useState(false)
  const [confirmFindContacts, setConfirmFindContacts] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('reservations')
        .select(
          'id, tourist_name, tourist_surname, gender, date_of_birth, document_type, document_number, citizenship, city_of_residence, residence_address, guest_email, guest_phone, check_in, check_out, apartment_id, completed_at, evisitor_checked_in_at, created_at, apartments(name)'
        )
        .eq('user_id', user.id)
        .not('tourist_name', 'is', null)
        .order('check_in', { ascending: false })
      if (cancelled) return
      // Supabase joins return arrays for related tables, normalize to first item.
      const normalized = ((data as unknown as Array<
        Omit<ReservationRow, 'apartments'> & {
          apartments: Array<{ name: string }> | { name: string } | null
        }
      >) || []).map((r) => ({
        ...r,
        apartments: Array.isArray(r.apartments)
          ? (r.apartments[0] || null)
          : r.apartments,
      }))
      setRows(normalized as ReservationRow[])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  // Aggregate by (name + surname + document_number)
  const guests = useMemo<GuestAggregate[]>(() => {
    const map = new Map<string, GuestAggregate>()
    for (const r of rows) {
      const name = (r.tourist_name || '').trim()
      const surname = (r.tourist_surname || '').trim()
      const doc = (r.document_number || '').trim().toUpperCase()
      if (!name && !surname) continue
      const key =
        `${name.toLowerCase()}|${surname.toLowerCase()}|${doc}`.trim()
      let agg = map.get(key)
      if (!agg) {
        agg = {
          key,
          name,
          surname,
          email: r.guest_email || null,
          phone: r.guest_phone || null,
          citizenship: r.citizenship || null,
          city: r.city_of_residence || null,
          dateOfBirth: r.date_of_birth || null,
          documentNumber: r.document_number || null,
          stays: [],
          totalStays: 0,
          lastStay: null,
          totalNights: 0,
        }
        map.set(key, agg)
      }
      agg.stays.push(r)
      agg.totalStays += 1
      agg.totalNights += nights(r.check_in, r.check_out)
      const rowDate = r.check_in || r.completed_at || r.created_at
      if (!agg.lastStay || (rowDate && rowDate > agg.lastStay)) {
        agg.lastStay = rowDate
      }
      // Prefer non-null contact info
      if (!agg.email && r.guest_email) agg.email = r.guest_email
      if (!agg.phone && r.guest_phone) agg.phone = r.guest_phone
      if (!agg.city && r.city_of_residence) agg.city = r.city_of_residence
    }
    const list = Array.from(map.values())
    list.sort((a, b) => {
      if (a.lastStay && b.lastStay) return b.lastStay.localeCompare(a.lastStay)
      return 0
    })
    return list
  }, [rows])

  const filtered = useMemo(() => {
    let list = guests
    if (minStays > 0) {
      list = list.filter((g) => g.totalStays >= minStays)
    }
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((g) =>
        `${g.name} ${g.surname}`.toLowerCase().includes(q) ||
        (g.email || '').toLowerCase().includes(q) ||
        (g.phone || '').toLowerCase().includes(q) ||
        (g.city || '').toLowerCase().includes(q) ||
        (g.citizenship || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [guests, search, minStays])

  async function handleImport() {
    if (!session?.access_token) return
    setConfirmImport(false)
    setImporting(true)
    setImportResult(null)
    try {
      const res = await fetch('/api/evisitor-import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (data.success) {
        setImportResult(data.message)
        // Reload guests
        const { data: newRows } = await supabase
          .from('reservations')
          .select('id, tourist_name, tourist_surname, gender, date_of_birth, document_type, document_number, citizenship, city_of_residence, residence_address, guest_email, guest_phone, check_in, check_out, apartment_id, completed_at, evisitor_checked_in_at, created_at, apartments(name)')
          .eq('user_id', user!.id)
          .not('tourist_name', 'is', null)
          .order('check_in', { ascending: false })
        if (newRows) {
          const normalized = (newRows as any[]).map((r: any) => ({
            ...r,
            apartments: Array.isArray(r.apartments) ? (r.apartments[0] || null) : r.apartments,
          }))
          setRows(normalized)
        }
      } else {
        setImportResult(data.error || 'Greška pri uvozu.')
      }
    } catch {
      setImportResult('Greška pri povezivanju.')
    }
    setImporting(false)
  }

  async function handleFindContacts() {
    if (!session?.access_token) return
    setConfirmFindContacts(false)
    setFindingContacts(true)
    setContactResult(null)
    try {
      const res = await fetch('/api/evisitor-find-contacts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (data.success) {
        setContactResult(data.message)
        // Reload guests
        const { data: newRows } = await supabase
          .from('reservations')
          .select('id, tourist_name, tourist_surname, gender, date_of_birth, document_type, document_number, citizenship, city_of_residence, residence_address, guest_email, guest_phone, check_in, check_out, apartment_id, completed_at, evisitor_checked_in_at, created_at, apartments(name)')
          .eq('user_id', user!.id)
          .not('tourist_name', 'is', null)
          .order('check_in', { ascending: false })
        if (newRows) {
          const normalized = (newRows as any[]).map((r: any) => ({
            ...r,
            apartments: Array.isArray(r.apartments) ? (r.apartments[0] || null) : r.apartments,
          }))
          setRows(normalized)
        }
      } else {
        setContactResult(data.error || 'Greška.')
      }
    } catch {
      setContactResult('Greška pri povezivanju.')
    }
    setFindingContacts(false)
  }

  const guestsWithoutEmail = guests.filter(g => !g.email).length

  return (
    <AppShell title="Gosti">
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Import & Find contacts */}
        {(profile?.evisitor_connected || profile?.gmail_connected) && (
          <div className="bg-white rounded-xl border border-border p-3 space-y-2">
            {/* eVisitor import */}
            {profile?.evisitor_connected && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-text-muted">
                    Uvezi povijest gostiju iz eVisitor sustava
                  </div>
                  <button
                    onClick={() => setConfirmImport(true)}
                    disabled={importing}
                    className="flex-shrink-0 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {importing ? 'Uvozim...' : 'Uvezi iz eVisitora'}
                  </button>
                </div>
                {importResult && (
                  <div className={`mt-2 p-2 rounded-lg text-xs ${importResult.includes('Greška') || importResult.includes('error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                    {importResult}
                  </div>
                )}
              </>
            )}

            {/* Gmail contact finder */}
            {profile?.gmail_connected && guestsWithoutEmail > 0 && (
              <>
                <div className="border-t border-border pt-2 flex items-center justify-between gap-3">
                  <div className="text-xs text-text-muted">
                    {guestsWithoutEmail} gostiju bez emaila — pretraži Gmail
                  </div>
                  <button
                    onClick={() => setConfirmFindContacts(true)}
                    disabled={findingContacts}
                    className="flex-shrink-0 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {findingContacts ? 'Tražim...' : 'Pronađi kontakte'}
                  </button>
                </div>
                {contactResult && (
                  <div className={`p-2 rounded-lg text-xs ${contactResult.includes('Greška') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                    {contactResult}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Header stats */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Unikatnih gostiju" value={guests.length} />
          <StatCard
            label="Ukupno boravaka"
            value={rows.length}
          />
          <StatCard
            label="Ukupno noći"
            value={guests.reduce((sum, g) => sum + g.totalNights, 0)}
          />
        </div>

        {/* Stays filter */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { label: 'Svi', value: 0 },
            { label: '2+ boravka', value: 2 },
            { label: '3+ boravka', value: 3 },
            { label: '5+ boravaka', value: 5 },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setMinStays(f.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                minStays === f.value
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-text-muted hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Traži po imenu, emailu, gradu..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-border rounded-lg text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>

        {/* List */}
        {loading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          search ? (
            <div className="text-center py-12 px-4">
              <svg viewBox="0 0 80 80" className="w-20 h-20 mx-auto mb-4 text-primary opacity-25" fill="currentColor">
                <circle cx="34" cy="34" r="22" fill="none" stroke="currentColor" strokeWidth="5"/>
                <line x1="50" y1="50" x2="68" y2="68" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/>
              </svg>
              <h3 className="text-base font-semibold text-text mb-1">Nema rezultata</h3>
              <p className="text-sm text-text-muted max-w-xs mx-auto">{`Nema gostiju koji odgovaraju pretrazi "${search}".`}</p>
            </div>
          ) : (
            <div className="text-center py-12 px-4">
              <svg viewBox="0 0 80 80" className="w-20 h-20 mx-auto mb-4 text-primary opacity-25" fill="currentColor">
                <rect x="20" y="30" width="40" height="34" rx="5"/>
                <rect x="30" y="22" width="20" height="10" rx="3" fill="none" stroke="currentColor" strokeWidth="3.5"/>
                <line x1="40" y1="30" x2="40" y2="64" stroke="white" strokeWidth="2.5"/>
                <line x1="20" y1="47" x2="60" y2="47" stroke="white" strokeWidth="2.5"/>
              </svg>
              <h3 className="text-base font-semibold text-text mb-1">Još nemate gostiju</h3>
              <p className="text-sm text-text-muted max-w-xs mx-auto">
                {profile?.evisitor_connected
                  ? 'Uvezite povijest iz eVisitora ili čekajte da gost popuni self check-in formu.'
                  : 'Čim prvi gost popuni self check-in formu ili uvezete povijest iz eVisitora, pojavit će se ovdje.'}
              </p>
            </div>
          )
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filtered.map((g) => (
              <GuestCard
                key={g.key}
                guest={g}
                onClick={() => setSelected(g)}
              />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <GuestDetailModal
          guest={selected}
          onClose={() => setSelected(null)}
        />
      )}

      <ConfirmModal
        open={confirmImport}
        title="Uvoz iz eVisitora"
        message="Uvesti sve goste iz eVisitor povijesti? Ovo može potrajati nekoliko minuta."
        confirmLabel="Uvezi"
        onConfirm={handleImport}
        onCancel={() => setConfirmImport(false)}
      />

      <ConfirmModal
        open={confirmFindContacts}
        title="Pretraga kontakata"
        message={`Pretražiti Gmail za email adrese ${guestsWithoutEmail} gostiju bez kontakta?`}
        confirmLabel="Pretraži"
        onConfirm={handleFindContacts}
        onCancel={() => setConfirmFindContacts(false)}
      />
    </AppShell>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-border p-3 text-center">
      <div className="text-2xl font-extrabold text-primary">{value}</div>
      <div className="text-[10px] text-text-muted mt-0.5 uppercase tracking-wide">
        {label}
      </div>
    </div>
  )
}

function GuestCard({
  guest,
  onClick,
}: {
  guest: GuestAggregate
  onClick: () => void
}) {
  const flag = guest.citizenship ? COUNTRY_FLAGS[guest.citizenship] || '🌍' : ''
  const initials = [guest.name[0], guest.surname[0]].filter(Boolean).join('').toUpperCase()
  const colorIdx = ((guest.name.charCodeAt(0) || 0) + (guest.surname.charCodeAt(0) || 0)) % AVATAR_COLORS.length
  const avatarColor = AVATAR_COLORS[colorIdx]
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-border p-4 hover:border-primary/50 hover:shadow-md transition-all flex flex-col items-center text-center gap-2"
    >
      <div className={`w-14 h-14 rounded-full ${avatarColor} flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}>
        {initials || '?'}
      </div>
      <div className="w-full min-w-0">
        <div className="font-semibold text-text text-sm truncate">
          {guest.name} {guest.surname}
        </div>
        <div className="text-xs text-text-muted truncate">
          {flag && <span className="mr-1">{flag}</span>}{guest.city || '—'}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-semibold rounded-full">
          {guest.totalStays}×
        </span>
        <span className="text-[10px] text-text-muted">{guest.totalNights} noći</span>
      </div>
    </button>
  )
}

function GuestDetailModal({
  guest,
  onClose,
}: {
  guest: GuestAggregate
  onClose: () => void
}) {
  const flag = guest.citizenship ? COUNTRY_FLAGS[guest.citizenship] || '🌍' : ''

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl w-[92%] max-w-lg max-h-[85vh] overflow-y-auto z-50">
        {/* Header */}
        <div className="bg-primary text-white p-5 rounded-t-2xl">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl font-bold">
                {flag} {guest.name} {guest.surname}
              </div>
              <div className="text-primary-light text-sm mt-1">
                {guest.totalStays} {guest.totalStays === 1 ? 'boravak' : 'boravaka'}
                {' · '}
                {guest.totalNights} {guest.totalNights === 1 ? 'noć' : 'noći'}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white text-2xl leading-none"
              aria-label="Zatvori"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <InfoGrid>
            <InfoItem label="Grad">{guest.city || '-'}</InfoItem>
            <InfoItem label="Email">
              {guest.email ? (
                <a
                  href={`mailto:${guest.email}`}
                  className="text-primary hover:underline break-all"
                >
                  {guest.email}
                </a>
              ) : (
                '-'
              )}
            </InfoItem>
            <InfoItem label="Telefon">
              {guest.phone ? (
                <a
                  href={`tel:${guest.phone}`}
                  className="text-primary hover:underline"
                >
                  {guest.phone}
                </a>
              ) : (
                '-'
              )}
            </InfoItem>
            <InfoItem label="Datum rođenja">
              {formatDate(guest.dateOfBirth)}
            </InfoItem>
            <InfoItem label="Broj dokumenta">
              {guest.documentNumber || '-'}
            </InfoItem>
            <InfoItem label="Državljanstvo">
              {guest.citizenship || '-'}
            </InfoItem>
          </InfoGrid>

          <div>
            <h4 className="font-semibold text-text text-sm mb-2">
              Povijest boravaka
            </h4>
            <div className="space-y-2">
              {guest.stays.map((stay) => (
                <div
                  key={stay.id}
                  className="bg-gray-50 rounded-lg p-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-text">
                      {stay.apartments?.name || '(bez apartmana)'}
                    </div>
                    <div className="text-xs text-text-muted">
                      {nights(stay.check_in, stay.check_out)} noći
                    </div>
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">
                    📅 {formatDate(stay.check_in)} → {formatDate(stay.check_out)}
                  </div>
                  {stay.evisitor_checked_in_at && (
                    <div className="text-xs text-green-600 mt-1">
                      ✓ eVisitor prijavljen
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>
}

function InfoItem({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="text-[10px] text-text-muted uppercase tracking-wide">
        {label}
      </div>
      <div className="text-sm text-text mt-0.5">{children}</div>
    </div>
  )
}
