// GET /api/jobs/status?id=<jobId>
//
// Client polls this to check progress of a background job.
// Returns: status, progress (0-100), total, processed, message, error, result

import { getUserSupabase, getCurrentUser } from '../../../server/supabase.js'

interface VercelRequest {
  method?: string
  query: { [key: string]: string | string[] | undefined }
  headers: { [key: string]: string | string[] | undefined }
}
interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (data: unknown) => void
  setHeader: (name: string, value: string) => void
  end: () => void
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }

  const authHeader = (req.headers.authorization || req.headers.Authorization) as string | undefined
  const supabase = getUserSupabase(authHeader)
  if (!supabase) { res.status(401).json({ error: 'Unauthorized' }); return }
  const user = await getCurrentUser(supabase)
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return }

  const id = req.query.id as string
  if (!id) {
    res.status(400).json({ error: 'Missing id param' })
    return
  }

  const { data, error } = await supabase
    .from('background_jobs')
    .select('id, type, status, progress, total, processed, message, error, result, created_at, started_at, completed_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !data) {
    res.status(404).json({ error: 'Job not found' })
    return
  }

  res.status(200).json({ success: true, job: data })
}
