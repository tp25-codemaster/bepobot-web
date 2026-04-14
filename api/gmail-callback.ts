// GET /api/gmail-callback?code=<auth_code>&state=<jwt>
//
// Google redirecta ovdje nakon OAuth consent.
// Exchange code za tokene, spremi u Supabase profiles.

import { getUserSupabase, getCurrentUser } from '../server/supabase.js'

interface VercelRequest {
  method?: string
  query: { [key: string]: string | string[] | undefined }
  headers: { [key: string]: string | string[] | undefined }
}
interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (data: unknown) => void
  setHeader: (name: string, value: string) => void
  redirect: (url: string) => void
  end: () => void
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const REDIRECT_URI = 'https://bepobot-web.vercel.app/api/gmail-callback'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = req.query.code as string
  const state = req.query.state as string // This is the Supabase JWT
  const error = req.query.error as string

  if (error) {
    res.redirect('/app/postavke?gmail=error&reason=' + encodeURIComponent(error))
    return
  }

  if (!code || !state) {
    res.redirect('/app/postavke?gmail=error&reason=missing_params')
    return
  }

  // Exchange code for tokens
  let tokens: { access_token: string; refresh_token?: string }
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })
    tokens = await tokenRes.json() as { access_token: string; refresh_token?: string }

    if (!tokens.access_token) {
      console.error('Token exchange failed:', tokens)
      res.redirect('/app/postavke?gmail=error&reason=token_exchange')
      return
    }
  } catch (err) {
    console.error('Token exchange error:', err)
    res.redirect('/app/postavke?gmail=error&reason=token_exchange')
    return
  }

  // Get Gmail email address from userinfo
  let gmailEmail = ''
  try {
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const info = await infoRes.json() as { email?: string }
    gmailEmail = info.email || ''
  } catch {
    // Not critical, continue without email
  }

  // Get user from JWT (state parameter)
  const supabase = getUserSupabase(`Bearer ${state}`)
  if (!supabase) {
    res.redirect('/app/postavke?gmail=error&reason=auth')
    return
  }

  const user = await getCurrentUser(supabase)
  if (!user) {
    res.redirect('/app/postavke?gmail=error&reason=auth')
    return
  }

  // Save tokens to profiles table
  const { error: dbError } = await supabase
    .from('profiles')
    .update({
      gmail_access_token: tokens.access_token,
      gmail_refresh_token: tokens.refresh_token || null,
      gmail_connected: true,
      gmail_email: gmailEmail,
    })
    .eq('id', user.id)

  if (dbError) {
    console.error('DB update error:', dbError)
    res.redirect('/app/postavke?gmail=error&reason=db')
    return
  }

  res.redirect('/app/postavke?gmail=connected')
}
