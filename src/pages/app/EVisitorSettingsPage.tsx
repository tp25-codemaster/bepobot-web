import { useEffect, useState } from 'react'
import AppShell from '../../components/app/AppShell'
import ConfirmModal from '../../components/ConfirmModal'
import { useAuth } from '../../contexts/AuthContext'
import {
  connectEVisitor,
  disconnectEVisitor,
  checkInGuest,
} from '../../lib/evisitor'
import { supabase } from '../../lib/supabase'

interface LogEntry {
  id: string
  guest_name: string
  apartment_name: string
  status: 'success' | 'error'
  created_at: string
}

type ErrorKind =
  | 'credentials'
  | 'network'
  | 'evisitor_down'
  | 'session_expired'
  | 'unknown'

interface FormError {
  kind: ErrorKind
  title: string
  detail: string
}

function classifyError(raw: string): FormError {
  const lower = raw.toLowerCase()
  if (lower.includes('pogrešno') || lower.includes('invalid credentials')) {
    return {
      kind: 'credentials',
      title: 'Pogrešno korisničko ime ili lozinka',
      detail:
        'Provjerite da ste kredencijale dobro prepisali s eVisitor stranice. Velika/mala slova su bitna.',
    }
  }
  if (
    lower.includes('network') ||
    lower.includes('tls') ||
    lower.includes('failed to fetch') ||
    lower.includes('timeout')
  ) {
    return {
      kind: 'network',
      title: 'Problem s mrežom',
      detail:
        'Ne mogu doći do eVisitor servera. Provjerite internet vezu i pokušajte ponovo.',
    }
  }
  if (lower.includes('http 5') || lower.includes('eVisitor server')) {
    return {
      kind: 'evisitor_down',
      title: 'eVisitor je privremeno nedostupan',
      detail:
        'Server odgovara greškom. Pričekajte par minuta pa probajte ponovo.',
    }
  }
  if (
    lower.includes('unauthorized') ||
    lower.includes('expired') ||
    lower.includes('missing authorization')
  ) {
    return {
      kind: 'session_expired',
      title: 'Vaša sesija je istekla',
      detail: 'Odjavite se i ponovo prijavite pa pokušajte opet.',
    }
  }
  return {
    kind: 'unknown',
    title: 'Nešto je pošlo po krivu',
    detail: raw,
  }
}

export default function EVisitorSettingsPage() {
  const { user, profile, loading: authLoading, updateProfile } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<FormError | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [justConnected, setJustConnected] = useState(false)
  const [log, setLog] = useState<LogEntry[]>([])
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  const profileLoading = authLoading || !profile
  const connected = profile?.evisitor_connected ?? false
  const connectedUsername = profile?.evisitor_username ?? ''
  const autoCheckin = profile?.evisitor_auto_checkin ?? false

  // Prefill username kad je već povezan
  useEffect(() => {
    if (connected && connectedUsername) {
      setUsername(connectedUsername)
    }
  }, [connected, connectedUsername])

  // Pulse animacija na badge kad se upravo povezao
  useEffect(() => {
    if (justConnected) {
      const t = setTimeout(() => setJustConnected(false), 3000)
      return () => clearTimeout(t)
    }
  }, [justConnected])

  // Povuci zadnjih 5 prijava iz evisitor_log
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('evisitor_log')
        .select('id, guest_name, apartment_name, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)
      if (!cancelled && data) setLog(data as LogEntry[])
    })()
    return () => {
      cancelled = true
    }
  }, [user, connected])

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    const res = await connectEVisitor(username.trim(), password)

    if (res.success) {
      setSuccess('eVisitor uspješno povezan ✓')
      setPassword('')
      setJustConnected(true)
      await updateProfile({
        evisitor_username: res.username || username.trim(),
        evisitor_connected: true,
      })
    } else {
      setError(classifyError(res.error || 'Greška prilikom povezivanja'))
    }
    setSubmitting(false)
  }

  async function handleDisconnect() {
    setConfirmDisconnect(false)
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    const res = await disconnectEVisitor()
    if (res.success) {
      setUsername('')
      setPassword('')
      await updateProfile({
        evisitor_username: null,
        evisitor_password: null,
        evisitor_connected: false,
        evisitor_auto_checkin: false,
      })
      setSuccess('eVisitor odspojen')
    } else {
      setError(classifyError(res.error || 'Greška prilikom odspajanja'))
    }
    setSubmitting(false)
  }

  async function handleTestConnection() {
    setTesting(true)
    setError(null)
    setSuccess(null)
    // Test mode šalje minimalne podatke — backend napravi Login + Logout
    // s kredencijalima iz baze i ne radi stvarni CheckIn.
    const res = await checkInGuest({
      Facility: '',
      TouristName: '',
      TouristSurname: '',
      Gender: 'muški',
      DateOfBirth: '',
      DocumentType: '',
      DocumentNumber: '',
      Citizenship: '',
      CityOfResidence: '',
      StayFrom: '',
      ForeseenStayUntil: '',
      _testMode: true,
    })
    if (res.success) {
      setSuccess('Veza radi — eVisitor odgovara ispravno ✓')
    } else {
      setError(classifyError(res.error || 'Veza ne radi'))
    }
    setTesting(false)
  }

  async function handleAutoToggle() {
    if (!connected) return
    await updateProfile({ evisitor_auto_checkin: !autoCheckin })
  }

  function formatDate(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleString('hr-HR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <AppShell title="eVisitor">
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {profileLoading ? (
          <ConnectionSkeleton />
        ) : (
          <>
            {/* Connection status */}
            <div className="bg-white rounded-2xl border border-border/60 shadow-sm p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-text">Povezivanje</h3>
                <StatusBadge
                  connected={connected}
                  username={connectedUsername}
                  pulse={justConnected}
                />
              </div>

              {error && <ErrorAlert error={error} onDismiss={() => setError(null)} />}
              {success && (
                <div className="mb-3 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-center gap-2">
                  <span className="text-base">✓</span>
                  <span>{success}</span>
                </div>
              )}

              {!connected ? (
                <form onSubmit={handleConnect} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-text mb-1">
                      eVisitor korisničko ime
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Vaše eVisitor korisničko ime"
                      required
                      autoComplete="off"
                      disabled={submitting}
                      className="w-full px-3 py-2.5 border border-border/60 rounded-xl text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none disabled:opacity-50 bg-gray-50/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text mb-1">
                      eVisitor lozinka
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Vaša eVisitor lozinka"
                        required
                        autoComplete="new-password"
                        disabled={submitting}
                        className="w-full px-3 py-2.5 pr-10 border border-border/60 rounded-xl text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none disabled:opacity-50 bg-gray-50/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        tabIndex={-1}
                        aria-label={showPassword ? 'Sakrij lozinku' : 'Prikaži lozinku'}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text transition-colors"
                      >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Spinner /> Provjeravam...
                      </>
                    ) : (
                      'Poveži se'
                    )}
                  </button>
                  <p className="text-xs text-text-muted">
                    Lozinka se enkriptira (AES-256-GCM) prije spremanja u bazu.
                    Provjeravamo je tako da se stvarno prijavimo na eVisitor — ako
                    uspije, spremamo.
                  </p>
                </form>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={handleTestConnection}
                    disabled={testing || submitting}
                    className="w-full py-2.5 bg-white border border-primary/40 text-primary text-sm font-semibold rounded-xl hover:bg-primary/5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {testing ? (
                      <>
                        <Spinner /> Provjeravam vezu...
                      </>
                    ) : (
                      '🔌 Provjeri vezu'
                    )}
                  </button>
                  <button
                    onClick={() => setConfirmDisconnect(true)}
                    disabled={submitting || testing}
                    className="w-full py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Spinner /> Odspajam...
                      </>
                    ) : (
                      'Odspoji eVisitor račun'
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Auto check-in toggle */}
            <div
              className={`bg-white rounded-2xl border border-border/60 shadow-sm p-4 ${
                !connected ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-text text-sm">
                    Automatska prijava gostiju
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">
                    Bot automatski prijavljuje goste na eVisitor pri novoj
                    rezervaciji
                  </div>
                </div>
                <button
                  onClick={handleAutoToggle}
                  disabled={!connected}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    autoCheckin ? 'bg-primary' : 'bg-gray-200'
                  } disabled:cursor-not-allowed`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                      autoCheckin ? 'translate-x-5.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Activity log */}
            <div className="bg-white rounded-2xl border border-border/60 shadow-sm p-4">
              <h3 className="font-semibold text-text mb-3">Zadnje prijave</h3>
              {log.length === 0 ? (
                <p className="text-sm text-text-muted py-2">
                  Još nema prijava. Prvi check-in će se pojaviti ovdje.
                </p>
              ) : (
                <div className="space-y-2">
                  {log.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between py-2 border-b border-border last:border-0"
                    >
                      <div>
                        <div className="text-sm font-medium text-text">
                          {entry.guest_name}
                        </div>
                        <div className="text-xs text-text-muted">
                          {entry.apartment_name} · {formatDate(entry.created_at)}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-medium ${
                          entry.status === 'success'
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {entry.status === 'success' ? 'Uspjeh' : 'Greška'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <ConfirmModal
        open={confirmDisconnect}
        title="Odspoji eVisitor račun"
        message="Jesi li siguran/a da želiš odspojiti eVisitor račun? Možeš ga uvijek ponovno povezati."
        confirmLabel="Odspoji"
        onConfirm={handleDisconnect}
        onCancel={() => setConfirmDisconnect(false)}
        danger
      />
    </AppShell>
  )
}

// ─── Small presentational helpers ──────────────────────────────────────────

function StatusBadge({
  connected,
  username,
  pulse,
}: {
  connected: boolean
  username: string
  pulse: boolean
}) {
  if (connected) {
    return (
      <span
        className={`relative px-2.5 py-1 text-xs font-semibold rounded-full bg-green-50 text-green-700 ${
          pulse ? 'ring-2 ring-green-400 ring-offset-1' : ''
        }`}
      >
        {pulse && (
          <span className="absolute inset-0 rounded-full bg-green-400 opacity-40 animate-ping" />
        )}
        <span className="relative">
          Povezano{username ? ` · ${username}` : ''}
        </span>
      </span>
    )
  }
  return (
    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-text-muted">
      Nije povezano
    </span>
  )
}

function ErrorAlert({
  error,
  onDismiss,
}: {
  error: FormError
  onDismiss: () => void
}) {
  return (
    <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0 leading-none mt-0.5">⚠️</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-red-800">
            {error.title}
          </div>
          <div className="text-xs text-red-700 mt-0.5 break-words">
            {error.detail}
          </div>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Zatvori"
          className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0 -mt-1 -mr-1 p-1"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M3 3l8 8M11 3l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}

function ConnectionSkeleton() {
  return (
    <>
      <div className="bg-white rounded-2xl border border-border/60 shadow-sm p-4 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-28 bg-gray-200 rounded" />
          <div className="h-5 w-24 bg-gray-200 rounded-full" />
        </div>
        <div className="space-y-3">
          <div className="h-10 bg-gray-100 rounded-lg" />
          <div className="h-10 bg-gray-100 rounded-lg" />
          <div className="h-9 bg-gray-200 rounded-lg" />
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-border/60 shadow-sm p-4 animate-pulse">
        <div className="h-4 w-48 bg-gray-200 rounded" />
      </div>
      <div className="bg-white rounded-2xl border border-border/60 shadow-sm p-4 animate-pulse">
        <div className="h-4 w-32 bg-gray-200 rounded mb-3" />
        <div className="space-y-2">
          <div className="h-10 bg-gray-100 rounded" />
          <div className="h-10 bg-gray-100 rounded" />
        </div>
      </div>
    </>
  )
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeOpacity="0.25"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
