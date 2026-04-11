import { useState, useEffect, useRef, useCallback } from 'react'
import ChatBubble from '../components/chat/ChatBubble'
import ChatCard from '../components/chat/ChatCard'
import QuickActions from '../components/chat/QuickActions'
import TypingIndicator from '../components/chat/TypingIndicator'
import ChatInput from '../components/chat/ChatInput'
import {
  SCENARIOS,
  matchScenario,
  getFallbackMessages,
  type ScenarioMessage,
} from '../lib/chatScenarios'

interface DisplayMessage {
  type: ScenarioMessage['type']
  content?: string
  card?: ScenarioMessage['card']
  actions?: string[]
}

export default function AppSimulation() {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [showTyping, setShowTyping] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeScenario, setActiveScenario] = useState<string | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(true)
  const chatRef = useRef<HTMLDivElement>(null)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }, [])

  // Auto-scroll
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages, showTyping])

  const playMessages = useCallback(
    (scenarioMessages: ScenarioMessage[], startWithUserMessage?: string) => {
      clearTimeouts()
      setIsPlaying(true)
      setShowTyping(false)

      // Add user message immediately if provided via text input
      if (startWithUserMessage) {
        setMessages((prev) => [
          ...prev,
          { type: 'user', content: startWithUserMessage },
        ])
      }

      let cumulativeDelay = startWithUserMessage ? 600 : 0

      scenarioMessages.forEach((msg) => {
        if (msg.type === 'user' && !startWithUserMessage) {
          // Show scripted user message
          const t = setTimeout(() => {
            setMessages((prev) => [...prev, { type: msg.type, content: msg.content }])
          }, cumulativeDelay)
          timeoutsRef.current.push(t)
          cumulativeDelay += msg.delayMs
        } else if (msg.type === 'user' && startWithUserMessage) {
          // Skip scripted user message — we already added the typed one
          return
        } else {
          // Bot message — show typing first
          const typingT = setTimeout(() => setShowTyping(true), cumulativeDelay)
          timeoutsRef.current.push(typingT)
          cumulativeDelay += 800

          const msgT = setTimeout(() => {
            setShowTyping(false)
            setMessages((prev) => [
              ...prev,
              {
                type: msg.type,
                content: msg.content,
                card: msg.card,
                actions: msg.actions,
              },
            ])
          }, cumulativeDelay)
          timeoutsRef.current.push(msgT)
          cumulativeDelay += msg.delayMs
        }
      })

      const endT = setTimeout(() => setIsPlaying(false), cumulativeDelay)
      timeoutsRef.current.push(endT)
    },
    [clearTimeouts]
  )

  const handleScenarioSelect = (scenarioId: string) => {
    setShowOnboarding(false)
    setActiveScenario(scenarioId)
    const scenario = SCENARIOS.find((s) => s.id === scenarioId)
    if (!scenario) return
    setMessages([])
    playMessages(scenario.messages)
  }

  const handleUserInput = (text: string) => {
    setShowOnboarding(false)
    const matched = matchScenario(text)
    if (matched) {
      setActiveScenario(matched.id)
      // Play bot responses only (skip the scripted user message)
      const botMessages = matched.messages.filter((m) => m.type !== 'user')
      playMessages(botMessages, text)
    } else {
      // Fallback
      playMessages(getFallbackMessages(), text)
    }
  }

  const handleQuickAction = (action: string) => {
    // Strip emoji prefix if present
    const cleaned = action.replace(/^[^\w\s]*\s*/, '')
    handleUserInput(cleaned)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* App header */}
      <div className="bg-primary flex-shrink-0">
        <div className="flex items-center justify-between px-4 h-14 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-sm font-bold">B</span>
            </div>
            <div>
              <div className="text-white font-semibold text-sm">BepoBot</div>
              <div className="text-primary-light text-[10px]">online</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 bg-white/10 text-white/60 text-[10px] font-medium rounded-full border border-white/10">
              DEMO
            </span>
            <a href="/" className="text-white/60 text-sm hover:text-white transition-colors">
              ← Natrag
            </a>
          </div>
        </div>

        {/* Scenario tabs */}
        <div className="flex gap-1 px-3 pb-2 overflow-x-auto no-scrollbar">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => handleScenarioSelect(s.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeScenario === s.id
                  ? 'bg-white text-primary'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {s.icon} {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Onboarding overlay */}
        {showOnboarding && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <span className="text-3xl">🤖</span>
            </div>
            <h2 className="text-lg font-bold text-text mb-2">
              Dobrodošli u BepoBot demo!
            </h2>
            <p className="text-sm text-text-muted mb-6 max-w-sm">
              Odaberite scenarij iz tabova ili upišite poruku da vidite kako BepoBot radi.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleScenarioSelect(s.id)}
                  className="px-4 py-2.5 bg-primary/10 text-primary text-sm font-medium rounded-xl border border-primary/20 hover:bg-primary/20 active:scale-95 transition-all"
                >
                  {s.icon} {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => {
          if (msg.type === 'user') {
            return (
              <ChatBubble key={i} role="user" animate>
                {msg.content}
              </ChatBubble>
            )
          }
          if (msg.type === 'bot-card' && msg.card) {
            return (
              <ChatCard
                key={i}
                title={msg.card.title}
                fields={msg.card.fields}
                animate
              />
            )
          }
          if (msg.type === 'bot-actions' && msg.actions) {
            return (
              <QuickActions
                key={i}
                actions={msg.actions}
                onAction={handleQuickAction}
              />
            )
          }
          return (
            <ChatBubble key={i} role="bot" animate>
              {msg.content?.split('\n').map((line, j) => (
                <span key={j}>
                  {line}
                  {j < (msg.content?.split('\n').length ?? 1) - 1 && <br />}
                </span>
              ))}
            </ChatBubble>
          )
        })}

        {showTyping && <TypingIndicator />}
      </div>

      {/* Quick action bar */}
      <div className="flex-shrink-0 px-3 py-2 bg-white border-t border-border overflow-x-auto no-scrollbar">
        <div className="flex gap-2">
          {['📅 Raspored', '📋 Nova rezervacija', '🧹 Čišćenje', '🔑 Check-in', '📣 Kampanja', '🏛️ eVisitor', '🤖 AI'].map(
            (pill) => (
              <button
                key={pill}
                onClick={() => handleQuickAction(pill)}
                disabled={isPlaying}
                className="flex-shrink-0 px-3 py-1.5 bg-gray-100 text-text-muted text-xs font-medium rounded-full hover:bg-primary/10 hover:text-primary active:scale-95 transition-all disabled:opacity-40"
              >
                {pill}
              </button>
            )
          )}
        </div>
      </div>

      {/* Chat input */}
      <ChatInput onSend={handleUserInput} disabled={isPlaying} />
    </div>
  )
}
