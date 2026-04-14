import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { isDemoMode } from '../lib/supabase'
import {
  loadMessages,
  saveMessage,
  sendToWebhook,
  type ChatMessage,
} from '../lib/chatApi'

export interface DisplayMessage {
  id?: string
  type: 'user' | 'bot-text' | 'bot-card' | 'bot-actions'
  content?: string
  timestamp?: string
  card?: {
    title: string
    fields: { icon: string; label: string; value: string }[]
  }
  actions?: string[]
}

function chatToDisplay(msg: ChatMessage): DisplayMessage {
  const metadata = msg.metadata as Record<string, unknown> | null
  const timestamp = msg.created_at

  if (msg.role === 'user') {
    return { id: msg.id, type: 'user', content: msg.content, timestamp }
  }
  if (msg.type === 'card' && metadata?.card) {
    return {
      id: msg.id,
      type: 'bot-card',
      card: metadata.card as DisplayMessage['card'],
      timestamp,
    }
  }
  if (msg.type === 'quick_actions' && metadata?.actions) {
    return {
      id: msg.id,
      type: 'bot-actions',
      actions: metadata.actions as string[],
      timestamp,
    }
  }
  return { id: msg.id, type: 'bot-text', content: msg.content, timestamp }
}

export function useChat() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const hasLoaded = useRef(false)

  // Load history from Supabase on mount
  useEffect(() => {
    if (isDemoMode || !user || hasLoaded.current) return
    hasLoaded.current = true

    setLoading(true)
    loadMessages(user.id).then((history) => {
      if (history.length > 0) {
        setMessages(history.map(chatToDisplay))
      }
      setHistoryLoaded(true)
      setLoading(false)
    })
  }, [user])

  // Send user message → save → webhook → save bot response
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return

      const userId = user?.id || 'demo'

      // Add user message to UI immediately
      const userMsg: DisplayMessage = { type: 'user', content: text, timestamp: new Date().toISOString() }
      setMessages((prev) => [...prev, userMsg])

      // Save user message
      if (!isDemoMode && user) {
        saveMessage(user.id, 'user', text)
      }

      // Call webhook
      setSending(true)
      const response = await sendToWebhook(userId, text)
      setSending(false)

      // Parse response into display messages
      const botMessages: DisplayMessage[] = []
      const now = new Date().toISOString()

      if (response.type === 'card' && response.card) {
        botMessages.push({ type: 'bot-card', card: response.card, timestamp: now })
        if (!isDemoMode && user) {
          saveMessage(user.id, 'bot', response.card.title, 'card', {
            card: response.card,
          })
        }
      } else if (response.type === 'quick_actions' && response.actions) {
        botMessages.push({ type: 'bot-actions', actions: response.actions, timestamp: now })
        if (!isDemoMode && user) {
          saveMessage(user.id, 'bot', response.actions.join(', '), 'quick_actions', {
            actions: response.actions,
          })
        }
      } else if (response.content) {
        botMessages.push({ type: 'bot-text', content: response.content, timestamp: now })
        if (!isDemoMode && user) {
          saveMessage(user.id, 'bot', response.content)
        }
      }

      // If webhook also returned actions alongside text
      if (response.type !== 'quick_actions' && response.actions?.length) {
        botMessages.push({ type: 'bot-actions', actions: response.actions })
      }

      setMessages((prev) => [...prev, ...botMessages])
    },
    [user],
  )

  // Add bot messages manually (for onboarding)
  const addBotMessage = useCallback((content: string) => {
    setMessages((prev) => [...prev, { type: 'bot-text', content }])
  }, [])

  // Add user message to display only (no webhook)
  const addUserMessage = useCallback((content: string) => {
    setMessages((prev) => [...prev, { type: 'user', content }])
  }, [])

  // Reload messages from Supabase
  const reloadMessages = useCallback(async () => {
    if (isDemoMode || !user) return
    const history = await loadMessages(user.id)
    if (history.length > 0) {
      setMessages(history.map(chatToDisplay))
    }
  }, [user])

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  return {
    messages,
    setMessages,
    loading,
    sending,
    historyLoaded,
    sendMessage,
    addBotMessage,
    addUserMessage,
    clearMessages,
    reloadMessages,
    isDemo: isDemoMode,
  }
}
