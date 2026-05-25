// POST /api/bot-chat
//
// Main chat endpoint — prima user message, poziva Kimi K2.5 via OpenRouter
// (OpenAI-compatible API) sa injected reservations kontekstom i tool definicijama.
// Ako LLM odluci pozvati tool, izvrsimo ga server-side (user-scoped supabase,
// RLS enforced) i napravimo drugi LLM call.

import {
  getUserSupabase,
  getCurrentUser,
  getSupabaseAdmin,
} from '../../server/supabase.js'
import {
  fetchReservationsForContext,
  fetchPendingReservationsForContext,
  buildSystemPrompt,
  executeCheckInReservation,
  executeConfirmPendingReservation,
  executeRejectPendingReservation,
  executeNotifyCleaner,
  BOT_TOOLS,
} from '../../server/bot-tools.js'
import { checkRateLimit, LIMITS } from '../_lib/ratelimit.js'
import { setCorsHeaders } from '../_lib/cors.js'
import { withSentry, captureError, setSentryUser } from '../_lib/sentry.js'

interface VercelRequest {
  method?: string
  body: unknown
  headers: { [key: string]: string | string[] | undefined }
}
interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (data: unknown) => void
  setHeader: (name: string, value: string) => void
  end: () => void
}

// OpenAI-compatible types (OpenRouter)
interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

interface OAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

interface OAIResponse {
  choices: Array<{
    message: {
      role: 'assistant'
      content: string | null
      tool_calls?: ToolCall[]
    }
    finish_reason: string
  }>
  error?: { message?: string }
}

const MODEL = 'moonshotai/kimi-k2'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

async function callOpenRouter(messages: OAIMessage[], tools?: unknown[]): Promise<OAIResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured')
  const body: Record<string, unknown> = {
    model: MODEL,
    max_tokens: 512,
    messages,
  }
  if (tools?.length) body.tools = tools
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.APP_URL || 'https://bepobot-web.vercel.app',
      'X-Title': 'BepoBot',
    },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as OAIResponse
  if (!res.ok) throw new Error('OpenRouter error: ' + (data.error?.message || `HTTP ${res.status}`))
  return data
}

async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  // JWT auth via Supabase
  const authHeader = (req.headers.authorization ||
    req.headers.Authorization) as string | undefined
  const supabase = getUserSupabase(authHeader)
  if (!supabase) {
    res.status(401).json({ success: false, error: 'Missing Authorization' })
    return
  }
  const user = await getCurrentUser(supabase)
  if (!user) {
    res.status(401).json({ success: false, error: 'Invalid session' })
    return
  }
  setSentryUser(user.id)

  // Rate limit: 30 msgs/min per user
  const rl = await checkRateLimit('bot-chat', user.id, LIMITS.BOT_CHAT)
  if (!rl.allowed) {
    res.setHeader('X-RateLimit-Remaining', String(rl.remaining))
    res.setHeader('X-RateLimit-Reset', String(rl.reset))
    res.status(429).json({
      success: false,
      error: 'Previše poruka u kratkom vremenu. Pokušajte za minutu.',
    })
    return
  }

  // Parse body
  let body: {
    message?: string
    history?: Array<{ role: 'user' | 'assistant'; content: string }>
  }
  try {
    body =
      typeof req.body === 'string' ? JSON.parse(req.body) : (req.body as object)
  } catch (e) {
    res.status(400).json({
      success: false,
      error: 'Invalid JSON: ' + (e as Error).message,
    })
    return
  }

  const userMessage = body.message?.trim()
  if (!userMessage) {
    res.status(400).json({ success: false, error: 'message je obavezan' })
    return
  }

  try {
    // 1. Fetch reservations (user-scoped, RLS) + pending (admin, RLS-bypass)
    const adminSupabase = getSupabaseAdmin()
    const [reservations, pending] = await Promise.all([
      fetchReservationsForContext(supabase, user.id),
      fetchPendingReservationsForContext(adminSupabase, user.id),
    ])

    // 2. Build system prompt + conversation messages (OpenAI format)
    const fullName = (user.user_metadata?.full_name as string) || null
    const systemPrompt = buildSystemPrompt(reservations, fullName, pending)

    const historyMessages: OAIMessage[] = (body.history || [])
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }))

    const messages: OAIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: userMessage },
    ]

    // 3. First LLM call with tools
    const firstResponse = await callOpenRouter(messages, BOT_TOOLS)

    const firstChoice = firstResponse.choices?.[0]
    if (!firstChoice) {
      res.status(502).json({ success: false, error: 'LLM nije vratio odgovor' })
      return
    }

    // No tool use — direct text reply
    const toolCalls = firstChoice.message.tool_calls || []
    if (toolCalls.length === 0) {
      res.status(200).json({
        success: true,
        reply: firstChoice.message.content || '',
        toolsExecuted: [],
      })
      return
    }

    // 4. Execute tool(s)
    const executedNames: string[] = []
    const toolResultMessages: OAIMessage[] = []

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(toolCall.function.arguments)
      } catch {
        // ignore parse error, args stays empty
      }
      executedNames.push(toolName)

      let result: unknown
      if (toolName === 'check_in_reservation') {
        const reservationId = args.reservation_id as string | undefined
        if (!reservationId) {
          result = { success: false, error: 'reservation_id missing' }
        } else {
          result = await executeCheckInReservation(supabase, user.id, reservationId, args.test_mode === true)
        }
      } else if (toolName === 'confirm_pending_reservation') {
        const pendingId = args.pending_id as string | undefined
        if (!pendingId) {
          result = { success: false, error: 'pending_id missing' }
        } else {
          result = await executeConfirmPendingReservation(adminSupabase, user.id, pendingId)
        }
      } else if (toolName === 'reject_pending_reservation') {
        const pendingId = args.pending_id as string | undefined
        if (!pendingId) {
          result = { success: false, error: 'pending_id missing' }
        } else {
          result = await executeRejectPendingReservation(adminSupabase, user.id, pendingId)
        }
      } else if (toolName === 'notify_cleaner') {
        const reservationId = args.reservation_id as string | undefined
        if (!reservationId) {
          result = { success: false, error: 'reservation_id missing' }
        } else {
          result = await executeNotifyCleaner(supabase, user.id, reservationId)
        }
      } else {
        result = { success: false, error: 'Unknown tool' }
      }

      toolResultMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      })
    }

    // 5. Second LLM call with tool results for natural-language reply
    const secondResponse = await callOpenRouter([
      ...messages,
      { role: 'assistant', content: firstChoice.message.content, tool_calls: toolCalls },
      ...toolResultMessages,
    ], BOT_TOOLS)

    const finalMessage = secondResponse.choices?.[0]?.message?.content || ''

    res.status(200).json({
      success: true,
      reply: finalMessage,
      toolsExecuted: executedNames,
    })
  } catch (e) {
    captureError(e)
    res.status(500).json({
      success: false,
      error: 'Handler crash: ' + (e as Error).message,
    })
  }
}

export default withSentry(handler)
