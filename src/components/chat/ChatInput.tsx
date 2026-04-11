import { useState, useRef } from 'react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export default function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    inputRef.current?.focus()
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-white border-t border-border">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        placeholder="Napišite poruku..."
        disabled={disabled}
        className="flex-1 px-4 py-3 bg-gray-50 rounded-full text-sm text-text placeholder:text-text-muted/50 outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
          value.trim() && !disabled
            ? 'bg-primary text-white hover:bg-primary/90 active:scale-95'
            : 'bg-gray-100 text-text-muted/40'
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 2L11 13" />
          <path d="M22 2L15 22L11 13L2 9L22 2Z" />
        </svg>
      </button>
    </div>
  )
}
