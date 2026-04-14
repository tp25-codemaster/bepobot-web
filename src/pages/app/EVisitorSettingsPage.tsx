import { useEffect, useState } from 'react'
import AppShell from '../../components/app/AppShell'
import { useAuth } from '../../contexts/AuthContext'
import { connectEVisitor, disconnectEVisitor } from '../../lib/evisitor'
import { supabase } from '../../lib/supabase'

interface LogEntry {
  id: string
  guest_name: string
  apartment_name: string
  status: 'success' | 'error'
  created_at: string
}

export default function EVisitorSettingsPage() {
  const { user, profile, updateProfile } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])

  const connected = profile?.evisitor_connected ?? false
  const connectedUsername = profile?.evisitor_username ?? ''
  const autoCheckin = profile?.evisitor_auto_checkin ?? false

  // Prefill username kad je već povezan
  useEffect(() => {
    if (connected && connectedUsername) {
      setUsername(connectedUsername)
    }
  }, [connected, connectedUsername])

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
    setLoading(true)
    setError(null)
    setSuccess(null)

    const res = await connectEVisitor(username.trim(), password)

    if (res.success) {
      setSuccess('eVisitor uspješno povezan ✓')
      setPassword('')
      // Profil će se ažurirati kad Supabase vrati nove podatke
      await updateProfile({
        evisitor_username: res.username || username.trim(),
        evisitor_connected: true,
      })
    } else {
      setError(res.error || 'Greška prilikom povezivanja')
    }
    setLoading(false)
  }

  async function handleDisconnect() {
    if (!confirm('Odspojiti eVisitor račun? Možete ga uvijek ponovno povezati.'))
      return
    setLoading(true)
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
      setError(res.error || 'Greška prilikom odspajanja')
    }
    setLoading(false)
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
        {/* Connection status */}
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text">Povezivanje</h3>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                connected
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {connected ? `Povezano (${connectedUsername})` : 'Nije povezano'}
            </span>
          </div>

          {error && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-3 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
              {success}
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
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  eVisitor lozinka
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Vaša eVisitor lozinka"
                  required
                  autoComplete="new-password"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? '⏳ Provjeravam...' : 'Poveži se'}
              </button>
              <p className="text-xs text-text-muted">
                Lozinka se enkriptira (AES-256-GCM) prije spremanja u bazu.
                Provjeravamo je tako da se stvarno prijavimo na eVisitor — ako
                uspije, spremamo.
              </p>
            </form>
          ) : (
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="w-full py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {loading ? '⏳...' : 'Odspoji eVisitor račun'}
            </button>
          )}
        </div>

        {/* Auto check-in toggle */}
        <div
          className={`bg-white rounded-xl border border-border p-4 ${
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
                autoCheckin ? 'bg-primary' : 'bg-gray-300'
              } disabled:cursor-not-allowed`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  autoCheckin ? 'translate-x-5.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Activity log */}
        <div className="bg-white rounded-xl border border-border p-4">
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
      </div>
    </AppShell>
  )
}
