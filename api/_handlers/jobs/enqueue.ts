// POST /api/jobs/enqueue
//
// Generic enqueue endpoint. Client specifies job type + payload.
// Returns job ID which can be polled via GET /api/jobs/:id
//
// Auth: Supabase JWT

import { getUserSupabase, getCurrentUser } from '../../../server/supabase.js'
import { enqueueJob, type JobType } from '../../_lib/qstash.js'

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

const ALLOWED_TYPES: JobType[] = [
  'evisitor_import',
  'evisitor_find_contacts',
  'evisitor_checkin',
]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const authHeader = (req.headers.authorization || req.headers.Authorization) as string | undefined
  const supabase = getUserSupabase(authHeader)
  if (!supabase) { res.status(401).json({ error: 'Unauthorized' }); return }
  const user = await getCurrentUser(supabase)
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return }

  const { type, payload } = (req.body || {}) as { type?: JobType; payload?: Record<string, unknown> }
  if (!type || !ALLOWED_TYPES.includes(type)) {
    res.status(400).json({ error: 'Invalid job type' })
    return
  }

  try {
    const jobId = await enqueueJob(type, user.id, payload || {})
    res.status(202).json({ success: true, jobId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: 'Failed to enqueue', details: msg })
  }
}
