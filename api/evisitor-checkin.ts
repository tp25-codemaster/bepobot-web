// Vercel serverless function: POST /api/evisitor-checkin
//
// Multi-tenant verzija:
// 1. Čita JWT iz Authorization headera → identificira usera
// 2. Dohvaća njegove eVisitor kredencijale iz profiles tablice (dekriptira)
// 3. Pokreće Login → CheckIn → Logout flow s tim kredencijalima
// 4. Upisuje rezultat u evisitor_log za audit trail

import {
  runEVisitorCheckIn,
  type GuestCheckInInput,
} from '../server/evisitor.js'
import { decrypt } from '../server/crypto.js'
import { getUserSupabase, getCurrentUser } from '../server/supabase.js'
import { setCorsHeaders } from './_lib/cors.js'
import { withSentry, captureError, setSentryUser } from './_lib/sentry.js'

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

async function handler(
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

  // 1. Authenticate
  const authHeader = (req.headers.authorization ||
    req.headers.Authorization) as string | undefined
  const supabase = getUserSupabase(authHeader)
  if (!supabase) {
    res
      .status(401)
      .json({ success: false, error: 'Missing or invalid Authorization' })
    return
  }
  const user = await getCurrentUser(supabase)
  if (!user) {
    res
      .status(401)
      .json({ success: false, error: 'Invalid or expired session' })
    return
  }
  setSentryUser(user.id)

  // 2. Parse input
  let input: GuestCheckInInput
  try {
    input =
      typeof req.body === 'string'
        ? (JSON.parse(req.body) as GuestCheckInInput)
        : (req.body as GuestCheckInInput)
  } catch (e) {
    res.status(400).json({
      success: false,
      error: 'Invalid JSON body: ' + (e as Error).message,
    })
    return
  }

  // 3. Fetch user's eVisitor credentials from profile
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('evisitor_username, evisitor_password, evisitor_connected')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile) {
    captureError(profileErr || new Error('profile not found'), { userId: user.id })
    res.status(500).json({
      success: false,
      error: 'Ne mogu dohvatiti profil: ' + (profileErr?.message || 'unknown'),
    })
    return
  }
  if (
    !profile.evisitor_connected ||
    !profile.evisitor_username ||
    !profile.evisitor_password
  ) {
    res.status(400).json({
      success: false,
      error:
        'eVisitor nije povezan. Otvorite postavke i unesite vaše kredencijale.',
    })
    return
  }

  // 4. Decrypt password
  let password: string
  try {
    password = decrypt(profile.evisitor_password)
  } catch (e) {
    captureError(e, { userId: user.id, context: 'evisitor_decrypt' })
    res.status(500).json({
      success: false,
      error:
        'Ne mogu dekriptirati spremljene kredencijale. Ponovno se povežite.',
      detail: (e as Error).message,
    })
    return
  }

  // 5. Run eVisitor flow
  let result
  try {
    result = await runEVisitorCheckIn(input, {
      username: profile.evisitor_username,
      password,
    })
  } catch (e) {
    captureError(e, { userId: user.id, context: 'evisitor_checkin' })
    res.status(500).json({
      success: false,
      error: 'Handler crash: ' + (e as Error).message,
    })
    return
  }

  // 6. Audit log (best effort, ne diraj response ako insert padne)
  if (!input._testMode) {
    try {
      await supabase.from('evisitor_log').insert({
        user_id: user.id,
        action: 'checkin',
        guest_name: (result.touristName || 'nepoznat').trim() || 'nepoznat',
        apartment_name: result.facility || '-',
        evisitor_id: result.touristId || null,
        status: result.success ? 'success' : 'error',
        error_message: result.success ? null : result.checkinError || null,
      })
    } catch {
      /* swallow — audit shouldn't break primary flow */
    }
  }

  res.status(result.success ? 200 : 502).json(result)
}

export default withSentry(handler)
