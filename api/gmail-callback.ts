// GET /api/gmail-callback?code=<auth_code>&state=<oauth_state>
//
// Google redirecta ovdje nakon OAuth consent.
// State se validira iz Redisa (gdje gmail-connect sprema JWT s TTL 1h).
// Exchange code za tokene, spremi u Supabase profiles.

import { getUserSupabase, getCurrentUser } from '../server/supabase.js'
import { encrypt } from '../server/crypto.js'
import { getRedisClient } from './_lib/ratelimit.js'

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

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const APP_URL = (process.env.APP_URL || 'https://bepobot-web.vercel.app').replace(/\/$/, '')
const REDIRECT_URI = `${APP_URL}/api/gmail-callback`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = req.query.code as string
  const state = req.query.state as string // This is the Supabase JWT
  const error = req.query.error as string

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    res.redirect('/app/postavke?gmail=error&reason=oauth_not_configured')
    return
  }

  if (error) {
    res.redirect('/app/postavke?gmail=error&reason=' + encodeURIComponent(error))
    return
  }

  if (!code || !state) {
    res.redirect('/app/postavke?gmail=error&reason=missing_params')
    return
  }

  // Resolve JWT from OAuth state: look up in Redis (set by gmail-connect with TTL 1h).
  // GETDEL is atomic — consumes the state so it can't be replayed.
  // Falls back to treating state as JWT directly if Redis is not configured (dev only).
  let jwtToken: string
  const redisClient = getRedisClient()
  if (redisClient) {
    const stored = await redisClient.getdel(`oauth:state:${state}`) as string | null
    if (!stored) {
      res.redirect('/app/postavke?gmail=error&reason=invalid_state')
      return
    }
    jwtToken = stored
  } else {
    jwtToken = state
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

  // Get user from JWT
  const supabase = getUserSupabase(`Bearer ${jwtToken}`)
  if (!supabase) {
    res.redirect('/app/postavke?gmail=error&reason=auth')
    return
  }

  const user = await getCurrentUser(supabase)
  if (!user) {
    res.redirect('/app/postavke?gmail=error&reason=auth')
    return
  }

  // Save tokens to profiles table (encrypted at rest)
  const { error: dbError } = await supabase
    .from('profiles')
    .update({
      gmail_access_token: encrypt(tokens.access_token),
      gmail_refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      gmail_connected: true,
      gmail_email: gmailEmail,
    })
    .eq('id', user.id)

  if (dbError) {
    console.error('DB update error:', dbError)
    res.redirect('/app/postavke?gmail=error&reason=db')
    return
  }

  // Auto-register Gmail watch for Push Notifications (Phase 3)
  // Fire-and-forget: if it fails, user can retry manually from settings
  try {
    await fetch(`${APP_URL}/api/gmail-watch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
    })
  } catch (err) {
    console.error('Failed to register Gmail watch:', err)
  }

  res.redirect('/app/postavke?gmail=connected')
}
