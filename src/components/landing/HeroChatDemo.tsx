import { useState, useEffect, useRef, useCallback } from 'react'
import PhoneFrame from '../ui/PhoneFrame'
import ChatBubble from '../chat/ChatBubble'
import ChatCard from '../chat/ChatCard'
import TypingIndicator from '../chat/TypingIndicator'

interface DemoMessage {
  type: 'user' | 'bot-text' | 'bot-card'
  content?: string
  card?: {
    title: string
    fields: { icon: string; label: string; value: string }[]
  }
  delay: number
}

const DEMO_MESSAGES: DemoMessage[] = [
  {
    type: 'user',
    content: 'Sutra dolaze Markovići u apartman 2, 4 gosta, odlaze u nedjelju',
    delay: 800,
  },
  {
    type: 'bot-card',
    card: {
      title: '✅ Rezervacija upisana!',
      fields: [
        { icon: '🏠', label: 'Apartman', value: 'Apartman 2' },
        { icon: '👥', label: 'Gosti', value: 'Marković (4)' },
        { icon: '📅', label: 'Termin', value: '20.06 → 25.06' },
        { icon: '🧹', label: 'Čišćenje', value: '20.06 8:00' },
      ],
    },
    delay: 1500,
  },
  {
    type: 'user',
    content: 'Pošalji im check-in info',
    delay: 2000,
  },
  {
    type: 'bot-text',
    content: '✅ Poslano! Gosti su dobili:\n📶 WiFi: ApartNet / pass1234\n🅿️ Parking: mjesta 3 i 4\n📋 Check-out: do 10h',
    delay: 1400,
  },
]

export default function HeroChatDemo() {
  const [visibleMessages, setVisibleMessages] = useState<DemoMessage[]>([])
  const [showTyping, setShowTyping] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }, [])

  const runDemo = useCallback(() => {
    clearTimeouts()
    setVisibleMessages([])
    setShowTyping(false)

    let cumulativeDelay = 1000

    DEMO_MESSAGES.forEach((msg) => {
      // Show typing indicator before bot messages
      if (msg.type !== 'user') {
        const typingTimeout = setTimeout(() => setShowTyping(true), cumulativeDelay)
        timeoutsRef.current.push(typingTimeout)
        cumulativeDelay += 800
      }

      const msgTimeout = setTimeout(() => {
        setShowTyping(false)
        setVisibleMessages((prev) => [...prev, msg])
      }, cumulativeDelay)
      timeoutsRef.current.push(msgTimeout)

      cumulativeDelay += msg.delay
    })

    // Loop after all messages
    const loopTimeout = setTimeout(() => runDemo(), cumulativeDelay + 3000)
    timeoutsRef.current.push(loopTimeout)
  }, [clearTimeouts])

  useEffect(() => {
    runDemo()
    return clearTimeouts
  }, [runDemo, clearTimeouts])

  // Auto-scroll
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [visibleMessages, showTyping])

  return (
    <PhoneFrame>
      <div ref={chatRef} className="h-full overflow-y-auto p-3 space-y-3 no-scrollbar">
        {visibleMessages.map((msg, i) => {
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
    </PhoneFrame>
  )
}
