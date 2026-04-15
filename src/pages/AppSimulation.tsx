import { useState, useEffect, useRef, useCallback, type TouchEvent as ReactTouchEvent} from 'react'
import ChatBubble from '../components/chat/ChatBubble'
import ChatCard from '../components/chat/ChatCard'
import QuickActions from '../components/chat/QuickActions'
import TypingIndicator from '../components/chat/TypingIndicator'
import ChatInput from '../components/chat/ChatInput'
import SideMenu from '../components/app/SideMenu'
import ErrorBanner from '../components/app/ErrorBanner'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { renderMarkdown } from '../lib/markdown'
import { useChat, type DisplayMessage } from '../hooks/useChat'
import {
  SCENARIOS,
  matchScenario,
  getFallbackMessages,
  type ScenarioMessage,
} from '../lib/chatScenarios'
import {
  getWelcomeMessages,
  processOnboardingInput,
  type OnboardingState,
} from '../lib/onboarding'
import { useSwipeMenu } from '../hooks/useSwipeMenu'

export default function AppSimulation() {
  const {
    messages, setMessages,
    sending, sendMessage,
    addBotMessage, addUserMessage, clearMessages, reloadMessages,
    isDemo, historyLoaded,
    lastError, retryLastMessage, dismissError,
  } = useChat()

  const [showTyping, setShowTyping] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeScenario, setActiveScenario] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  useSwipeMenu({ onOpen: () => setMenuOpen(true), onClose: () => setMenuOpen(false), isOpen: menuOpen })
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const chatRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const hasStartedOnboarding = useRef(false)

  const { user, profile } = useAuth()
  const needsOnboarding = isDemo || !profile?.onboarding_complete

  const clearTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }, [])

  // Auto-scroll
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages, showTyping, sending])

  // Start onboarding on mount if needed and no history
  useEffect(() => {
    if (hasStartedOnboarding.current) return
    // Wait for history to load before deciding
    if (!isDemo && !historyLoaded) return
    if (needsOnboarding && messages.length === 0) {
      hasStartedOnboarding.current = true
      const welcomeMsgs = getWelcomeMessages()
      setOnboarding({ step: 'ask_name' })
      playBotTexts(welcomeMsgs)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyLoaded])

  // Play multiple bot text messages with typing animation
  function playBotTexts(texts: string[]) {
    setIsPlaying(true)
    let delay = 0

    texts.forEach((text) => {
      const typingT = setTimeout(() => setShowTyping(true), delay)
      timeoutsRef.current.push(typingT)
      delay += 600 + Math.min(text.length * 8, 800)

      const msgT = setTimeout(() => {
        setShowTyping(false)
        addBotMessage(text)
      }, delay)
      timeoutsRef.current.push(msgT)
      delay += 200
    })

    const endT = setTimeout(() => setIsPlaying(false), delay)
    timeoutsRef.current.push(endT)
  }

  // Play scripted scenario messages (demo mode)
  const playScenarioMessages = useCallback(
    (scenarioMessages: ScenarioMessage[], startWithUserMessage?: string) => {
      clearTimeouts()
      setIsPlaying(true)
      setShowTyping(false)

      if (startWithUserMessage) {
        addUserMessage(startWithUserMessage)
      }

      let cumulativeDelay = startWithUserMessage ? 600 : 0

      scenarioMessages.forEach((msg) => {
        if (msg.type === 'user' && !startWithUserMessage) {
          const t = setTimeout(() => {
            addUserMessage(msg.content || '')
          }, cumulativeDelay)
          timeoutsRef.current.push(t)
          cumulativeDelay += msg.delayMs
        } else if (msg.type === 'user' && startWithUserMessage) {
          return
        } else {
          const typingT = setTimeout(() => setShowTyping(true), cumulativeDelay)
          timeoutsRef.current.push(typingT)
          cumulativeDelay += 800

          const msgT = setTimeout(() => {
            setShowTyping(false)
            setMessages((prev: DisplayMessage[]) => [
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
    [clearTimeouts, addUserMessage, setMessages]
  )

  const handleScenarioSelect = (scenarioId: string) => {
    setOnboarding(null)
    setActiveScenario(scenarioId)
    const scenario = SCENARIOS.find((s) => s.id === scenarioId)
    if (!scenario) return
    clearMessages()
    playScenarioMessages(scenario.messages)
  }

  const handleUserInput = (text: string) => {
    // Onboarding mode
    if (onboarding && onboarding.step !== 'complete') {
      addUserMessage(text)
      const result = processOnboardingInput(text, onboarding)
      setOnboarding(result.state)
      playBotTexts(result.botMessages)

      // Handle onboarding actions
      if (result.action === 'save_name' && result.actionData && user) {
        supabase.from('profiles').update({ full_name: result.actionData.fullName }).eq('id', user.id)
      }
      if (result.action === 'save_apartment' && result.actionData && user) {
        supabase.from('apartments').insert({
          user_id: user.id,
          name: result.actionData.name,
          wifi_password: result.actionData.wifi,
        })
      }
      if (result.action === 'save_cleaner' && result.actionData && user) {
        const contact = result.actionData.contact || ''
        const isEmail = contact.includes('@')
        supabase.from('contacts').insert({
          user_id: user.id,
          name: result.actionData.name,
          role: 'cleaner',
          email: isEmail ? contact : null,
          phone: !isEmail ? contact : null,
        })
      }
      if (result.action === 'complete_onboarding' && user) {
        supabase.from('profiles').update({ onboarding_complete: true }).eq('id', user.id)
      }

      if (result.nextStep === 'complete') {
        setTimeout(() => setOnboarding(null), 3000)
      }
      return
    }

    // If in demo mode, use scripted scenarios
    if (isDemo) {
      const matched = matchScenario(text)
      if (matched) {
        setActiveScenario(matched.id)
        const botMessages = matched.messages.filter((m) => m.type !== 'user')
        playScenarioMessages(botMessages, text)
      } else {
        playScenarioMessages(getFallbackMessages(), text)
      }
      return
    }

    // Real mode: send to n8n webhook
    setShowTyping(true)
    sendMessage(text).then(() => setShowTyping(false))
  }

  const handleQuickAction = (action: string) => {
    const cleaned = action.replace(/^[^\w\s]*\s*/, '')
    handleUserInput(cleaned)
  }

  const isOnboarding = onboarding && onboarding.step !== 'complete'

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Header */}
      <div className="bg-primary flex-shrink-0 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen(true)}
              className="w-8 h-8 flex items-center justify-center text-white"
              aria-label="Otvori meni"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-sm font-bold">B</span>
            </div>
            <div>
              <div className="text-white font-semibold text-sm">BepoBot</div>
              <div className="text-primary-light text-[10px]">online</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isDemo && (
              <span className="px-2 py-0.5 bg-white/10 text-white/60 text-[10px] font-medium rounded-full border border-white/10">
                DEMO
              </span>
            )}
            <a href="/app" className="text-white/60 text-sm hover:text-white transition-colors">
              ← Natrag
            </a>
          </div>
        </div>

        {/* Scenario tabs — only in demo, hide during onboarding */}
        {isDemo && !isOnboarding && (
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
        )}
      </div>

      {/* Chat area */}
      <div
        ref={chatRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 relative"
        onTouchStart={(e: ReactTouchEvent) => {
          touchStartY.current = e.touches[0].clientY
        }}
        onTouchMove={(e: ReactTouchEvent) => {
          if (!chatRef.current || chatRef.current.scrollTop > 0) return
          const dy = e.touches[0].clientY - touchStartY.current
          if (dy > 0 && dy < 120) setPullDistance(dy)
        }}
        onTouchEnd={() => {
          if (pullDistance > 60 && !refreshing) {
            setRefreshing(true)
            setPullDistance(60)
            reloadMessages().finally(() => {
              setRefreshing(false)
              setPullDistance(0)
            })
          } else {
            setPullDistance(0)
          }
        }}
      >
        {/* Pull to refresh indicator */}
        {pullDistance > 0 && (
          <div
            className="absolute top-0 left-0 right-0 flex justify-center transition-transform"
            style={{ transform: `translateY(${Math.min(pullDistance, 60) - 40}px)` }}
          >
            <div className={`w-6 h-6 border-2 border-primary border-t-transparent rounded-full ${refreshing ? 'animate-spin' : ''}`} />
          </div>
        )}
        {messages.map((msg, i) => {
          if (msg.type === 'user') {
            return (
              <ChatBubble key={msg.id || i} role="user" animate timestamp={msg.timestamp}>
                {msg.content}
              </ChatBubble>
            )
          }
          if (msg.type === 'bot-card' && msg.card) {
            return (
              <ChatCard
                key={msg.id || i}
                title={msg.card.title}
                fields={msg.card.fields}
                animate
              />
            )
          }
          if (msg.type === 'bot-actions' && msg.actions) {
            return (
              <QuickActions
                key={msg.id || i}
                actions={msg.actions}
                onAction={handleQuickAction}
              />
            )
          }
          return (
            <ChatBubble key={msg.id || i} role="bot" animate timestamp={msg.timestamp}>
              {renderMarkdown(msg.content || '')}
            </ChatBubble>
          )
        })}

        {(showTyping || sending) && <TypingIndicator />}
      </div>

      {/* Quick action bar — hide during onboarding */}
      {!isOnboarding && (
        <div className="flex-shrink-0 px-3 py-2 bg-white border-t border-border overflow-x-auto no-scrollbar">
          <div className="flex gap-2">
            {['📅 Raspored', '📋 Nova rezervacija', '🧹 Ciscenje', '🔑 Check-in', '🏛️ eVisitor', '📣 Kampanja'].map(
              (pill) => (
                <button
                  key={pill}
                  onClick={() => handleQuickAction(pill)}
                  disabled={isPlaying || sending}
                  className="flex-shrink-0 px-3 py-1.5 bg-gray-100 text-text-muted text-xs font-medium rounded-full hover:bg-primary/10 hover:text-primary active:scale-95 transition-all disabled:opacity-40"
                >
                  {pill}
                </button>
              )
            )}
          </div>
        </div>
      )}

      {lastError && (
        <div className="flex-shrink-0 px-3 pb-2">
          <ErrorBanner
            message={lastError}
            onRetry={retryLastMessage}
            onDismiss={dismissError}
          />
        </div>
      )}

      <ChatInput onSend={handleUserInput} disabled={isPlaying || sending} />
    </div>
  )
}
