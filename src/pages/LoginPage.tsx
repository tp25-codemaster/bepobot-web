import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)

  const { signIn, signUp, isDemo } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (isDemo) {
      navigate('/app')
      return
    }

    if (isRegister) {
      const { error } = await signUp(email, password, fullName || undefined)
      if (error) setError(error)
      else navigate('/app')
    } else {
      const { error } = await signIn(email, password)
      if (error) setError(error)
      else navigate('/app')
    }

    setLoading(false)
  }

  if (confirmSent) {
    return (
      <div className="min-h-svh bg-light flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">📧</div>
          <h2 className="text-xl font-bold text-text mb-2">Provjerite email</h2>
          <p className="text-text-muted mb-6">
            Poslali smo vam link za potvrdu na <strong>{email}</strong>.
            Kliknite na link i vratite se ovdje.
          </p>
          <button
            onClick={() => { setConfirmSent(false); setIsRegister(false) }}
            className="text-primary font-semibold hover:underline"
          >
            Natrag na prijavu
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-light flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        {/* Logo */}
        <Link to="/" className="block text-center mb-8">
          <h1 className="text-2xl font-bold">
            <span className="text-primary">Bepo</span>
            <span className="text-dark">Bot</span>
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Vas apartman radi dok vi uzivate.
          </p>
        </Link>

        {/* Toggle */}
        <div className="flex bg-light rounded-lg p-1 mb-6">
          <button
            onClick={() => { setIsRegister(false); setError('') }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              !isRegister ? 'bg-white text-text shadow-sm' : 'text-text-muted'
            }`}
          >
            Prijavi se
          </button>
          <button
            onClick={() => { setIsRegister(true); setError('') }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              isRegister ? 'bg-white text-text shadow-sm' : 'text-text-muted'
            }`}
          >
            Registriraj se
          </button>
        </div>

        {error && (
          <div className="bg-danger-light border border-danger-border text-red-700 rounded-lg p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {isDemo && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg p-3 mb-4 text-sm">
            Demo modo — Supabase nije konfiguriran. Kliknite za pristup demo chatu.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-text mb-1">Ime i prezime</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Ivan Horvat"
                className="w-full px-4 py-3 rounded-lg border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="vas@email.com"
              className="w-full px-4 py-3 rounded-lg border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Lozinka</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Najmanje 6 znakova"
              className="w-full px-4 py-3 rounded-lg border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Ucitavanje...' : isRegister ? 'Kreiraj account' : 'Prijavi se'}
          </button>
        </form>

        <p className="text-center text-text-muted text-xs mt-6">
          {isRegister
            ? '14 dana besplatno. Bez kartice. Otkazite kad zelite.'
            : 'Nemate account? Registrirajte se besplatno.'}
        </p>
      </div>
    </div>
  )
}
