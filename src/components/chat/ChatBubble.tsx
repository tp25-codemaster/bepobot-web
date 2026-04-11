interface ChatBubbleProps {
  role: 'user' | 'bot'
  children: React.ReactNode
  animate?: boolean
}

export default function ChatBubble({ role, children, animate = false }: ChatBubbleProps) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${animate ? 'animate-slide-up' : ''}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary flex-shrink-0 flex items-center justify-center mr-2 mt-1">
          <span className="text-white text-xs font-bold">B</span>
        </div>
      )}
      <div
        className={`max-w-[80%] px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-primary text-white rounded-2xl rounded-br-md'
            : 'bg-gray-100 text-text rounded-2xl rounded-bl-md'
        }`}
      >
        {children}
      </div>
    </div>
  )
}
