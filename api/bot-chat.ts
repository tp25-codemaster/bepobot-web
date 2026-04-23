// POST /api/bot-chat
//
// Main chat endpoint — prima user message, poziva Claude Haiku direktno
// (Anthropic API, prompt caching na system promptu) sa injected reservations
// kontekstom i tool definicijama. Ako LLM odluci pozvati tool, izvrsimo ga
// server-side (user-scoped supabase, RLS enforced) i napravimo drugi LLM call.

import {
  getUserSupabase,
  getCurrentUser,
  getSupabaseAdmin,
} from '../server/supabase.js'
import {
  fetchReservationsForContext,
  fetchPendingReservationsForContext,
  buildSystemPrompt,
  executeCheckInReservation,
  executeConfirmPendingReservation,
  executeRejectPendingReservation,
  executeNotifyCleaner,
  BOT_TOOLS,
} from '../server/bot-tools.js'
import { checkRateLimit, LIMITS } from './_lib/ratelimit.js'
import { setCorsHeaders } from './_lib/cors.js'

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

// Anthropic message types
interface AnthropicContentBlock {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  content?: string
}

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[]
}

interface AnthropicResponse {
  id: string
  content: AnthropicContentBlock[]
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | null
  error?: { message?: string }
}

const MODEL = 'claude-haiku-4-5'
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

async function callAnthropic(payload: Record<string, unknown>): Promise<AnthropicResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const data = (await res.json()) as AnthropicResponse
  if (!res.ok) throw new Error('Anthropic error: ' + (data.error?.message || `HTTP ${res.status}`))
  return data
}

export default async function handler(
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
    // pending_reservations nema user RLS policy pa koristimo admin klijent.
    // Sigurno je jer filtriramo po user.id i server verificira vlasnistvo.
    const adminSupabase = getSupabaseAdmin()
    const [reservations, pending] = await Promise.all([
      fetchReservationsForContext(supabase, user.id),
      fetchPendingReservationsForContext(adminSupabase, user.id),
    ])

    // 2. Build system prompt (cached — 90% cost reduction on repeat calls)
    const fullName = (user.user_metadata?.full_name as string) || null
    const systemPrompt = buildSystemPrompt(reservations, fullName, pending)

    // Convert BOT_TOOLS (OpenAI format) to Anthropic format
    const anthropicTools = BOT_TOOLS.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }))

    // Build conversation history in Anthropic format
    const historyMessages: AnthropicMessage[] = (body.history || [])
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }))

    // 3. First LLM call with tools
    const firstResponse = await callAnthropic({
      model: MODEL,
      max_tokens: 512,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      tools: anthropicTools,
      messages: [...historyMessages, { role: 'user', content: userMessage }],
    })

    if (!firstResponse.content?.length) {
      res.status(502).json({ success: false, error: 'LLM nije vratio odgovor' })
      return
    }

    // No tool use — direct text reply
    const toolUseBlocks = firstResponse.content.filter((b) => b.type === 'tool_use')
    if (toolUseBlocks.length === 0) {
      const text = firstResponse.content.find((b) => b.type === 'text')?.text || ''
      res.status(200).json({ success: true, reply: text, toolsExecuted: [] })
      return
    }

    // 4. Execute tool(s)
    const toolResultContents: AnthropicContentBlock[] = []
    const executedNames: string[] = []

    for (const block of toolUseBlocks) {
      const toolName = block.name!
      const args = (block.input || {}) as Record<string, unknown>
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

      toolResultContents.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result),
      })
    }

    // 5. Second LLM call with tool results for natural-language reply
    const secondResponse = await callAnthropic({
      model: MODEL,
      max_tokens: 512,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      tools: anthropicTools,
      messages: [
        ...historyMessages,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: firstResponse.content },
        { role: 'user', content: toolResultContents },
      ],
    })

    const finalMessage = secondResponse.content.find((b) => b.type === 'text')?.text || ''

    res.status(200).json({
      success: true,
      reply: finalMessage,
      toolsExecuted: executedNames,
    })
  } catch (e) {
    res.status(500).json({
      success: false,
      error: 'Handler crash: ' + (e as Error).message,
    })
  }
}
