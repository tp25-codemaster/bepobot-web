// POST /api/evisitor-disconnect
// Briše spremljene eVisitor kredencijale iz profila trenutnog usera.

import { getUserSupabase, getCurrentUser } from '../../server/supabase.js'
import { setCorsHeaders } from '../_lib/cors.js'

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

  const { error } = await supabase
    .from('profiles')
    .update({
      evisitor_username: null,
      evisitor_password: null,
      evisitor_connected: false,
      evisitor_auto_checkin: false,
    })
    .eq('id', user.id)

  if (error) {
    res.status(500).json({ success: false, error: error.message })
    return
  }

  res.status(200).json({ success: true, message: 'eVisitor odspojen' })
}
