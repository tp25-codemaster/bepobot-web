import { supabase, isDemoMode } from './supabase'
import { apiPost } from './apiClient'

export interface ChatMessage {
  id: string
  user_id: string
  role: 'user' | 'bot'
  content: string
  type: 'text' | 'card' | 'quick_actions'
  metadata: Record<string, unknown> | null
  created_at: string
}

interface BotChatResponse {
  success: boolean
  reply?: string
  toolsExecuted?: string[]
  error?: string
}

export interface WebhookResponse {
  type?: 'text' | 'card' | 'quick_actions'
  content?: string
  actions?: string[]
  card?: {
    title: string
    fields: { icon: string; label: string; value: string }[]
  }
}

// Load last N messages from Supabase
export async function loadMessages(userId: string, limit = 50): Promise<ChatMessage[]> {
  if (isDemoMode) return []

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  // Reverse to get chronological order (oldest first)
  if (data) data.reverse()

  if (error) {
    console.error('Failed to load messages:', error)
    return []
  }
  return data as ChatMessage[]
}

// Save message to Supabase
export async function saveMessage(
  userId: string,
  role: 'user' | 'bot',
  content: string,
  type: 'text' | 'card' | 'quick_actions' = 'text',
  metadata: Record<string, unknown> | null = null,
): Promise<ChatMessage | null> {
  if (isDemoMode) return null

  const { data, error } = await supabase
    .from('messages')
    .insert({ user_id: userId, role, content, type, metadata })
    .select()
    .single()

  if (error) {
    console.error('Failed to save message:', error)
    return null
  }
  return data as ChatMessage
}

/**
 * Send message to /api/bot-chat (Vercel serverless, authed by Supabase JWT).
 * Returns a WebhookResponse-shaped object so existing useChat consumer keeps working.
 */
export async function sendToWebhook(
  _userId: string,
  message: string,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<WebhookResponse> {
  try {
    const res = await apiPost<BotChatResponse>('/api/bot-chat', {
      message,
      history,
    })
    if (!res.ok || !res.data?.success) {
      return {
        type: 'text',
        content:
          res.data?.error ||
          res.error ||
          'Ups, bot trenutno ne odgovara. Pokušaj za trenutak.',
      }
    }
    return {
      type: 'text',
      content: res.data.reply || '(prazan odgovor)',
    }
  } catch (err) {
    console.error('bot-chat failed:', err)
    return {
      type: 'text',
      content: 'Ups, nešto je pošlo krivo. Pokušajte ponovo za trenutak.',
    }
  }
}
