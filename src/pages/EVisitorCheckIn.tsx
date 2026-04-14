import { useState } from 'react'
import { checkInGuest, type GuestCheckInData, type CheckInResponse } from '../lib/evisitor'

// Pomoćne funkcije za formatiranje datuma
function dateToEvisitor(isoDate: string): string {
  // "2026-06-20" → "20260620"
  return isoDate.replaceAll('-', '')
}

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
  Facility: string
  TouristName: string
  TouristSurname: string
  Gender: 'muški' | 'ženski'
  DateOfBirth: string // ISO (yyyy-mm-dd)
  DocumentType: string
  DocumentNumber: string
  Citizenship: string
  CityOfResidence: string
  ResidenceAddress: string
  StayFrom: string // ISO
  TimeStayFrom: string // HH:mm
  ForeseenStayUntil: string // ISO
  TimeEstimatedStayUntil: string // HH:mm
  testMode: boolean
}

const INITIAL: FormState = {
  Facility: '0000022',
  TouristName: '',
  TouristSurname: '',
  Gender: 'muški',
  DateOfBirth: '',
  DocumentType: '008',
  DocumentNumber: '',
  Citizenship: 'HRV',
  CityOfResidence: '',
  ResidenceAddress: '',
  StayFrom: '',
  TimeStayFrom: '14:00',
  ForeseenStayUntil: '',
  TimeEstimatedStayUntil: '10:00',
  testMode: true,
}

const TEST_DATA: Partial<FormState> = {
  TouristName: 'Marko',
  TouristSurname: 'Marković',
  Gender: 'muški',
  DateOfBirth: '1990-05-15',
  DocumentType: '008',
  DocumentNumber: 'HR12345678',
  Citizenship: 'HRV',
  CityOfResidence: 'Zagreb',
  ResidenceAddress: 'Ilica 1',
  StayFrom: '2026-06-20',
  ForeseenStayUntil: '2026-06-25',
}

export default function EVisitorCheckIn() {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CheckInResponse | null>(null)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function fillTestData() {
    setForm((prev) => ({ ...prev, ...TEST_DATA }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    const payload: GuestCheckInData = {
      Facility: form.Facility,
      TouristName: form.TouristName,
      TouristSurname: form.TouristSurname,
      Gender: form.Gender,
      DateOfBirth: dateToEvisitor(form.DateOfBirth),
      DocumentType: form.DocumentType,
      DocumentNumber: form.DocumentNumber,
      Citizenship: form.Citizenship,
      CountryOfBirth: form.Citizenship,
      CountryOfResidence: form.Citizenship,
      CityOfResidence: form.CityOfResidence,
      ResidenceAddress: form.ResidenceAddress || '-',
      StayFrom: dateToEvisitor(form.StayFrom),
      TimeStayFrom: form.TimeStayFrom,
      ForeseenStayUntil: dateToEvisitor(form.ForeseenStayUntil),
      TimeEstimatedStayUntil: form.TimeEstimatedStayUntil,
      ArrivalOrganisation: 'I',
      OfferedServiceType: 'noćenje',
      TTPaymentCategory: '11',
      _testMode: form.testMode,
    }

    const res = await checkInGuest(payload)
    setResult(res)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-2xl">
              🏛️
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">eVisitor prijava gosta</h1>
              <p className="text-primary-light text-xs">BepoBot → n8n → eVisitor API</p>
            </div>
          </div>
          <a href="/app" className="text-white/80 text-sm hover:text-white">
            ← Natrag
          </a>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Test mode banner */}
        <div
          className={`rounded-xl p-4 border-2 ${
            form.testMode
              ? 'bg-yellow-50 border-yellow-300'
              : 'bg-red-50 border-red-300'
          }`}
        >
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.testMode}
              onChange={(e) => update('testMode', e.target.checked)}
              className="mt-1 w-5 h-5"
            />
            <div className="flex-1">
              <div className="font-semibold text-sm">
                {form.testMode ? '🧪 TEST MODE' : '⚠️  PRODUKCIJA'}
              </div>
              <div className="text-xs text-text-muted mt-1">
                {form.testMode
                  ? 'Šalje se samo Login prema eVisitoru, CheckIn se preskače. Nema pravog upisa turista.'
                  : 'STVARNO će prijaviti turista u eVisitor sustav. Ova prijava ide direktno u HR tourism registar i nema storniranja bez administracije.'}
              </div>
            </div>
          </label>
        </div>

        {/* Quick fill */}
        <button
          type="button"
          onClick={fillTestData}
          className="w-full py-2 bg-primary/10 text-primary text-sm font-medium rounded-lg hover:bg-primary/20 transition-colors"
        >
          ✨ Popuni test podatke
        </button>

        {/* Apartman */}
        <Section title="🏠 Apartman">
          <Field label="Facility (OIB objekta)">
            <input
              type="text"
              required
              value={form.Facility}
              onChange={(e) => update('Facility', e.target.value)}
              className={inputCls}
              placeholder="0000022"
            />
          </Field>
        </Section>

        {/* Osobni podaci */}
        <Section title="👤 Osobni podaci gosta">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ime *">
              <input
                type="text"
                required
                value={form.TouristName}
                onChange={(e) => update('TouristName', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Prezime *">
              <input
                type="text"
                required
                value={form.TouristSurname}
                onChange={(e) => update('TouristSurname', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Spol *">
              <select
                value={form.Gender}
                onChange={(e) => update('Gender', e.target.value as 'muški' | 'ženski')}
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
                value={form.DateOfBirth}
                onChange={(e) => update('DateOfBirth', e.target.value)}
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
                value={form.DocumentType}
                onChange={(e) => update('DocumentType', e.target.value)}
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
                value={form.DocumentNumber}
                onChange={(e) => update('DocumentNumber', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        </Section>

        {/* Adresa */}
        <Section title="🌍 Prebivalište">
          <Field label="Državljanstvo *">
            <select
              value={form.Citizenship}
              onChange={(e) => update('Citizenship', e.target.value)}
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
                value={form.CityOfResidence}
                onChange={(e) => update('CityOfResidence', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Adresa">
              <input
                type="text"
                value={form.ResidenceAddress}
                onChange={(e) => update('ResidenceAddress', e.target.value)}
                className={inputCls}
                placeholder="-"
              />
            </Field>
          </div>
        </Section>

        {/* Boravak */}
        <Section title="📅 Boravak">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dolazak *">
              <input
                type="date"
                required
                value={form.StayFrom}
                onChange={(e) => update('StayFrom', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Vrijeme">
              <input
                type="time"
                value={form.TimeStayFrom}
                onChange={(e) => update('TimeStayFrom', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Odlazak *">
              <input
                type="date"
                required
                value={form.ForeseenStayUntil}
                onChange={(e) => update('ForeseenStayUntil', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Vrijeme">
              <input
                type="time"
                value={form.TimeEstimatedStayUntil}
                onChange={(e) => update('TimeEstimatedStayUntil', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        </Section>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 active:scale-98 disabled:opacity-50 transition-all"
        >
          {loading ? '⏳ Šaljem na eVisitor...' : '🏛️ Prijavi gosta na eVisitor'}
        </button>

        {/* Result */}
        {result && <ResultCard result={result} />}
      </form>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-border space-y-3">
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-text-muted mb-1">{label}</div>
      {children}
    </label>
  )
}

const inputCls =
  'w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'

function ResultCard({ result }: { result: CheckInResponse }) {
  if (result.success) {
    return (
      <div className="bg-green-50 border-2 border-green-300 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="text-3xl">✅</div>
          <div className="flex-1">
            <div className="font-bold text-green-800">
              {result.testMode ? 'TEST uspješan!' : 'eVisitor prijava uspješna!'}
            </div>
            <div className="text-sm text-green-700 mt-1">{result.message}</div>
            <div className="mt-3 space-y-1 text-xs text-green-900">
              {result.touristId && (
                <div>
                  <span className="font-semibold">ID:</span> {result.touristId}
                </div>
              )}
              {result.touristName && (
                <div>
                  <span className="font-semibold">Gost:</span> {result.touristName}
                </div>
              )}
              {result.facility && (
                <div>
                  <span className="font-semibold">Facility:</span> {result.facility}
                </div>
              )}
              {result.checkinStatus !== undefined && (
                <div>
                  <span className="font-semibold">CheckIn status:</span>{' '}
                  {result.checkinStatus}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-danger-light border-2 border-danger-border rounded-xl p-5">
      <div className="flex items-start gap-3">
        <div className="text-3xl">❌</div>
        <div className="flex-1">
          <div className="font-bold text-red-800">Greška</div>
          <div className="text-sm text-red-700 mt-1 break-all">
            {result.error || result.message || 'Nepoznata greška'}
          </div>
          <div className="text-xs text-red-600 mt-2">
            Provjeri da je n8n workflow aktivan i da su podaci ispravni.
          </div>
        </div>
      </div>
    </div>
  )
}
