import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import AppShell from '../../components/app/AppShell'

export default function PostavkePage() {
  const { user, profile, signOut, isDemo, session, updateProfile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [gmailStatus, setGmailStatus] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    const gmail = searchParams.get('gmail')
    if (gmail === 'connected') {
      setGmailStatus('connected')
      // Refresh profile to get updated gmail_connected
      if (user) {
        supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
          if (data) updateProfile(data)
        })
      }
    } else if (gmail === 'error') {
      setGmailStatus('error')
    }
  }, [searchParams])

  async function handleLogout() {
    await signOut()
    navigate('/app/login')
  }

  function handleConnectGmail() {
    if (!session?.access_token) return
    window.location.href = `/api/gmail-connect?token=${session.access_token}`
  }

  async function handleDisconnectGmail() {
    if (!session?.access_token) return
    setDisconnecting(true)
    try {
      await fetch('/api/gmail-disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      updateProfile({ gmail_connected: false, gmail_email: null } as any)
    } catch {}
    setDisconnecting(false)
  }

  return (
    <AppShell title="Postavke">
      <div className="p-4 space-y-4">
        {/* Profile */}
        <div className="bg-white rounded-xl border border-border p-4">
          <h3 className="font-semibold text-text mb-3">Profil</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Ime</span>
              <span className="text-text font-medium">
                {profile?.full_name || (isDemo ? 'Demo korisnik' : '-')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Email</span>
              <span className="text-text font-medium">
                {isDemo ? 'demo@bepobot.hr' : user?.email || '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Plan</span>
              <span className="text-primary font-semibold capitalize">
                {profile?.plan === 'trial' ? '14 dana trial' : profile?.plan || 'trial'}
              </span>
            </div>
          </div>
        </div>

        {/* Gmail */}
        <div className="bg-white rounded-xl border border-border p-4">
          <h3 className="font-semibold text-text mb-3">Gmail</h3>
          <p className="text-xs text-text-muted mb-3">
            Poveži Gmail da BepoBot automatski prati nove rezervacije iz Booking.com, Airbnb i direktnih emailova.
          </p>
          {gmailStatus === 'connected' && (
            <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              Gmail uspjesno povezan!
            </div>
          )}
          {gmailStatus === 'error' && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              Greska pri povezivanju Gmaila. Pokusajte ponovo.
            </div>
          )}
          {profile?.gmail_connected ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm text-text font-medium">{profile.gmail_email || 'Povezan'}</span>
              </div>
              <button
                onClick={handleDisconnectGmail}
                disabled={disconnecting}
                className="w-full py-2 bg-gray-100 text-text-muted text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {disconnecting ? 'Odspajam...' : 'Odspoji Gmail'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectGmail}
              disabled={isDemo}
              className="w-full py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Povezi Gmail
            </button>
          )}
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-xl border border-border p-4">
          <h3 className="font-semibold text-text mb-3">Obavijesti</h3>
          <div className="space-y-3">
            <ToggleRow label="Jutarnji pregled (08:00)" defaultOn />
            <ToggleRow label="Novi dolasci" defaultOn />
            <ToggleRow label="Podsetnici za check-out" defaultOn={false} />
          </div>
        </div>

        {/* Language */}
        <div className="bg-white rounded-xl border border-border p-4">
          <h3 className="font-semibold text-text mb-3">Jezik</h3>
          <div className="flex gap-2">
            <button className="flex-1 py-2 bg-primary text-white text-sm font-semibold rounded-lg">
              Hrvatski
            </button>
            <button className="flex-1 py-2 bg-gray-100 text-text-muted text-sm font-medium rounded-lg">
              English
            </button>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-3 bg-red-50 text-red-600 font-semibold rounded-xl border border-red-200 hover:bg-red-100 transition-colors text-sm"
        >
          Odjavi se
        </button>

        {/* Version */}
        <p className="text-center text-xs text-text-muted">
          BepoBot v0.1.0 · Powered by Noesiss
        </p>
      </div>
    </AppShell>
  )
}

function ToggleRow({ label, defaultOn = false }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text">{label}</span>
      <button
        onClick={() => setOn(!on)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          on ? 'bg-primary' : 'bg-gray-300'
        }`}
      >
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          on ? 'translate-x-5.5' : 'translate-x-0.5'
        }`} />
      </button>
    </div>
  )
}
