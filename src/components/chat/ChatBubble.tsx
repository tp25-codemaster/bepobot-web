import { useState, useRef } from 'react'

interface ChatBubbleProps {
  role: 'user' | 'bot'
  children: React.ReactNode
  animate?: boolean
  timestamp?: string
}

function formatTime(ts?: string): string | null {
  if (!ts) return null
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })
}

export default function ChatBubble({
  role,
  children,
  animate = false,
  timestamp,
}: ChatBubbleProps) {
  const isUser = role === 'user'
  const time = formatTime(timestamp)
  const [copied, setCopied] = useState(false)
  const bubbleRef = useRef<HTMLDivElement>(null)

  const handleCopy = () => {
    const text = bubbleRef.current?.textContent || ''
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      className={`flex w-full items-end gap-2 ${
        isUser ? 'justify-end' : 'justify-start'
      } ${animate ? 'animate-slide-up' : ''}`}
    >
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary flex-shrink-0 flex items-center justify-center self-end mb-1">
          <span className="text-white text-xs font-bold">B</span>
        </div>
      )}

      <div
        className={`flex flex-col min-w-0 max-w-[80%] ${
          isUser ? 'items-end' : 'items-start'
        }`}
      >
        <div
          ref={bubbleRef}
          className={`group relative inline-block px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap ${
            isUser
              ? 'bg-primary text-white rounded-2xl rounded-br-md'
              : 'bg-gray-100 text-text rounded-2xl rounded-bl-md'
          }`}
        >
          {children}
          {!isUser && (
            <button
              onClick={handleCopy}
              title="Kopiraj"
              className="absolute -top-2 -right-2 w-6 h-6 rounded-md bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 hover:text-primary hover:border-primary/40 transition-all opacity-0 group-hover:opacity-100"
            >
              {copied ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20,6 9,17 4,12" />
                </svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          )}
        </div>
        {time && (
          <span className="text-[10px] text-gray-400 mt-1 px-1">{time}</span>
        )}
      </div>
    </div>
  )
}
