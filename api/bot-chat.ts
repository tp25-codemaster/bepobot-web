// POST /api/bot-chat
//
// Main chat endpoint — prima user message, poziva Claude Haiku preko OpenRoutera
// sa injected reservations kontekstom i tool definicijama. Ako LLM odluci pozvati
// tool, izvrsimo ga server-side (user-scoped supabase, RLS enforced) i napravimo
// drugi LLM call da dobijemo natural-language rezultat za korisnika.

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
  BOT_TOOLS,
} from '../server/bot-tools.js'
import { checkRateLimit, LIMITS } from './_lib/ratelimit.js'

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

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
}

interface OpenRouterResponse {
  choices?: Array<{
    message: OpenRouterMessage
    finish_reason?: string
  }>
  error?: { message?: string }
}

const MODEL = 'anthropic/claude-haiku-4.5'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

async function callOpenRouter(
  payload: Record<string, unknown>
): Promise<OpenRouterResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured')
  }
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://bepobot-web-bepo1.vercel.app',
      'X-Title': 'BepoBot',
    },
    body: JSON.stringify(payload),
  })
  const data = (await res.json()) as OpenRouterResponse
  if (!res.ok) {
    throw new Error(
      'OpenRouter error: ' + (data.error?.message || `HTTP ${res.status}`)
    )
  }
  return data
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

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

    // 2. Build system prompt
    const fullName = (user.user_metadata?.full_name as string) || null
    const systemPrompt = buildSystemPrompt(reservations, fullName, pending)

    // 3. First LLM call with tools
    const baseMessages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      ...(body.history || []).slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ]

    const firstResponse = await callOpenRouter({
      model: MODEL,
      messages: baseMessages,
      tools: BOT_TOOLS,
      max_tokens: 512,
      temperature: 0.3,
    })

    const choice = firstResponse.choices?.[0]
    if (!choice) {
      res
        .status(502)
        .json({ success: false, error: 'LLM nije vratio odgovor' })
      return
    }

    const toolCalls = choice.message.tool_calls || []

    // No tool call — direct text reply
    if (toolCalls.length === 0) {
      res.status(200).json({
        success: true,
        reply: choice.message.content || '',
        toolsExecuted: [],
      })
      return
    }

    // 4. Execute tool(s)
    const toolResults: Array<{
      tool_call_id: string
      name: string
      result: unknown
    }> = []
    for (const call of toolCalls) {
      let args: Record<string, unknown> = {}
      try {
        args =
          typeof call.function.arguments === 'string'
            ? JSON.parse(call.function.arguments)
            : (call.function.arguments as Record<string, unknown>)
      } catch {
        /* ignore */
      }

      if (call.function.name === 'check_in_reservation') {
        const reservationId = args.reservation_id as string | undefined
        if (!reservationId) {
          toolResults.push({
            tool_call_id: call.id,
            name: call.function.name,
            result: { success: false, error: 'reservation_id missing' },
          })
          continue
        }
        const result = await executeCheckInReservation(
          supabase,
          user.id,
          reservationId,
          args.test_mode === true
        )
        toolResults.push({
          tool_call_id: call.id,
          name: call.function.name,
          result,
        })
      } else if (call.function.name === 'confirm_pending_reservation') {
        const pendingId = args.pending_id as string | undefined
        if (!pendingId) {
          toolResults.push({
            tool_call_id: call.id,
            name: call.function.name,
            result: { success: false, error: 'pending_id missing' },
          })
          continue
        }
        const result = await executeConfirmPendingReservation(
          adminSupabase,
          user.id,
          pendingId
        )
        toolResults.push({
          tool_call_id: call.id,
          name: call.function.name,
          result,
        })
      } else if (call.function.name === 'reject_pending_reservation') {
        const pendingId = args.pending_id as string | undefined
        if (!pendingId) {
          toolResults.push({
            tool_call_id: call.id,
            name: call.function.name,
            result: { success: false, error: 'pending_id missing' },
          })
          continue
        }
        const result = await executeRejectPendingReservation(
          adminSupabase,
          user.id,
          pendingId
        )
        toolResults.push({
          tool_call_id: call.id,
          name: call.function.name,
          result,
        })
      } else {
        toolResults.push({
          tool_call_id: call.id,
          name: call.function.name,
          result: { success: false, error: 'Unknown tool' },
        })
      }
    }

    // 5. Second LLM call with tool results for natural-language reply
    const messagesWithResults: OpenRouterMessage[] = [
      ...baseMessages,
      {
        role: 'assistant',
        content: choice.message.content,
        tool_calls: choice.message.tool_calls,
      },
      ...toolResults.map((tr) => ({
        role: 'tool' as const,
        content: JSON.stringify(tr.result),
        tool_call_id: tr.tool_call_id,
      })),
    ]

    const secondResponse = await callOpenRouter({
      model: MODEL,
      messages: messagesWithResults,
      max_tokens: 512,
      temperature: 0.3,
    })

    const finalMessage = secondResponse.choices?.[0]?.message.content || ''

    res.status(200).json({
      success: true,
      reply: finalMessage,
      toolsExecuted: toolResults.map((tr) => tr.name),
    })
  } catch (e) {
    res.status(500).json({
      success: false,
      error: 'Handler crash: ' + (e as Error).message,
    })
  }
}
