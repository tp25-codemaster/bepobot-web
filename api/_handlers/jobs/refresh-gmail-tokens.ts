// GET /api/jobs/refresh-gmail-tokens
//
// Vercel cron job — refresha Gmail access tokene koji ističu unutar 10 minuta.
// Schedule: 0 */8 * * * (svakih 8 sati)
//
// Auth: Vercel automatski šalje Authorization: Bearer $CRON_SECRET

import { getSupabaseAdmin } from '../../../server/supabase.js'
import { encrypt, safeDecrypt } from '../../../server/crypto.js'

interface VercelRequest {
  method?: string
  headers: { [key: string]: string | string[] | undefined }
}
interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (data: unknown) => void
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim() || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim() || ''

async function refreshUserToken(
  userId: string,
  encryptedRefreshToken: string | null
): Promise<'ok' | 'revoked' | 'error'> {
  if (!encryptedRefreshToken) return 'error'
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured — skipping refresh')
    return 'error'
  }
  try {
    const refreshToken = safeDecrypt(encryptedRefreshToken)
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    const tokens = await tokenRes.json() as {
      access_token?: string
      expires_in?: number
      error?: string
    }

    const admin = getSupabaseAdmin()

    if (!tokens.access_token) {
      // Refresh token revoked — disconnect user
      await admin.from('profiles').update({
        gmail_connected: false,
        gmail_access_token: null,
        gmail_refresh_token: null,
        gmail_token_expires_at: null,
      }).eq('id', userId)
      return 'revoked'
    }

    const expiresAt = new Date(
      Date.now() + (tokens.expires_in || 3600) * 1000
    ).toISOString()

    await admin.from('profiles').update({
      gmail_access_token: encrypt(tokens.access_token),
      gmail_token_expires_at: expiresAt,
    }).eq('id', userId)

    return 'ok'
  } catch {
    return 'error'
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // Vercel cron protection
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('CRON_SECRET not configured')
    res.status(500).json({ error: 'Server misconfiguration' })
    return
  }
  const authHeader = (req.headers.authorization ||
    req.headers.Authorization) as string | undefined
  if (authHeader !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const admin = getSupabaseAdmin()

  // Dohvati sve usere kojima token ističe unutar 10 minuta
  const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  const { data: users, error } = await admin
    .from('profiles')
    .select('id, gmail_refresh_token')
    .eq('gmail_connected', true)
    .not('gmail_refresh_token', 'is', null)
    .lt('gmail_token_expires_at', tenMinutesFromNow)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  const results = {
    total: users?.length || 0,
    refreshed: 0,
    revoked: 0,
    errors: 0,
  }

  for (const user of users || []) {
    const outcome = await refreshUserToken(user.id, user.gmail_refresh_token as string | null)
    if (outcome === 'ok') results.refreshed++
    else if (outcome === 'revoked') results.revoked++
    else results.errors++
  }

  res.status(200).json({ success: true, ...results })
}
