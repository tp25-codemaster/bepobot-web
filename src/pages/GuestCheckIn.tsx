import { useEffect, useState, useCallback } from 'react'
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

// Step definitions for progress indicator
const STEPS = [
  { id: 1, label: 'Osobni podaci' },
  { id: 2, label: 'Dokument' },
  { id: 3, label: 'Prebivalište' },
  { id: 4, label: 'Kontakt' },
]

interface FieldErrors {
  tourist_name?: string
  tourist_surname?: string
  date_of_birth?: string
  document_number?: string
  city_of_residence?: string
}

export default function GuestCheckIn() {
  const { token } = useParams<{ token: string }>()
  const [reservation, setReservation] = useState<PublicReservation | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(INITIAL)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  // Track which step user has reached (1-4) for progress indicator
  const [activeStep, setActiveStep] = useState(1)

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
    // Clear field error on change
    if (key in fieldErrors) {
      setFieldErrors(prev => ({ ...prev, [key]: undefined }))
    }
    // Update active step based on filled fields
    if (key === 'tourist_name' || key === 'tourist_surname' || key === 'date_of_birth') {
      setActiveStep(prev => Math.max(prev, 1))
    } else if (key === 'document_number') {
      setActiveStep(prev => Math.max(prev, 2))
    } else if (key === 'city_of_residence' || key === 'citizenship') {
      setActiveStep(prev => Math.max(prev, 3))
    } else if (key === 'guest_email' || key === 'guest_phone') {
      setActiveStep(prev => Math.max(prev, 4))
    }
  }

  const validateForm = useCallback((): FieldErrors => {
    const errors: FieldErrors = {}
    if (!form.tourist_name.trim()) errors.tourist_name = 'Ime je obavezno'
    if (!form.tourist_surname.trim()) errors.tourist_surname = 'Prezime je obavezno'
    if (!form.date_of_birth) errors.date_of_birth = 'Datum rođenja je obavezan'
    if (!form.document_number.trim()) errors.document_number = 'Broj dokumenta je obavezan'
    if (!form.city_of_residence.trim()) errors.city_of_residence = 'Grad je obavezan'
    return errors
  }, [form])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return

    const errors = validateForm()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      // Scroll to first error
      const firstErrorKey = Object.keys(errors)[0]
      const el = document.querySelector(`[data-field="${firstErrorKey}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

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
        <div className="flex flex-col items-center py-16 gap-3">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <div className="text-sm text-text-muted">Učitavanje rezervacije...</div>
        </div>
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
      {/* Progress indicator */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((step, idx) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step.id <= activeStep
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 text-gray-400'
                }`}>
                  {step.id}
                </div>
                <div className={`text-[9px] mt-0.5 font-medium text-center leading-tight ${
                  step.id <= activeStep ? 'text-primary' : 'text-gray-400'
                }`}>
                  {step.label}
                </div>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 mb-4 transition-colors ${
                  step.id < activeStep ? 'bg-primary' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

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

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Osobni podaci */}
        <Section title="👤 Osobni podaci">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ime *" error={fieldErrors.tourist_name} fieldKey="tourist_name">
              <input
                type="text"
                aria-required="true"
                value={form.tourist_name}
                onChange={(e) => update('tourist_name', e.target.value)}
                className={fieldErrors.tourist_name ? inputErrorCls : inputCls}
                autoComplete="given-name"
              />
            </Field>
            <Field label="Prezime *" error={fieldErrors.tourist_surname} fieldKey="tourist_surname">
              <input
                type="text"
                aria-required="true"
                value={form.tourist_surname}
                onChange={(e) => update('tourist_surname', e.target.value)}
                className={fieldErrors.tourist_surname ? inputErrorCls : inputCls}
                autoComplete="family-name"
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
            <Field label="Datum rođenja *" error={fieldErrors.date_of_birth} fieldKey="date_of_birth">
              <input
                type="date"
                aria-required="true"
                value={form.date_of_birth}
                onChange={(e) => update('date_of_birth', e.target.value)}
                className={fieldErrors.date_of_birth ? inputErrorCls : inputCls}
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
            <Field label="Broj dokumenta *" error={fieldErrors.document_number} fieldKey="document_number">
              <input
                type="text"
                aria-required="true"
                value={form.document_number}
                onChange={(e) => update('document_number', e.target.value)}
                className={fieldErrors.document_number ? inputErrorCls : inputCls}
                autoComplete="off"
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
            <Field label="Grad *" error={fieldErrors.city_of_residence} fieldKey="city_of_residence">
              <input
                type="text"
                aria-required="true"
                value={form.city_of_residence}
                onChange={(e) => update('city_of_residence', e.target.value)}
                className={fieldErrors.city_of_residence ? inputErrorCls : inputCls}
                autoComplete="address-level2"
              />
            </Field>
            <Field label="Adresa">
              <input
                type="text"
                value={form.residence_address}
                onChange={(e) => update('residence_address', e.target.value)}
                className={inputCls}
                placeholder="opcionalno"
                autoComplete="street-address"
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
              autoComplete="email"
            />
          </Field>
          <Field label="Telefon">
            <input
              type="tel"
              value={form.guest_phone}
              onChange={(e) => update('guest_phone', e.target.value)}
              className={inputCls}
              placeholder="+385 91 123 4567"
              autoComplete="tel"
            />
          </Field>
        </Section>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Šaljem...</span>
            </>
          ) : (
            '✓ Pošalji domaćinu'
          )}
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
  error,
  fieldKey,
}: {
  label: string
  children: React.ReactNode
  error?: string
  fieldKey?: string
}) {
  return (
    <label className="block" data-field={fieldKey}>
      <div className={`text-xs font-medium mb-1 ${error ? 'text-red-600' : 'text-text-muted'}`}>{label}</div>
      {children}
      {error && (
        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          {error}
        </p>
      )}
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
  'w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors'

const inputErrorCls =
  'w-full px-3 py-2 text-sm border border-red-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-500 bg-red-50/30 transition-colors'
