import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  fetchPublicReservation,
  submitGuestData,
  type PublicReservation,
} from '../lib/reservations'

const DOCUMENT_TYPES = [
  { value: '008', label: 'Osobna iskaznica' },
  { value: '027', label: 'Putovnica' },
  { value: '009', label: 'Vozačka dozvola' },
  { value: '028', label: 'Drugi dokument' },
]

const COUNTRIES = [
  { value: 'HRV', label: '🇭🇷 Hrvatska' },
  { value: 'ITA', label: '🇮🇹 Italija' },
  { value: 'DEU', label: '🇩🇪 Njemačka' },
  { value: 'AUT', label: '🇦🇹 Austrija' },
  { value: 'SVN', label: '🇸🇮 Slovenija' },
  { value: 'HUN', label: '🇭🇺 Mađarska' },
  { value: 'CZE', label: '🇨🇿 Češka' },
  { value: 'POL', label: '🇵🇱 Poljska' },
  { value: 'FRA', label: '🇫🇷 Francuska' },
  { value: 'GBR', label: '🇬🇧 UK' },
  { value: 'USA', label: '🇺🇸 SAD' },
]

interface FormState {
  tourist_name: string
  tourist_surname: string
  gender: 'muški' | 'ženski'
  date_of_birth: string
  document_type: string
  document_number: string
  citizenship: string
  city_of_residence: string
  residence_address: string
  guest_email: string
  guest_phone: string
}

const INITIAL: FormState = {
  tourist_name: '',
  tourist_surname: '',
  gender: 'muški',
  date_of_birth: '',
  document_type: '008',
  document_number: '',
  citizenship: 'HRV',
  city_of_residence: '',
  residence_address: '',
  guest_email: '',
  guest_phone: '',
}

export default function GuestCheckIn() {
  const { token } = useParams<{ token: string }>()
  const [reservation, setReservation] = useState<PublicReservation | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) {
      setFetchError('Token nije naveden')
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      const res = await fetchPublicReservation(token)
      if (cancelled) return
      if (res.success && res.reservation) {
        setReservation(res.reservation)
        // If already completed, go straight to done screen
        if (
          res.reservation.status === 'completed' ||
          res.reservation.status === 'checked_in'
        ) {
          setDone(true)
        }
      } else {
        setFetchError(res.error || 'Ne mogu dohvatiti rezervaciju')
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setSubmitting(true)
    setSubmitError(null)
    const res = await submitGuestData({
      token,
      tourist_name: form.tourist_name.trim(),
      tourist_surname: form.tourist_surname.trim(),
      gender: form.gender,
      date_of_birth: form.date_of_birth,
      document_type: form.document_type,
      document_number: form.document_number.trim(),
      citizenship: form.citizenship,
      city_of_residence: form.city_of_residence.trim(),
      residence_address: form.residence_address.trim() || undefined,
      guest_email: form.guest_email.trim() || undefined,
      guest_phone: form.guest_phone.trim() || undefined,
    })
    setSubmitting(false)
    if (res.success) {
      setDone(true)
    } else {
      setSubmitError(res.error || 'Greška')
    }
  }

  if (loading) {
    return (
      <GuestShell>
        <div className="text-center text-text-muted py-12">Učitavanje...</div>
      </GuestShell>
    )
  }

  if (fetchError) {
    return (
      <GuestShell>
        <div className="bg-white rounded-xl border border-red-200 p-6 text-center">
          <div className="text-4xl mb-3">❌</div>
          <h2 className="font-bold text-text mb-2">Link nije ispravan</h2>
          <p className="text-sm text-text-muted">{fetchError}</p>
          <p className="text-xs text-text-muted mt-4">
            Provjerite da ste cijeli link otvorili ili kontaktirajte domaćina.
          </p>
        </div>
      </GuestShell>
    )
  }

  if (!reservation) return null

  if (done) {
    return (
      <GuestShell>
        <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6 text-center">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="font-bold text-green-800 text-lg mb-2">
            Hvala vam!
          </h2>
          <p className="text-sm text-green-700">
            Vaši podaci su poslani domaćinu. Dobrodošli u{' '}
            <strong>{reservation.apartment_name || 'apartman'}</strong>.
          </p>
        </div>

        {/* Info card with apartment details */}
        {(reservation.wifi || reservation.parking || reservation.rules ||
          reservation.checkin_instructions) && (
          <div className="mt-4 bg-white rounded-xl border border-border p-5 space-y-3">
            <h3 className="font-semibold text-text">Korisne informacije</h3>
            {reservation.wifi && reservation.wifi.ssid && (
              <InfoRow icon="📶" label="WiFi">
                <div className="font-mono text-xs">
                  {reservation.wifi.ssid}
                  {reservation.wifi.password ? (
                    <> / {reservation.wifi.password}</>
                  ) : null}
                </div>
              </InfoRow>
            )}
            {reservation.parking && (
              <InfoRow icon="🅿️" label="Parking">
                {reservation.parking}
              </InfoRow>
            )}
            {reservation.rules && (
              <InfoRow icon="📋" label="Pravila kuće">
                {reservation.rules}
              </InfoRow>
            )}
            {reservation.checkin_instructions && (
              <InfoRow icon="🔑" label="Check-in upute">
                {reservation.checkin_instructions}
              </InfoRow>
            )}
          </div>
        )}
      </GuestShell>
    )
  }

  return (
    <GuestShell>
      {/* Welcome card */}
      <div className="bg-primary text-white rounded-xl p-5 mb-4">
        <div className="text-primary-light text-xs">
          Rezervacija za {reservation.host_label}
        </div>
        <h1 className="font-bold text-lg mt-1">
          Dobrodošli u {reservation.apartment_name || 'naš apartman'}!
        </h1>
        {reservation.stay_from && reservation.stay_until && (
          <div className="text-sm text-white/90 mt-2">
            📅 {reservation.stay_from} → {reservation.stay_until}
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
        <div className="text-sm text-amber-900">
          <div className="font-semibold mb-1">Prije dolaska</div>
          <div className="text-xs">
            Za prijavu u eVisitor sustav (zakonska obaveza u Hrvatskoj) molimo
            popunite svoje podatke. Vaš domaćin će ih koristiti isključivo za
            službenu prijavu boravka.
          </div>
        </div>
      </div>

      {submitError && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-red-50 border border-red-300 text-red-800 rounded-xl p-3 mb-4 text-sm"
        >
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Osobni podaci */}
        <Section title="👤 Osobni podaci">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ime *">
              <input
                type="text"
                required
                aria-required="true"
                value={form.tourist_name}
                onChange={(e) => update('tourist_name', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Prezime *">
              <input
                type="text"
                required
                aria-required="true"
                value={form.tourist_surname}
                onChange={(e) => update('tourist_surname', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Spol *">
              <select
                value={form.gender}
                aria-required="true"
                onChange={(e) =>
                  update('gender', e.target.value as 'muški' | 'ženski')
                }
                className={inputCls}
              >
                <option value="muški">muški</option>
                <option value="ženski">ženski</option>
              </select>
            </Field>
            <Field label="Datum rođenja *">
              <input
                type="date"
                required
                aria-required="true"
                value={form.date_of_birth}
                onChange={(e) => update('date_of_birth', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        </Section>

        {/* Dokument */}
        <Section title="📄 Dokument">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tip dokumenta *">
              <select
                value={form.document_type}
                aria-required="true"
                onChange={(e) => update('document_type', e.target.value)}
                className={inputCls}
              >
                {DOCUMENT_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Broj dokumenta *">
              <input
                type="text"
                required
                aria-required="true"
                value={form.document_number}
                onChange={(e) => update('document_number', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        </Section>

        {/* Prebivalište */}
        <Section title="🌍 Prebivalište">
          <Field label="Državljanstvo *">
            <select
              value={form.citizenship}
              aria-required="true"
              onChange={(e) => update('citizenship', e.target.value)}
              className={inputCls}
            >
              {COUNTRIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Grad *">
              <input
                type="text"
                required
                aria-required="true"
                value={form.city_of_residence}
                onChange={(e) => update('city_of_residence', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Adresa">
              <input
                type="text"
                value={form.residence_address}
                onChange={(e) => update('residence_address', e.target.value)}
                className={inputCls}
                placeholder="opcionalno"
              />
            </Field>
          </div>
        </Section>

        {/* Kontakt */}
        <Section title="📞 Kontakt (opcionalno)">
          <Field label="Email">
            <input
              type="email"
              value={form.guest_email}
              onChange={(e) => update('guest_email', e.target.value)}
              className={inputCls}
              placeholder="vas@email.com"
            />
          </Field>
          <Field label="Telefon">
            <input
              type="tel"
              value={form.guest_phone}
              onChange={(e) => update('guest_phone', e.target.value)}
              className={inputCls}
              placeholder="+385 91 123 4567"
            />
          </Field>
        </Section>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 active:scale-98 disabled:opacity-50 transition-all"
        >
          {submitting ? '⏳ Šaljem...' : '✓ Pošalji domaćinu'}
        </button>

        <p className="text-xs text-text-muted text-center">
          Vaši podaci se šalju samo vašem domaćinu i koriste isključivo za
          eVisitor prijavu.
        </p>
      </form>
    </GuestShell>
  )
}

function GuestShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <div className="text-sm">
            <span className="font-bold text-primary">Bepo</span>
            <span className="font-bold text-dark">Bot</span>
          </div>
          <div className="text-xs text-text-muted">self check-in</div>
        </div>
        {children}
      </div>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl p-4 border border-border space-y-3">
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      {children}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-text-muted mb-1">{label}</div>
      {children}
    </label>
  )
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-base mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-text-muted">{label}</div>
        <div className="text-sm text-text">{children}</div>
      </div>
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'
