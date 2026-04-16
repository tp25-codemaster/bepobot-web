// POST /api/evisitor-connect
//
// Validira eVisitor kredencijale pokušajem Logina i sprema ih u
// profiles tablicu trenutnog usera (password enkriptiran AES-256-GCM).

import { validateCredentials } from '../server/evisitor.js'
import { encrypt } from '../server/crypto.js'
import { getUserSupabase, getCurrentUser } from '../server/supabase.js'
import { setCorsHeaders } from './_lib/cors.js'

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

  let payload: { username?: string; password?: string }
  try {
    payload =
      typeof req.body === 'string' ? JSON.parse(req.body) : (req.body as object)
  } catch (e) {
    res.status(400).json({
      success: false,
      error: 'Invalid JSON body: ' + (e as Error).message,
    })
    return
  }

  const username = (payload.username || '').trim()
  const password = (payload.password || '').trim()
  if (!username || !password) {
    res.status(400).json({
      success: false,
      error: 'Unesite korisničko ime i lozinku',
    })
    return
  }

  // 1. Validate against real eVisitor
  const check = await validateCredentials({ username, password })
  if (!check.ok) {
    res.status(400).json({
      success: false,
      error: check.error,
    })
    return
  }

  // 2. Encrypt and save
  let encryptedPassword: string
  try {
    encryptedPassword = encrypt(password)
  } catch (e) {
    res.status(500).json({
      success: false,
      error: 'Enkripcija nije uspjela: ' + (e as Error).message,
    })
    return
  }

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({
      evisitor_username: username,
      evisitor_password: encryptedPassword,
      evisitor_connected: true,
    })
    .eq('id', user.id)

  if (updateErr) {
    res.status(500).json({
      success: false,
      error: 'Ne mogu spremiti u profil: ' + updateErr.message,
    })
    return
  }

  res.status(200).json({
    success: true,
    message: 'eVisitor uspješno povezan',
    username,
  })
}
