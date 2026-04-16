import { useState, useCallback } from 'react'

interface ChatBubbleProps {
  role: 'user' | 'bot'
  children: React.ReactNode
  animate?: boolean
  timestamp?: string
  copyText?: string
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
  copyText,
}: ChatBubbleProps) {
  const isUser = role === 'user'
  const time = formatTime(timestamp)
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    if (!copyText) return
    navigator.clipboard.writeText(copyText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [copyText])

  return (
    <div
      className={`group flex w-full items-end gap-2 ${
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
        <div className="flex items-end gap-1.5">
          <div
            className={`inline-block px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap ${
              isUser
                ? 'bg-primary text-white rounded-2xl rounded-br-md'
                : 'bg-gray-100 text-text rounded-2xl rounded-bl-md'
            }`}
          >
            {children}
          </div>

          {!isUser && copyText && (
            <button
              onClick={handleCopy}
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-200 text-gray-400 hover:text-gray-600 mb-1"
              aria-label="Kopiraj poruku"
            >
              {copied ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          )}
        </div>

        {time && (
          <span className="text-[10px] text-gray-400 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {time}
          </span>
        )}
      </div>
    </div>
  )
}
