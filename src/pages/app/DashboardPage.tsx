import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../../components/app/AppShell'
import EmptyState from '../../components/app/EmptyState'
import { useAuth } from '../../contexts/AuthContext'
import { useChat } from '../../hooks/useChat'
import { useReservations, usePendingReservations, useGuestsWithoutEmailCount } from '../../hooks/queries'
import ChatBubble from '../../components/chat/ChatBubble'
import TypingIndicator from '../../components/chat/TypingIndicator'
import { renderMarkdown } from '../../lib/markdown'
import type { Reservation, PendingReservation } from '../../types/index'
import { formatDateShort, nights, getGreeting } from '../../lib/dateUtils'

type PendingRes = PendingReservation

export default function DashboardPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const { data: allReservations = [], isLoading: loadingRes } = useReservations()
  const { data: pendingData = [] } = usePendingReservations()
  const { data: guestsWithoutEmail = 0 } = useGuestsWithoutEmailCount()
  const loading = loadingRes

  const {
    messages, sending, sendMessage,
  } = useChat()

  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  // Filter active reservations (not cancelled, still running or future)
  const reservations = useMemo(() =>
    allReservations.filter(r => r.status !== 'cancelled' && r.check_out >= today).slice(0, 50) as unknown as Reservation[],
    [allReservations, today]
  )
  const pending = pendingData as unknown as PendingRes[]

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
    <AppShell title="Početna">
      <div className="pb-20">
        {/* Hero greeting */}
        <div className="bg-primary px-5 pt-5 pb-8">
          <p className="text-primary-light text-xs font-medium uppercase tracking-widest mb-1">
            {new Date().toLocaleDateString('hr-HR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-white text-2xl font-bold">
            {getGreeting()}, {firstName}!
          </h1>
        </div>

        {/* KPI tiles — lifted up overlapping hero */}
        <div className="px-4 -mt-4">
          <div className="grid grid-cols-2 gap-3">
            <KpiCard
              value={activeGuests.length}
              label="Aktivne rezervacije"
              icon={<IconBed />}
              accent="bg-white"
              valueColor="text-primary"
            />
            <KpiCard
              value={pending.length}
              label="Čeka potvrdu"
              icon={<IconClock />}
              accent="bg-white"
              valueColor={pending.length > 0 ? 'text-amber-500' : 'text-primary'}
            />
            <KpiCard
              value={todayCheckins.length}
              label="Dolasci danas"
              icon={<IconArrival />}
              accent="bg-white"
              valueColor={todayCheckins.length > 0 ? 'text-emerald-600' : 'text-primary'}
            />
            <KpiCard
              value={todayCheckouts.length}
              label="Odlasci danas"
              icon={<IconDeparture />}
              accent="bg-white"
              valueColor={todayCheckouts.length > 0 ? 'text-rose-500' : 'text-primary'}
            />
          </div>
        </div>

        <div className="px-4 mt-5 space-y-4">
          {/* Quick actions */}
          <div>
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2.5">Brze akcije</h2>
            <div className="grid grid-cols-4 gap-2">
              <QuickAction icon={<IconCalendar />} label="Kalendar" onClick={() => navigate('/app/kalendar')} />
              <QuickAction icon={<IconList />} label="Rezervacije" onClick={() => navigate('/app/rezervacije')} />
              <QuickAction icon={<IconUsers />} label="Gosti" onClick={() => navigate('/app/gosti')} />
              <QuickAction icon={<IconChat />} label="Chat" onClick={() => navigate('/app/chat')} />
            </div>
          </div>

          {/* Today's guests */}
          {(todayCheckins.length > 0 || todayCheckouts.length > 0) && (
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h2 className="font-semibold text-text text-sm">Danas</h2>
              </div>
              <div className="divide-y divide-border">
                {todayCheckins.map(r => (
                  <GuestRow key={r.id} r={r} badge="DOLAZAK" badgeColor="bg-emerald-100 text-emerald-700" dot="bg-emerald-500" />
                ))}
                {todayCheckouts.map(r => (
                  <GuestRow key={r.id} r={r} badge="ODLAZAK" badgeColor="bg-rose-100 text-rose-600" dot="bg-rose-500" />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming timeline */}
          {upcoming.length > 0 && (
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-text text-sm">Nadolazeći dolasci</h2>
                <button
                  onClick={() => navigate('/app/kalendar')}
                  className="text-xs text-primary font-medium"
                >
                  Kalendar →
                </button>
              </div>
              <div className="px-4 py-3">
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                  <div className="space-y-4">
                    {upcoming.map((r, i) => {
                      const apt = r.apartments?.name || '-'
                      const n = nights(r.check_in, r.check_out)
                      const isFirst = i === 0
                      return (
                        <div key={r.id} className="flex gap-4 items-start relative">
                          <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 mt-0.5 border-2 border-white shadow-sm z-10 ${isFirst ? 'bg-primary' : 'bg-border'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-sm font-medium text-text truncate">{r.guest_name}</span>
                              <span className="text-[11px] text-text-muted flex-shrink-0">{formatDateShort(r.check_in)}</span>
                            </div>
                            <div className="text-xs text-text-muted mt-0.5">
                              {apt} · {n} {n === 1 ? 'noć' : 'noći'}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* To-do */}
          {todos.length > 0 && (
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h2 className="font-semibold text-text text-sm">Za napraviti</h2>
              </div>
              <div className="divide-y divide-border">
                {todos.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => handleTodoClick(item.action)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-light transition-colors active:bg-light/70"
                  >
                    <span className="text-base flex-shrink-0">{item.icon}</span>
                    <span className="text-sm text-text flex-1 leading-snug">{item.text}</span>
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
            <EmptyState
              icon="🏖️"
              title="Sve mirno"
              description="Nema aktivnih rezervacija ni taskova. Uživaj u miru!"
            />
          )}

          {/* Mini chat */}
          <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <button
              onClick={() => navigate('/app/chat')}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-light transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-text">BepoBot</span>
              </div>
              <span className="text-xs text-primary font-medium">Otvori →</span>
            </button>

            <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
              {lastMessages.length > 0 ? lastMessages.map((msg, i) => (
                <ChatBubble key={i} role={msg.type === 'user' ? 'user' : 'bot'} timestamp={msg.timestamp}>
                  {msg.type === 'user' ? msg.content : renderMarkdown(msg.content || '')}
                </ChatBubble>
              )) : (
                <div className="text-center text-xs text-text-muted py-4">
                  Pitaj me bilo što o apartmanima...
                </div>
              )}
              {sending && <TypingIndicator />}
            </div>

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
      </div>
    </AppShell>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  value, label, icon, accent, valueColor,
}: {
  value: number
  label: string
  icon: React.ReactNode
  accent: string
  valueColor: string
}) {
  return (
    <div className={`${accent} rounded-2xl border border-border shadow-sm p-4 flex flex-col gap-2`}>
      <div className="w-8 h-8 rounded-xl bg-light flex items-center justify-center text-primary">
        {icon}
      </div>
      <div>
        <div className={`text-2xl font-extrabold ${valueColor}`}>{value}</div>
        <div className="text-[11px] text-text-muted mt-0.5 leading-tight">{label}</div>
      </div>
    </div>
  )
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-2xl border border-border shadow-sm hover:bg-light active:scale-95 transition-all"
    >
      <div className="text-primary w-5 h-5 flex items-center justify-center">{icon}</div>
      <span className="text-[11px] font-medium text-text-muted leading-tight text-center">{label}</span>
    </button>
  )
}

function GuestRow({ r, badge, badgeColor, dot }: { r: Reservation; badge?: string; badgeColor?: string; dot?: string }) {
  const apt = r.apartments?.name || '-'
  const n = nights(r.check_in, r.check_out)
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {dot && <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-text truncate">{r.guest_name}</div>
        <div className="text-xs text-text-muted mt-0.5">
          {apt} · {formatDateShort(r.check_in)} → {formatDateShort(r.check_out)} ({n} {n === 1 ? 'noć' : 'noći'})
        </div>
      </div>
      {badge && (
        <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${badgeColor}`}>
          {badge}
        </span>
      )}
    </div>
  )
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function IconBed() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" />
      <path d="M2 10V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4" />
      <path d="M2 20h20" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function IconArrival() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  )
}

function IconDeparture() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" />
      <path d="M19 12l-7 7-7-7" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function IconList() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconChat() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
