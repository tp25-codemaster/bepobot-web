import { supabase, isDemoMode } from './supabase'

const WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://tonkopuljiz.app.n8n.cloud/webhook'

export interface ChatMessage {
  id: string
  user_id: string
  role: 'user' | 'bot'
  content: string
  type: 'text' | 'card' | 'quick_actions'
  metadata: Record<string, unknown> | null
  created_at: string
}

interface WebhookResponse {
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
    .order('created_at', { ascending: true })
    .limit(limit)

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

// Send message to n8n webhook and get response
export async function sendToWebhook(
  userId: string,
  message: string,
): Promise<WebhookResponse> {
  try {
    const res = await fetch(`${WEBHOOK_URL}/bepobot-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        message,
        timestamp: new Date().toISOString(),
      }),
    })

    if (!res.ok) throw new Error(`Webhook error: ${res.status}`)

    const data = await res.json()
    return data as WebhookResponse
  } catch (err) {
    console.error('Webhook failed:', err)
    return {
      type: 'text',
      content: 'Ups, nešto je pošlo krivo. Pokušajte ponovo za trenutak.',
    }
  }
}
