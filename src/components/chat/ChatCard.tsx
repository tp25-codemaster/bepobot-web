import { useState, useEffect } from 'react'

interface CardField {
  icon: string
  label: string
  value: string
}

interface ChatCardProps {
  title: string
  fields: CardField[]
  animate?: boolean
}

export default function ChatCard({ title, fields, animate = false }: ChatCardProps) {
  return (
    <div className={`flex justify-start ${animate ? 'animate-slide-up' : ''}`}>
      <div className="w-7 h-7 rounded-full bg-primary flex-shrink-0 flex items-center justify-center mr-2 mt-1">
        <span className="text-white text-xs font-bold">B</span>
      </div>
      <div className="max-w-[85%] bg-gray-100 rounded-2xl rounded-bl-md overflow-hidden">
        <div className="px-3.5 py-2 text-sm font-medium text-primary">
          {title}
        </div>
        <div className="bg-white mx-2 mb-2 rounded-xl border border-border">
          {fields.map((field, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 px-3 py-2 text-xs ${
                i < fields.length - 1 ? 'border-b border-border/50' : ''
              }`}
            >
              <span>{field.icon}</span>
              <span className="text-text-muted">{field.label}</span>
              <span className="ml-auto font-medium text-text">{field.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface ScrollToBottomFABProps {
  scrollRef: { current: HTMLDivElement | null }
  threshold?: number
}

export function ScrollToBottomFAB({ scrollRef, threshold = 100 }: ScrollToBottomFABProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const check = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      setVisible(distFromBottom > threshold)
    }

    check()
    el.addEventListener('scroll', check, { passive: true })
    return () => el.removeEventListener('scroll', check)
  }, [scrollRef, threshold])

  if (!visible) return null

  return (
    <button
      onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })}
      className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-white border border-border shadow-md flex items-center justify-center text-text-muted hover:text-primary hover:border-primary/40 hover:shadow-lg transition-all"
      aria-label="Skrolaj do dna"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14" />
        <path d="M5 12l7 7 7-7" />
      </svg>
    </button>
  )
}

const WELCOME_SUGGESTIONS = [
  'Koje rezervacije dolaze ovaj tjedan?',
  'Tko mi dolazi sutra?',
  'Pokaži slobodne apartmane',
]

interface WelcomeCardProps {
  onSuggestion: (text: string) => void
}

export function WelcomeCard({ onSuggestion }: WelcomeCardProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center mb-4 shadow-md">
        <span className="text-white text-xl font-bold">B</span>
      </div>
      <p className="text-text font-medium text-base mb-6">Pozdrav! Kako mogu pomoći?</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {WELCOME_SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="px-3.5 py-2 bg-primary/10 text-primary text-sm rounded-full hover:bg-primary/20 active:scale-95 transition-all"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
