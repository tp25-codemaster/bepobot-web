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
    <div className={`flex justify-start items-end gap-2 ${animate ? 'animate-slide-up' : ''}`}>
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/75 flex-shrink-0 flex items-center justify-center shadow-sm ring-2 ring-white mb-1">
        <span className="text-white text-xs font-bold">B</span>
      </div>
      <div className="max-w-[85%] bg-white border border-gray-100 rounded-2xl rounded-bl-sm shadow-sm overflow-hidden">
        <div className="px-3.5 py-2.5 text-sm font-semibold text-primary border-b border-gray-50">
          {title}
        </div>
        <div className="divide-y divide-gray-50">
          {fields.map((field, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3.5 py-2 text-xs"
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
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg ring-4 ring-primary/10">
          <span className="text-white text-2xl font-bold">B</span>
        </div>
        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-white shadow-sm" />
      </div>
      <p className="text-text font-semibold text-base mb-1">BepoBot</p>
      <p className="text-text-muted text-sm mb-6">Kako mogu pomoći danas?</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {WELCOME_SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="px-3.5 py-2 bg-gray-50 text-text-muted border border-border/60 text-sm rounded-full hover:bg-primary/5 hover:text-primary hover:border-primary/30 active:scale-95 transition-all"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
