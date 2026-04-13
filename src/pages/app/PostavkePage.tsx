import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import AppShell from '../../components/app/AppShell'

export default function PostavkePage() {
  const { user, profile, signOut, isDemo } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/app/login')
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
