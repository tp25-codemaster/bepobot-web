// POST /api/refresh-gmail-token
// Refreshes the Gmail access token for a user using their stored refresh token.
// Called by ensureValidGmailToken() in src/lib/gmailToken.ts when token is >50min old.

import { getSupabaseAdmin } from './_lib/supabase.js'

interface VercelRequest {
  method?: string
  body: { user_id?: string }
}
interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (data: unknown) => void
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { user_id } = req.body ?? {}
  if (!user_id) {
    return res.status(400).json({ error: 'user_id required' })
  }

  const supabase = getSupabaseAdmin()

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('gmail_refresh_token')
    .eq('id', user_id)
    .single()

  if (profileError || !profile?.gmail_refresh_token) {
    return res.status(404).json({ error: 'No refresh token found for user' })
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Google OAuth credentials not configured' })
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: profile.gmail_refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    console.error('Google token refresh failed:', err)
    return res.status(502).json({ error: 'Failed to refresh token with Google' })
  }

  const { access_token } = await tokenRes.json() as { access_token: string }

  await supabase
    .from('profiles')
    .update({ gmail_access_token: access_token, updated_at: new Date().toISOString() })
    .eq('id', user_id)

  return res.status(200).json({ access_token })
}
