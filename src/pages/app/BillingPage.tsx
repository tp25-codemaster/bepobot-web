import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const PLANS = [
  {
    key: 'starter' as const,
    name: 'Starter',
    price: 89,
    apartments: '1 apartman',
    description: 'Savršeno za pojedinačne iznajmljivače',
  },
  {
    key: 'pro' as const,
    name: 'Pro',
    price: 149,
    apartments: 'Do 5 apartmana',
    description: 'Za profesionalne iznajmljivače',
    popular: true,
  },
  {
    key: 'business' as const,
    name: 'Business',
    price: 299,
    apartments: 'Neograničeno apartmana',
    description: 'Za agencije i veće portfelje',
  },
]

type PlanKey = 'starter' | 'pro' | 'business'

export default function BillingPage() {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  const [loadingCheckout, setLoadingCheckout] = useState<PlanKey | null>(null)
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [error, setError] = useState('')

  const currentPlan = profile?.plan ?? 'trial'
  const hasActiveSub = currentPlan !== 'trial'
  const justSucceeded = searchParams.get('success') === '1'

  const handleCheckout = async (planKey: PlanKey) => {
    setLoadingCheckout(planKey)
    setError('')
    try {
      const res = await fetch('/api/stripe-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (res.ok && data.url) {
        window.location.href = data.url
      } else {
        setError(data.error ?? 'Greška pri usmjeravanju na naplatu.')
      }
    } catch {
      setError('Neočekivana greška. Pokušaj ponovo.')
    } finally {
      setLoadingCheckout(null)
    }
  }

  const handlePortal = async () => {
    setLoadingPortal(true)
    setError('')
    try {
      const res = await fetch('/api/stripe-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json() as { url?: string; error?: string }
      if (res.ok && data.url) {
        window.location.href = data.url
      } else {
        setError(data.error ?? 'Greška pri otvaranju portala.')
      }
    } catch {
      setError('Neočekivana greška. Pokušaj ponovo.')
    } finally {
      setLoadingPortal(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pretplata</h1>
        <p className="text-gray-500 mt-1 text-sm">Upravljaj svojim planom i naplatom.</p>
      </div>

      {justSucceeded && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm font-medium">
          ✓ Pretplata je uspješno aktivirana!
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Current plan summary */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Trenutni plan</p>
            <p className="text-xl font-bold text-gray-900 capitalize mt-0.5">
              {currentPlan === 'trial' ? 'Probni (besplatno)' : PLANS.find(p => p.key === currentPlan)?.name ?? currentPlan}
            </p>
          </div>
          {hasActiveSub && (
            <button
              onClick={handlePortal}
              disabled={loadingPortal}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {loadingPortal ? 'Učitavam...' : 'Upravljaj pretplatom →'}
            </button>
          )}
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map(plan => {
          const isActive = currentPlan === plan.key
          return (
            <div
              key={plan.key}
              className={`relative bg-white rounded-2xl p-6 border-2 transition-all
                ${isActive ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}
            >
              {plan.popular && !isActive && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Najpopularniji
                  </span>
                </div>
              )}
              {isActive && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Aktivan
                  </span>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{plan.description}</p>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-extrabold text-gray-900">€{plan.price}</span>
                <span className="text-gray-500 text-sm">/mj</span>
              </div>

              <ul className="space-y-2 text-sm text-gray-600 mb-6">
                <li className="flex items-center gap-2">
                  <span className="text-blue-500">✓</span> {plan.apartments}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-500">✓</span> Automatski eVisitor
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-500">✓</span> Gmail integracija
                </li>
              </ul>

              {isActive ? (
                <button
                  onClick={handlePortal}
                  disabled={loadingPortal}
                  className="w-full py-2.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 disabled:opacity-50 transition-colors"
                >
                  {loadingPortal ? 'Učitavam...' : 'Upravljaj →'}
                </button>
              ) : (
                <button
                  onClick={() => handleCheckout(plan.key)}
                  disabled={loadingCheckout === plan.key}
                  className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors"
                >
                  {loadingCheckout === plan.key ? 'Učitavam...' : 'Odaberi plan'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 text-center">
        14 dana besplatno · Otkazivanje bez penala · PDV uključen
      </p>
    </div>
  )
}
