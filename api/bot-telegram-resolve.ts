// POST /api/bot-telegram-resolve
//
// Bot zove ovo na svaku Telegram poruku. Dvije funkcije:
//
// 1. Mapping lookup: "Tko je ovaj Telegram user_id?" → vraća BepoBot user_id ako postoji
// 2. Pairing: "Ovaj user je poslao /start <code>" → nalazi profile po kodu, pairsa,
//    sprema telegram_user_id, briše kod i expire, vraća BepoBot user_id
//
// Auth: BOT_BEARER_TOKEN (isti shared secret kao ostali bot endpointi).

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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  const expected = process.env.BOT_BEARER_TOKEN
  if (!expected) {
    res
      .status(500)
      .json({ success: false, error: 'BOT_BEARER_TOKEN not configured' })
    return
  }
  const authHeader = (req.headers.authorization ||
    req.headers.Authorization) as string | undefined
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
  if (!token || token !== expected) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return
  }

  let payload: {
    telegram_user_id?: number | string
    pairing_code?: string
  }
  try {
    payload =
      typeof req.body === 'string' ? JSON.parse(req.body) : (req.body as object)
  } catch (e) {
    res.status(400).json({
      success: false,
      error: 'Invalid JSON: ' + (e as Error).message,
    })
    return
  }

  const telegramId =
    typeof payload.telegram_user_id === 'string'
      ? parseInt(payload.telegram_user_id, 10)
      : payload.telegram_user_id
  if (!telegramId || Number.isNaN(telegramId)) {
    res
      .status(400)
      .json({ success: false, error: 'telegram_user_id obavezan' })
    return
  }

  const pairingCode = payload.pairing_code?.trim().toUpperCase()

  const admin = getSupabaseAdmin()

  // Pairing flow: korisnik je poslao /start <code>
  if (pairingCode) {
    const { data: target } = await admin
      .from('profiles')
      .select(
        'id, full_name, telegram_pairing_code, telegram_pairing_expires_at, telegram_user_id'
      )
      .eq('telegram_pairing_code', pairingCode)
      .single()

    if (!target) {
      res.status(200).json({
        success: false,
        paired: false,
        error: 'Kod nije ispravan ili je istekao.',
      })
      return
    }
    if (
      target.telegram_pairing_expires_at &&
      new Date(target.telegram_pairing_expires_at) < new Date()
    ) {
      // Obriši expired kod da ne ostane trag
      await admin
        .from('profiles')
        .update({
          telegram_pairing_code: null,
          telegram_pairing_expires_at: null,
        })
        .eq('id', target.id)
      res.status(200).json({
        success: false,
        paired: false,
        error: 'Kod je istekao. Generirajte novi u app-u.',
      })
      return
    }
    if (
      target.telegram_user_id &&
      target.telegram_user_id !== telegramId
    ) {
      res.status(200).json({
        success: false,
        paired: false,
        error: 'Ovaj BepoBot account je već povezan s drugim Telegramom.',
      })
      return
    }

    // Pair: set telegram_user_id, clear pairing code
    const { error: updateErr } = await admin
      .from('profiles')
      .update({
        telegram_user_id: telegramId,
        telegram_pairing_code: null,
        telegram_pairing_expires_at: null,
      })
      .eq('id', target.id)

    if (updateErr) {
      res.status(500).json({
        success: false,
        error: 'Pairing nije uspio: ' + updateErr.message,
      })
      return
    }

    res.status(200).json({
      success: true,
      paired: true,
      user_id: target.id,
      full_name: target.full_name || null,
      message: `✅ Povezano! Bok${target.full_name ? ' ' + target.full_name : ''}.`,
    })
    return
  }

  // Normal lookup: dohvati user po telegram_user_id
  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name')
    .eq('telegram_user_id', telegramId)
    .single()

  if (!profile) {
    res.status(200).json({
      success: false,
      paired: false,
      user_id: null,
      error:
        'Vaš Telegram nije povezan s BepoBot accountom. Otvorite app → postavke i generirajte pairing kod.',
    })
    return
  }

  res.status(200).json({
    success: true,
    paired: true,
    user_id: profile.id,
    full_name: profile.full_name || null,
  })
}
