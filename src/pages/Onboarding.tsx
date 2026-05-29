import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  getWelcomeMessages,
  processOnboardingInput,
  type OnboardingState,
} from '../lib/onboarding'

interface Msg {
  role: 'bot' | 'user'
  text: string
}

export function Onboarding() {
  const { user, profile, updateProfile } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [state, setState] = useState<OnboardingState>({ step: 'welcome' })
  const [done, setDone] = useState(false)
  const [actionButton, setActionButton] = useState<{ label: string; href: string } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Kick off welcome messages
  useEffect(() => {
    const welcome = getWelcomeMessages()
    let delay = 300
    welcome.forEach((msg, i) => {
      setTimeout(() => {
        setMessages((prev) => [...prev, { role: 'bot', text: msg }])
        if (i === welcome.length - 1) {
          setState((s) => ({ ...s, step: 'ask_name' }))
        }
      }, delay)
      delay += 600
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    if (!done) inputRef.current?.focus()
  }, [messages, done])

  async function handleSend() {
    const text = input.trim()
    if (!text || done) return
    setInput('')

    setMessages((prev) => [...prev, { role: 'user', text }])
    setActionButton(null)

    const result = processOnboardingInput(text, state)
    setState(result.state)

    // Side effects
    if (result.action === 'save_name' && result.actionData && user) {
      await supabase.from('profiles').update({
        full_name: result.actionData.fullName,
      }).eq('id', user.id)
    }

    if (result.action === 'save_apartment' && result.actionData && user) {
      await supabase.from('apartments').insert({
        user_id: user.id,
        name: result.actionData.name,
        wifi_password: result.actionData.wifi || null,
      })
    }

    if (result.action === 'save_cleaner' && result.actionData && user) {
      const contact = result.actionData.contact || ''
      const isEmail = contact.includes('@')
      await supabase.from('contacts').insert({
        user_id: user.id,
        name: result.actionData.name,
        role: 'cleaner',
        email: isEmail ? contact : null,
        phone: !isEmail ? contact : null,
      })
    }

    if (result.action === 'open_gmail') {
      setActionButton({ label: '📧 Poveži Gmail', href: '/api/gmail-connect' })
    }

    if (result.action === 'open_evisitor') {
      setActionButton({ label: '🏛️ Otvori eVisitor postavke', href: '/app/evisitor' })
    }

    if (result.action === 'complete_onboarding' && user) {
      await updateProfile({ onboarding_complete: true })
      setDone(true)
    }

    // Show bot replies with slight delay between each
    let delay = 400
    result.botMessages.forEach((msg) => {
      setTimeout(() => {
        setMessages((prev) => [...prev, { role: 'bot', text: msg }])
      }, delay)
      delay += 500
    })

    // Navigate after onboarding completes
    if (result.nextStep === 'complete') {
      setTimeout(() => navigate('/app'), delay + 1500)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // If Gmail OAuth just returned, auto-advance
  useEffect(() => {
    if (profile?.gmail_connected && state.step === 'ask_gmail') {
      const result = processOnboardingInput('gotovo', state)
      setState(result.state)
      result.botMessages.forEach((msg, i) => {
        setTimeout(() => {
          setMessages((prev) => [...prev, { role: 'bot', text: msg }])
        }, i * 500)
      })
    }
  }, [profile?.gmail_connected])

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-sm font-bold">B</span>
        </div>
        <div>
          <p className="font-semibold text-gray-800 text-sm leading-tight">BepoBot</p>
          <p className="text-xs text-green-500 leading-tight">Postavljanje računa</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'bot' && (
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                <span className="text-white text-xs font-bold">B</span>
              </div>
            )}
            <div
              className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-white text-gray-800 shadow-sm rounded-bl-sm border border-gray-100'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {actionButton && (
          <div className="flex justify-start pl-9">
            <a
              href={actionButton.href}
              className="inline-block px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {actionButton.label}
            </a>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!done && (
        <div className="px-4 py-3 bg-white border-t border-gray-100">
          <div className="flex gap-2 items-center">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Odgovori ovdje..."
              className="flex-1 px-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-2">Preskoci → upiši "preskoci"</p>
        </div>
      )}
    </div>
  )
}
