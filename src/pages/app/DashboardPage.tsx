import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../../components/app/AppShell'
import { useAuth } from '../../contexts/AuthContext'
import { useChat } from '../../hooks/useChat'
import { supabase, isDemoMode } from '../../lib/supabase'
import ChatBubble from '../../components/chat/ChatBubble'
import TypingIndicator from '../../components/chat/TypingIndicator'

interface Reservation {
  id: string
  guest_name: string
  tourist_name: string | null
  tourist_surname: string | null
  guest_contact: string | null
  check_in: string
  check_out: string
  status: string
  guests_count: number
  apartments: { name: string } | null
}

interface PendingRes {
  id: string
  guest_name: string
  apartment_name_raw: string
  check_in: string
  check_out: string
  platform: string
}

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit' })
}

function nights(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000))
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Dobro jutro'
  if (h < 18) return 'Dobar dan'
  return 'Dobra vecer'
}

export default function DashboardPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [pending, setPending] = useState<PendingRes[]>([])
  const [guestsWithoutEmail, setGuestsWithoutEmail] = useState(0)
  const [loading, setLoading] = useState(true)

  const {
    messages, sending, sendMessage,
  } = useChat()

  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  useEffect(() => {
    if (!user || isDemoMode) { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      const [resResult, pendResult, emailResult] = await Promise.all([
        supabase
          .from('reservations')
          .select('id, guest_name, tourist_name, tourist_surname, guest_contact, check_in, check_out, status, guests_count, apartments(name)')
          .eq('user_id', user.id)
          .neq('status', 'cancelled')
          .gte('check_out', today)
          .order('check_in', { ascending: true })
          .limit(50),
        supabase
          .from('pending_reservations')
          .select('id, guest_name, apartment_name_raw, check_in, check_out, platform')
          .eq('user_id', user.id)
          .eq('status', 'pending'),
        supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .is('guest_email', null)
          .not('tourist_name', 'is', null),
      ])

      if (cancelled) return

      const rows = ((resResult.data || []) as any[]).map((r) => ({
        ...r,
        apartments: Array.isArray(r.apartments) ? r.apartments[0] || null : r.apartments,
      }))
      setReservations(rows as Reservation[])
      setPending((pendResult.data || []) as PendingRes[])
      setGuestsWithoutEmail(emailResult.count || 0)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [user])

  const todayCheckins = useMemo(() =>
    reservations.filter(r => r.check_in === today), [reservations, today])
  const todayCheckouts = useMemo(() =>
    reservations.filter(r => r.check_out === today), [reservations, today])
  const activeGuests = useMemo(() =>
    reservations.filter(r => r.check_in <= today && r.check_out > today), [reservations, today])
  const upcoming = useMemo(() =>
    reservations.filter(r => r.check_in > today && r.check_in <= weekEnd).slice(0, 5), [reservations, today, weekEnd])
  const tomorrowCheckins = useMemo(() =>
    reservations.filter(r => r.check_in === tomorrow), [reservations, tomorrow])

  // Auto-generate to-do items
  const todos = useMemo(() => {
    const items: Array<{ text: string; action: string; icon: string }> = []

    // Pending reservations
    for (const p of pending) {
      items.push({
        text: `Potvrdi rezervaciju: ${p.guest_name} (${p.platform})`,
        action: `potvrdi rezervaciju za ${p.guest_name}`,
        icon: '📋',
      })
    }

    // Tomorrow check-ins without contact
    for (const r of tomorrowCheckins) {
      items.push({
        text: `Pošalji check-in info: ${r.guest_name} (sutra)`,
        action: `pošalji check-in info za ${r.guest_name}`,
        icon: '🔑',
      })
    }

    // Today check-outs → cleaning needed
    for (const r of todayCheckouts) {
      const apt = r.apartments?.name || 'apartman'
      items.push({
        text: `Javi čistačici za ${apt}`,
        action: `javi čistačici da dođe danas u ${apt}`,
        icon: '🧹',
      })
    }

    // Guests without email
    if (guestsWithoutEmail > 5) {
      items.push({
        text: `${guestsWithoutEmail} gostiju bez emaila`,
        action: '',
        icon: '📧',
      })
    }

    return items
  }, [pending, tomorrowCheckins, todayCheckouts, guestsWithoutEmail])

  // Mini chat
  const lastMessages = useMemo(() =>
    messages.filter(m => m.type === 'user' || m.type === 'bot-text').slice(-3),
    [messages]
  )

  const [chatInput, setChatInput] = useState('')

  function handleChatSend() {
    if (!chatInput.trim()) return
    sendMessage(chatInput)
    setChatInput('')
  }

  function handleTodoClick(action: string) {
    if (!action) {
      navigate('/app/gosti')
      return
    }
    sendMessage(action)
    navigate('/app/chat')
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'korisnice'

  return (
    <AppShell title="Pocetna">
      <div className="p-4 space-y-4 max-w-2xl mx-auto pb-20">
        {/* Greeting */}
        <div>
          <h1 className="text-xl font-bold text-text">
            {getGreeting()}, {firstName}!
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            {new Date().toLocaleDateString('hr-HR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard value={todayCheckins.length} label="Check-in danas" icon="🛬" color="bg-green-50 text-green-700" />
          <StatCard value={todayCheckouts.length} label="Check-out danas" icon="🛫" color="bg-orange-50 text-orange-700" />
          <StatCard value={activeGuests.length} label="Aktivni gosti" icon="🏠" color="bg-blue-50 text-blue-700" />
        </div>

        {/* Today's guests */}
        {(todayCheckins.length > 0 || todayCheckouts.length > 0) && (
          <div className="bg-white rounded-xl border border-border p-4">
            <h2 className="font-semibold text-text text-sm mb-3">Danas</h2>
            {todayCheckins.map(r => (
              <GuestRow key={r.id} r={r} badge="CHECK-IN" badgeColor="bg-green-100 text-green-700" />
            ))}
            {todayCheckouts.map(r => (
              <GuestRow key={r.id} r={r} badge="CHECK-OUT" badgeColor="bg-orange-100 text-orange-700" />
            ))}
          </div>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <div className="bg-white rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-text text-sm">Sljedeci dolasci</h2>
              <button onClick={() => navigate('/app/kalendar')} className="text-xs text-primary font-medium">
                Kalendar →
              </button>
            </div>
            {upcoming.map(r => (
              <GuestRow key={r.id} r={r} />
            ))}
          </div>
        )}

        {/* To-do */}
        {todos.length > 0 && (
          <div className="bg-white rounded-xl border border-border p-4">
            <h2 className="font-semibold text-text text-sm mb-3">Za napraviti</h2>
            <div className="space-y-2">
              {todos.map((item, i) => (
                <button
                  key={i}
                  onClick={() => handleTodoClick(item.action)}
                  className="w-full flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg text-left hover:bg-primary/5 transition-colors"
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="text-sm text-text flex-1">{item.text}</span>
                  <svg className="w-4 h-4 text-text-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && reservations.length === 0 && todos.length === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🏖️</div>
            <div className="text-text-muted text-sm">
              Nema aktivnih rezervacija. Uzivaj u miru!
            </div>
          </div>
        )}

        {/* Mini chat */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <button
            onClick={() => navigate('/app/chat')}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-primary/5 border-b border-border"
          >
            <span className="text-sm font-semibold text-text flex items-center gap-2">
              💬 BepoBot
            </span>
            <span className="text-xs text-primary font-medium">Otvori chat →</span>
          </button>

          {/* Last messages */}
          <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
            {lastMessages.length > 0 ? lastMessages.map((msg, i) => (
              <ChatBubble key={i} role={msg.type === 'user' ? 'user' : 'bot'} timestamp={msg.timestamp}>
                {msg.content}
              </ChatBubble>
            )) : (
              <div className="text-center text-xs text-text-muted py-4">
                Pitaj me bilo sto o apartmanima...
              </div>
            )}
            {sending && <TypingIndicator />}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 p-2 border-t border-border">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
              placeholder="Pitaj BepoBota..."
              className="flex-1 px-3 py-2 bg-gray-50 rounded-lg text-base outline-none focus:bg-white focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={handleChatSend}
              disabled={!chatInput.trim() || sending}
              className="w-9 h-9 bg-primary text-white rounded-lg flex items-center justify-center disabled:opacity-40"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function StatCard({ value, label, color }: { value: number; label: string; icon?: string; color: string }) {
  return (
    <div className={`rounded-xl p-3 text-center ${color}`}>
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-[10px] mt-0.5 uppercase tracking-wide opacity-80">{label}</div>
    </div>
  )
}

function GuestRow({ r, badge, badgeColor }: { r: Reservation; badge?: string; badgeColor?: string }) {
  const apt = r.apartments?.name || '-'
  const n = nights(r.check_in, r.check_out)
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-text truncate">{r.guest_name}</div>
        <div className="text-xs text-text-muted">
          {apt} · {formatDate(r.check_in)} → {formatDate(r.check_out)} ({n} noci)
        </div>
      </div>
      {badge && (
        <span className={`flex-shrink-0 ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold ${badgeColor}`}>
          {badge}
        </span>
      )}
    </div>
  )
}
