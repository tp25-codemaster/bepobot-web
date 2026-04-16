// POST /api/gmail-disconnect
//
// Odspaja Gmail — briše tokene iz profiles.

import { getUserSupabase, getCurrentUser } from '../server/supabase.js'

interface VercelRequest {
  method?: string
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const authHeader = (req.headers.authorization || req.headers.Authorization) as string | undefined
  const supabase = getUserSupabase(authHeader)
  if (!supabase) { res.status(401).json({ error: 'Unauthorized' }); return }

  const user = await getCurrentUser(supabase)
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return }

  const { error } = await supabase
    .from('profiles')
    .update({
      gmail_access_token: null,
      gmail_refresh_token: null,
      gmail_connected: false,
      gmail_email: null,
    })
    .eq('id', user.id)

  if (error) {
    res.status(500).json({ error: 'Failed to disconnect' })
    return
  }

  res.status(200).json({ success: true })
}
