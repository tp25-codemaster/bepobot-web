// POST /api/bot-chat
//
// Anthropic API direktno (claude-haiku-4-5) s prompt cachingom na system promptu.
// Zamjena za OpenRouter — ušteduje 5% markup + eliminira extra network hop.
// Tool-calling flow je jednak, format poruka prilagođen Anthropic API-ju.

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

// Anthropic content block types
interface TextBlock {
  type: 'text'
  text: string
}
interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}
interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
}
type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}
interface AnthropicResponse {
  content: ContentBlock[]
  stop_reason: 'end_turn' | 'tool_use' | string
  error?: { type: string; message: string }
}

// BOT_TOOLS is OpenAI format — convert to Anthropic format (input_schema not parameters)
function toAnthropicTools(tools: Array<{
  type: string
  function: { name: string; description: string; parameters: Record<string, unknown> }
}>): Array<{ name: string; description: string; input_schema: Record<string, unknown> }> {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }))
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
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const data = (await res.json()) as AnthropicResponse
  if (!res.ok) {
    throw new Error('Anthropic error: ' + (data.error?.message || `HTTP ${res.status}`))
  }
  return data
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

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
    const adminSupabase = getSupabaseAdmin()
    const [reservations, pending] = await Promise.all([
      fetchReservationsForContext(supabase, user.id),
      fetchPendingReservationsForContext(adminSupabase, user.id),
    ])

    const fullName = (user.user_metadata?.full_name as string) || null
    const systemPrompt = buildSystemPrompt(reservations, fullName, pending)
    const anthropicTools = toAnthropicTools(
      BOT_TOOLS as Array<{ type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }>
    )

    // Build message history for this conversation
    const messages: AnthropicMessage[] = [
      ...(body.history || []).slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user' as const, content: userMessage },
    ]

    // First call — with tools, system prompt cached after first request
    const firstResponse = await callAnthropic({
      model: MODEL,
      max_tokens: 512,
      temperature: 0.3,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages,
      tools: anthropicTools,
    })

    const toolUseBlocks = firstResponse.content.filter(
      (c): c is ToolUseBlock => c.type === 'tool_use'
    )

    // No tool call — return text directly
    if (firstResponse.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
      const textBlock = firstResponse.content.find((c): c is TextBlock => c.type === 'text')
      res.status(200).json({
        success: true,
        reply: textBlock?.text || '',
        toolsExecuted: [],
      })
      return
    }

    // Execute tools
    const toolResults: Array<{ toolUseId: string; name: string; result: unknown }> = []
    for (const call of toolUseBlocks) {
      const args = call.input || {}

      if (call.name === 'check_in_reservation') {
        const reservationId = args.reservation_id as string | undefined
        if (!reservationId) {
          toolResults.push({
            toolUseId: call.id,
            name: call.name,
            result: { success: false, error: 'reservation_id missing' },
          })
          continue
        }
        const result = await executeCheckInReservation(
          supabase, user.id, reservationId, args.test_mode === true
        )
        toolResults.push({ toolUseId: call.id, name: call.name, result })
      } else if (call.name === 'confirm_pending_reservation') {
        const pendingId = args.pending_id as string | undefined
        if (!pendingId) {
          toolResults.push({
            toolUseId: call.id,
            name: call.name,
            result: { success: false, error: 'pending_id missing' },
          })
          continue
        }
        const result = await executeConfirmPendingReservation(adminSupabase, user.id, pendingId)
        toolResults.push({ toolUseId: call.id, name: call.name, result })
      } else if (call.name === 'reject_pending_reservation') {
        const pendingId = args.pending_id as string | undefined
        if (!pendingId) {
          toolResults.push({
            toolUseId: call.id,
            name: call.name,
            result: { success: false, error: 'pending_id missing' },
          })
          continue
        }
        const result = await executeRejectPendingReservation(adminSupabase, user.id, pendingId)
        toolResults.push({ toolUseId: call.id, name: call.name, result })
      } else {
        toolResults.push({
          toolUseId: call.id,
          name: call.name,
          result: { success: false, error: 'Unknown tool' },
        })
      }
    }

    // Second call — assistant turn with tool_use blocks + user turn with tool_results
    const messagesWithResults: AnthropicMessage[] = [
      ...messages,
      { role: 'assistant', content: firstResponse.content },
      {
        role: 'user',
        content: toolResults.map((tr) => ({
          type: 'tool_result' as const,
          tool_use_id: tr.toolUseId,
          content: JSON.stringify(tr.result),
        })),
      },
    ]

    const secondResponse = await callAnthropic({
      model: MODEL,
      max_tokens: 512,
      temperature: 0.3,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: messagesWithResults,
    })

    const finalText = secondResponse.content.find((c): c is TextBlock => c.type === 'text')

    res.status(200).json({
      success: true,
      reply: finalText?.text || '',
      toolsExecuted: toolResults.map((tr) => tr.name),
    })
  } catch (e) {
    res.status(500).json({
      success: false,
      error: 'Handler crash: ' + (e as Error).message,
    })
  }
}
