import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import AppShell from '../../components/app/AppShell'

interface ApartmentSync {
  id: string
  name: string
  booking_ical_url: string | null
  airbnb_ical_url: string | null
  ical_export_token: string | null
  ical_last_synced_at: string | null
}

export default function PostavkePage() {
  const { user, profile, signOut, isDemo, session, updateProfile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [gmailStatus, setGmailStatus] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [apartments, setApartments] = useState<ApartmentSync[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncingAptId, setSyncingAptId] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (user) void loadApartments()
  }, [user])

  async function loadApartments() {
    const { data } = await supabase
      .from('apartments')
      .select('id, name, booking_ical_url, airbnb_ical_url, ical_export_token, ical_last_synced_at')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: true })
    setApartments((data as ApartmentSync[]) || [])
  }

  async function handleSyncAll() {
    if (syncing || !session?.access_token) return
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/sync-ical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({}),
      })
      const json = await res.json() as { totalConflicts?: number; results?: Array<{ created: number }> }
      const created = (json.results || []).reduce((s: number, r: { created: number }) => s + r.created, 0)
      setSyncMsg(json.totalConflicts ? `⚠️ ${created} novih, ${json.totalConflicts} KONFLIKATA!` : `✓ ${created} novih rezervacija`)
      void loadApartments()
    } catch {
      setSyncMsg('Greška pri sync-u')
    } finally {
      setSyncing(false)
    }
  }

  async function handleSyncApt(aptId: string) {
    if (syncingAptId || !session?.access_token) return
    setSyncingAptId(aptId)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/sync-ical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ apartment_id: aptId }),
      })
      const json = await res.json() as { totalConflicts?: number; results?: Array<{ created: number }> }
      const created = (json.results || []).reduce((s: number, r: { created: number }) => s + r.created, 0)
      setSyncMsg(json.totalConflicts ? `⚠️ ${created} novih, ${json.totalConflicts} KONFLIKATA!` : `✓ ${created} novih`)
      void loadApartments()
    } catch {
      setSyncMsg('Greška pri sync-u')
    } finally {
      setSyncingAptId(null)
    }
  }

  function exportUrl(apt: ApartmentSync) {
    return `${window.location.origin}/api/ical-export?apt=${apt.id}&token=${apt.ical_export_token}`
  }

  async function copyExportUrl(apt: ApartmentSync) {
    await navigator.clipboard.writeText(exportUrl(apt))
    setCopiedId(apt.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

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
    } catch (err) {
      alert('Greška pri odspajanju Gmaila: ' + (err instanceof Error ? err.message : 'Nepoznata greška'))
    }
    setDisconnecting(false)
  }

  return (
    <AppShell title="Postavke">
      <div className="p-4 space-y-6">

        {/* Profil */}
        <section>
          <SectionHeader icon="👤" label="Profil" />
          <div className="bg-white rounded-2xl border border-border/60 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
              <span className="text-sm text-text-muted">Ime</span>
              <span className="text-sm text-text font-medium">
                {profile?.full_name || (isDemo ? 'Demo korisnik' : '—')}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
              <span className="text-sm text-text-muted">Email</span>
              <span className="text-sm text-text font-medium">
                {isDemo ? 'demo@bepobot.hr' : user?.email || '—'}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-text-muted">Plan</span>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-primary/10 text-primary capitalize">
                {profile?.plan === 'trial' ? '14 dana trial' : profile?.plan || 'trial'}
              </span>
            </div>
          </div>
        </section>

        {/* Integracije */}
        <section>
          <SectionHeader icon="🔌" label="Integracije" />
          <div className="space-y-3">

            {/* Gmail */}
            <div className="bg-white rounded-2xl border border-border/60 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                    <GmailIcon />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-text">Gmail</div>
                    <div className="text-xs text-text-muted">Booking, Airbnb, direktni emailovi</div>
                  </div>
                </div>
                <ConnectionBadge connected={!!profile?.gmail_connected} />
              </div>

              {gmailStatus === 'connected' && (
                <div className="mb-3 px-3 py-2 bg-green-50 border border-green-100 rounded-xl text-xs text-green-700 flex items-center gap-1.5">
                  <span>✓</span>
                  <span>Gmail uspješno povezan!</span>
                </div>
              )}
              {gmailStatus === 'error' && (
                <div className="mb-3 px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 flex items-center gap-1.5">
                  <span>⚠</span>
                  <span>Greška pri povezivanju. Pokušajte ponovo.</span>
                </div>
              )}

              {profile?.gmail_connected ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0" />
                    <span className="text-xs text-text font-medium truncate">
                      {profile.gmail_email || 'Povezan'}
                    </span>
                  </div>
                  <button
                    onClick={handleDisconnectGmail}
                    disabled={disconnecting}
                    className="w-full py-2 text-xs font-medium text-text-muted bg-gray-50 rounded-xl border border-border/40 hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    {disconnecting ? 'Odspajam...' : 'Odspoji Gmail'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnectGmail}
                  disabled={isDemo}
                  className="w-full py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  Povezi Gmail
                </button>
              )}
            </div>

            {/* iCal kalendar sync */}
            <div className="bg-white rounded-2xl border border-border/60 shadow-sm p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">📅</span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-text">Kalendar sync</div>
                  <div className="text-xs text-text-muted">Booking.com i Airbnb · auto svaka 2h</div>
                </div>
              </div>

              {syncMsg && (
                <div className={`mb-3 px-3 py-2 rounded-xl text-xs font-medium ${syncMsg.includes('KONFLIKAT') ? 'bg-orange-50 text-orange-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {syncMsg}
                </div>
              )}

              {apartments.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-2">
                  Dodaj iCal URL-ove u Moji apartmani → Uredi.
                </p>
              ) : (
                <div className="space-y-2 mb-3">
                  {apartments.map(apt => (
                    <div key={apt.id} className="border border-border/60 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-text">{apt.name}</span>
                        <div className="flex gap-1">
                          {apt.booking_ical_url
                            ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Booking ✓</span>
                            : <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">Booking —</span>
                          }
                          {apt.airbnb_ical_url
                            ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">Airbnb ✓</span>
                            : <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">Airbnb —</span>
                          }
                        </div>
                      </div>

                      {apt.ical_export_token && (
                        <div>
                          <p className="text-[10px] text-text-muted mb-1">BepoBot URL (dodaj u Booking/Airbnb kao "Uvezi kalendar")</p>
                          <div className="flex gap-1.5">
                            <div className="flex-1 px-2 py-1.5 bg-gray-50 border border-border/40 rounded-lg font-mono text-[9px] text-gray-500 truncate">
                              {exportUrl(apt)}
                            </div>
                            <button
                              onClick={() => void copyExportUrl(apt)}
                              className="shrink-0 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                            >
                              {copiedId === apt.id ? '✓' : 'Kopiraj'}
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-text-muted">
                          {apt.ical_last_synced_at
                            ? `Sync: ${new Date(apt.ical_last_synced_at).toLocaleString('hr-HR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                            : 'Još nije sinkronizirano'}
                        </span>
                        {(apt.booking_ical_url || apt.airbnb_ical_url) && (
                          <button
                            onClick={() => void handleSyncApt(apt.id)}
                            disabled={!!syncingAptId}
                            className="text-xs font-semibold px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                          >
                            {syncingAptId === apt.id ? 'Sync...' : '↻ Sync'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {apartments.some(a => a.booking_ical_url || a.airbnb_ical_url) && (
                <button
                  onClick={() => void handleSyncAll()}
                  disabled={syncing || !!syncingAptId}
                  className="w-full py-2 text-xs font-semibold rounded-xl bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {syncing ? 'Sinkroniziram...' : '↻ Sync sve'}
                </button>
              )}
            </div>

            {/* eVisitor */}
            <button
              type="button"
              onClick={() => navigate('/app/evisitor')}
              className="w-full bg-white rounded-2xl border border-border/60 shadow-sm p-4 text-left hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">🏛️</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-text">eVisitor</div>
                    <div className="text-xs text-text-muted">
                      {profile?.evisitor_connected
                        ? profile.evisitor_username || 'Povezan'
                        : 'Automatska prijava gostiju'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ConnectionBadge connected={!!profile?.evisitor_connected} />
                  <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>

          </div>
        </section>

        {/* Obavijesti */}
        <section>
          <SectionHeader icon="🔔" label="Obavijesti" />
          <div className="bg-white rounded-2xl border border-border/60 shadow-sm divide-y divide-border/40">
            <ToggleRow label="Jutarnji pregled (08:00)" defaultOn />
            <ToggleRow label="Novi dolasci" defaultOn />
            <ToggleRow label="Podsjetnici za check-out" defaultOn={false} />
          </div>
        </section>

        {/* Jezik */}
        <section>
          <SectionHeader icon="🌐" label="Jezik" />
          <div className="bg-white rounded-2xl border border-border/60 shadow-sm p-4">
            <div className="flex gap-2" role="group" aria-label="Odabir jezika">
              <button
                className="flex-1 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl"
                aria-pressed="true"
              >
                Hrvatski
              </button>
              <button
                className="flex-1 py-2.5 bg-gray-50 text-text-muted text-sm font-medium rounded-xl border border-border/40"
                aria-pressed="false"
              >
                English
              </button>
            </div>
          </div>
        </section>

        {/* Opasna zona */}
        <section>
          <SectionHeader icon="⚠️" label="Opasna zona" />
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-4">
            <button
              onClick={handleLogout}
              className="w-full py-3 bg-red-50 text-red-600 font-semibold rounded-xl border border-red-200 hover:bg-red-100 transition-colors text-sm flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Odjavi se
            </button>
          </div>
        </section>

        <p className="text-center text-xs text-text-muted pb-2">
          BepoBot v0.1.0 · Powered by Noēsiss
        </p>
      </div>
    </AppShell>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function SectionHeader({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2 px-1">
      <span className="text-sm">{icon}</span>
      <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">{label}</span>
    </div>
  )
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
      connected ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-text-muted'
    }`}>
      {connected ? 'Povezano' : 'Nije pov.'}
    </span>
  )
}

function GmailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#EA4335" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="22,6 12,13 2,6" stroke="#EA4335" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function ToggleRow({ label, defaultOn = false }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="text-sm text-text" id={`toggle-label-${label.replace(/\s/g, '-')}`}>{label}</span>
      <button
        onClick={() => setOn(!on)}
        role="switch"
        aria-checked={on}
        aria-labelledby={`toggle-label-${label.replace(/\s/g, '-')}`}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          on ? 'bg-primary' : 'bg-gray-200'
        }`}
      >
        <div aria-hidden="true" className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
          on ? 'translate-x-5.5' : 'translate-x-0.5'
        }`} />
      </button>
    </div>
  )
}
