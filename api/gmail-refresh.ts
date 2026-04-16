// POST /api/gmail-refresh
//
// Refresha Gmail access token koristeći refresh_token.
// Poziva se iz n8n workflowa kad access_token istekne.

import { getSupabaseAdmin } from '../server/supabase.js'

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

const GOOGLE_CLIENT_ID = '590860880888-aq0jlqq7en5klatohs37ec7acuj0t2se.apps.googleusercontent.com'
const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET || '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').trim()
const API_SECRET = (process.env.EMAIL_API_SECRET || '').trim()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const { user_id, secret } = req.body as { user_id?: string; secret?: string }
  if (!API_SECRET || secret !== API_SECRET) {
    res.status(401).json({ error: 'Unauthorized' }); return
  }
  if (!user_id) {
    res.status(400).json({ error: 'Missing user_id' }); return
  }

  const supabase = getSupabaseAdmin()

  // Get user's refresh token
  const { data: profile } = await supabase
    .from('profiles')
    .select('gmail_refresh_token')
    .eq('id', user_id)
    .single()

  if (!profile?.gmail_refresh_token) {
    res.status(400).json({ error: 'No refresh token' }); return
  }

  // Exchange refresh token for new access token
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: profile.gmail_refresh_token,
        grant_type: 'refresh_token',
      }),
    })
    const tokens = await tokenRes.json() as { access_token?: string; error?: string }

    if (!tokens.access_token) {
      // Refresh token revoked — disconnect Gmail
      await supabase.from('profiles').update({
        gmail_connected: false,
        gmail_access_token: null,
        gmail_refresh_token: null,
      }).eq('id', user_id)
      res.status(400).json({ error: 'Token revoked', details: tokens.error }); return
    }

    // Save new access token
    await supabase.from('profiles').update({
      gmail_access_token: tokens.access_token,
    }).eq('id', user_id)

    res.status(200).json({ success: true, access_token: tokens.access_token })
  } catch (err) {
    res.status(500).json({ error: 'Refresh failed' })
  }
}
