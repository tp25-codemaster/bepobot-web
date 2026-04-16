// Shared Upstash QStash helper for background job processing.
//
// Usage (enqueue):
//   import { enqueueJob } from './_lib/qstash.js'
//   const jobId = await enqueueJob('evisitor_import', userId, { apartmentId })
//
// Usage (worker):
//   import { verifyQStash } from './_lib/qstash.js'
//   const valid = await verifyQStash(req)
//   if (!valid) return res.status(401).json(...)
//
// QStash is serverless — no Redis instance needed. Free tier: 500 msgs/day.

import { Client, Receiver } from '@upstash/qstash'
import { getSupabaseAdmin } from '../../server/supabase.js'

const QSTASH_TOKEN = (process.env.QSTASH_TOKEN || '').trim()
const QSTASH_CURRENT_SIGNING_KEY = (process.env.QSTASH_CURRENT_SIGNING_KEY || '').trim()
const QSTASH_NEXT_SIGNING_KEY = (process.env.QSTASH_NEXT_SIGNING_KEY || '').trim()
const APP_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'https://bepobot-web.vercel.app'

let client: Client | null = null
let receiver: Receiver | null = null

function getClient(): Client {
  if (!client) {
    if (!QSTASH_TOKEN) throw new Error('QSTASH_TOKEN not set')
    client = new Client({ token: QSTASH_TOKEN })
  }
  return client
}

function getReceiver(): Receiver {
  if (!receiver) {
    if (!QSTASH_CURRENT_SIGNING_KEY) throw new Error('QSTASH_CURRENT_SIGNING_KEY not set')
    receiver = new Receiver({
      currentSigningKey: QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: QSTASH_NEXT_SIGNING_KEY,
    })
  }
  return receiver
}

export type JobType =
  | 'evisitor_import'
  | 'evisitor_find_contacts'
  | 'evisitor_checkin'
  | 'email_process'

/**
 * Enqueue a background job. Creates a DB row and sends to QStash which
 * will POST to /api/jobs/{type}-worker with the job ID in the body.
 */
export async function enqueueJob(
  type: JobType,
  userId: string,
  payload: Record<string, unknown> = {},
): Promise<string> {
  const supabase = getSupabaseAdmin()

  // 1. Create job row in DB
  const { data: job, error } = await supabase
    .from('background_jobs')
    .insert({
      user_id: userId,
      type,
      status: 'pending',
      payload,
    })
    .select()
    .single()

  if (error || !job) {
    throw new Error(`Failed to create job row: ${error?.message}`)
  }

  // 2. Send to QStash
  const workerUrl = `${APP_URL}/api/jobs/${type.replace(/_/g, '-')}-worker`
  try {
    await getClient().publishJSON({
      url: workerUrl,
      body: { jobId: job.id },
      retries: 3,
    })
  } catch (err) {
    // Mark job as failed so user sees it
    await supabase
      .from('background_jobs')
      .update({ status: 'failed', error: 'QStash publish failed' })
      .eq('id', job.id)
    throw err
  }

  return job.id
}

/**
 * Verify that incoming request is signed by QStash.
 * Call this at the start of every worker endpoint.
 */
export async function verifyQStash(req: {
  headers: { [key: string]: string | string[] | undefined }
  body: unknown
}): Promise<boolean> {
  if (!QSTASH_CURRENT_SIGNING_KEY) {
    throw new Error('QSTASH_CURRENT_SIGNING_KEY not configured — worker endpoint requires QStash signing')
  }
  const signature = (req.headers['upstash-signature'] || req.headers['Upstash-Signature']) as string | undefined
  if (!signature) return false

  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
  try {
    return await getReceiver().verify({
      signature,
      body,
    })
  } catch {
    return false
  }
}

/**
 * Update job status/progress from within a worker.
 */
export async function updateJob(
  jobId: string,
  updates: {
    status?: 'running' | 'completed' | 'failed'
    progress?: number
    total?: number
    processed?: number
    message?: string
    error?: string
    result?: Record<string, unknown>
  },
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const patch: Record<string, unknown> = { ...updates }
  if (updates.status === 'running' && !('started_at' in patch)) {
    patch.started_at = new Date().toISOString()
  }
  if (updates.status === 'completed' || updates.status === 'failed') {
    patch.completed_at = new Date().toISOString()
  }
  await supabase.from('background_jobs').update(patch).eq('id', jobId)
}

/**
 * Get the job + payload for a worker to process.
 */
export async function getJob(jobId: string): Promise<{
  id: string
  user_id: string
  type: JobType
  payload: Record<string, unknown>
  status: string
} | null> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('background_jobs')
    .select('id, user_id, type, payload, status')
    .eq('id', jobId)
    .single()
  return data as {
    id: string
    user_id: string
    type: JobType
    payload: Record<string, unknown>
    status: string
  } | null
}
