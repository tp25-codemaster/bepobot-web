// GET /api/gmail-connect?token=<supabase_jwt>
//
// Redirecta korisnika na Google OAuth consent screen.
// Token se šalje kao query param jer browser redirect ne može slati headers.
//
// OAuth state: random 32-byte hex token stored in Redis (TTL 1h).
// In callback, state is looked up in Redis to retrieve the original JWT.
// Falls back to JWT-as-state if Redis is not configured (dev only).

import { randomBytes } from 'node:crypto'
import { getRedisClient } from '../_lib/ratelimit.js'

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
const APP_URL = (process.env.APP_URL || 'https://bepobot-web.vercel.app').replace(/\/$/, '')
const REDIRECT_URI = `${APP_URL}/api/gmail-callback`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(204).end()
    return
  }

  const token = (req.query.token as string) || ''
  if (!token) {
    res.status(400).json({ error: 'Missing token parameter' })
    return
  }

  if (!GOOGLE_CLIENT_ID) {
    res.status(500).json({ error: 'Google OAuth not configured' })
    return
  }

  // Generate a random state token and store the JWT in Redis so the callback
  // can retrieve it. This prevents the JWT from appearing in browser history
  // or server logs as the OAuth state parameter.
  let oauthState: string
  const redisClient = getRedisClient()
  if (redisClient) {
    oauthState = randomBytes(32).toString('hex')
    await redisClient.setex(`oauth:state:${oauthState}`, 3600, token)
  } else {
    // Dev fallback: no Redis configured — state is the JWT itself
    console.warn('[gmail-connect] Redis not configured — using JWT as OAuth state (dev only)')
    oauthState = token
  }

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.readonly email',
    access_type: 'offline',
    prompt: 'consent',
    state: oauthState,
  })

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
}
