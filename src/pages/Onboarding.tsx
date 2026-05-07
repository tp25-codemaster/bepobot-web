import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const STEPS = ['Dobrodošli', 'Gmail', 'Apartman', 'Gotovo']

function ProgressBar({ currentStep }: { currentStep: number }) {
  const pct = ((currentStep - 1) / (STEPS.length - 1)) * 100
  return (
    <div className="relative flex items-start justify-between w-full mb-10 px-5">
      <div className="absolute top-5 left-10 right-10 h-0.5 bg-gray-200" />
      <div
        className="absolute top-5 left-10 h-0.5 bg-blue-600 transition-all duration-500"
        style={{ width: `calc(${pct}% * (100% - 5rem) / 100)` }}
      />
      {STEPS.map((label, i) => {
        const n = i + 1
        const done = n < currentStep
        const active = n === currentStep
        return (
          <div key={i} className="relative flex flex-col items-center z-10">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center border-2 font-semibold text-sm transition-all duration-300
                ${done ? 'bg-blue-600 border-blue-600 text-white'
                  : active ? 'bg-white border-blue-600 text-blue-600'
                  : 'bg-white border-gray-200 text-gray-400'}`}
            >
              {done ? '✓' : n}
            </div>
            <span className={`mt-2 text-xs whitespace-nowrap font-medium transition-colors
              ${active ? 'text-blue-600' : done ? 'text-gray-500' : 'text-gray-300'}`}>
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function Onboarding() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(() => {
    const saved = localStorage.getItem('bepobot_onboarding_step')
    return saved ? parseInt(saved, 10) : 1
  })
  const [apartmentName, setApartmentName] = useState('')
  const [evisitorCode, setEvisitorCode] = useState('')
  const [apartmentError, setApartmentError] = useState('')
  const [apartmentLoading, setApartmentLoading] = useState(false)

  const goToStep = (n: number) => {
    setStep(n)
    localStorage.setItem('bepobot_onboarding_step', String(n))
  }

  // Auto-advance step 2 → 3 when user returns from Gmail OAuth
  useEffect(() => {
    if (step === 2 && profile?.gmail_connected) {
      goToStep(3)
    }
  }, [profile?.gmail_connected, step])

  const handleAddApartment = async (e: React.FormEvent) => {
    e.preventDefault()
    setApartmentError('')
    setApartmentLoading(true)
    try {
      const res = await fetch('/api/apartments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: apartmentName, evisitor_facility_code: evisitorCode }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? 'Greška pri dodavanju apartmana')
      }
      goToStep(4)
    } catch (err) {
      setApartmentError(err instanceof Error ? err.message : 'Greška pri dodavanju apartmana')
    } finally {
      setApartmentLoading(false)
    }
  }

  const handleFinish = () => {
    localStorage.removeItem('bepobot_onboarding_step')
    navigate('/app')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-lg bg-white shadow-lg rounded-2xl p-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">B</span>
          </div>
          <span className="font-bold text-gray-800 text-lg">BepoBot</span>
        </div>

        <ProgressBar currentStep={step} />

        {/* Korak 1 — Dobrodošli */}
        {step === 1 && (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-3">Dobrodošli u BepoBot!</h2>
            <p className="text-gray-500 mb-8 leading-relaxed">
              Postavi račun za 3 minute. Vodimo te kroz: povezivanje Gmaila, dodavanje prvog apartmana i unos eVisitor koda.
            </p>
            <button
              onClick={() => goToStep(2)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Počnimo →
            </button>
          </div>
        )}

        {/* Korak 2 — Poveži Gmail */}
        {step === 2 && (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-3">Poveži Gmail</h2>
            <p className="text-gray-500 mb-2 leading-relaxed">
              BepoBot čita booking e-mailove iz tvog Gmaila i automatski kreira rezervacije — bez ručnog unosa.
            </p>
            <p className="text-xs text-gray-400 mb-8">Pristupamo samo booking e-mailovima, ničem drugom.</p>

            {profile?.gmail_connected ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-green-600 bg-green-50 rounded-xl py-3 font-medium">
                  <span>✓</span>
                  <span>Gmail je povezan{profile.gmail_email ? ` (${profile.gmail_email})` : ''}</span>
                </div>
                <button
                  onClick={() => goToStep(3)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
                >
                  Nastavi →
                </button>
              </div>
            ) : (
              <a
                href="/api/auth/gmail"
                className="flex items-center justify-center gap-3 w-full bg-white border-2 border-gray-200 hover:border-blue-400 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
                Poveži Gmail račun
              </a>
            )}

            <button onClick={() => goToStep(1)} className="mt-5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
              ← Natrag
            </button>
          </div>
        )}

        {/* Korak 3 — Dodaj apartman */}
        {step === 3 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Dodaj apartman</h2>
            <p className="text-gray-500 mb-6 text-center text-sm">Možeš dodati još apartmana poslije u postavkama.</p>

            <form onSubmit={handleAddApartment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Naziv apartmana</label>
                <input
                  type="text"
                  value={apartmentName}
                  onChange={e => setApartmentName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="npr. Apartman Bura, Studio More"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">eVisitor kod objekta</label>
                <input
                  type="text"
                  value={evisitorCode}
                  onChange={e => setEvisitorCode(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="npr. HR-51000-12345"
                  required
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  Nalaziš ga u eVisitor portalu → Moji objekti → Kod objekta
                </p>
              </div>

              {apartmentError && (
                <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">
                  {apartmentError}
                </div>
              )}

              <button
                type="submit"
                disabled={apartmentLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                {apartmentLoading ? 'Dodajem...' : 'Dodaj apartman →'}
              </button>
            </form>

            <button onClick={() => goToStep(2)} className="mt-4 w-full text-sm text-gray-400 hover:text-gray-600 transition-colors">
              ← Natrag
            </button>
          </div>
        )}

        {/* Korak 4 — Gotovo */}
        {step === 4 && (
          <div className="text-center">
            <div className="text-5xl mb-5">🎉</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">Sve je postavljeno!</h2>
            <p className="text-gray-500 mb-8 leading-relaxed">
              BepoBot je spreman. Čim stigne booking e-mail, rezervacija će se pojaviti automatski u dashboardu.
            </p>
            <button
              onClick={handleFinish}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Idi na dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
