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
          className={`inline-block px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap ${
            isUser
              ? 'bg-primary text-white rounded-2xl rounded-br-md'
              : 'bg-gray-100 text-text rounded-2xl rounded-bl-md'
          }`}
        >
          {children}
        </div>
        {time && (
          <span className="text-[10px] text-gray-400 mt-1 px-1">{time}</span>
        )}
      </div>
    </div>
  )
}
