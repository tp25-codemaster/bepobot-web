// POST /api/evisitor-find-contacts
//
// Multi-tenant: pretraži Gmail inbox za kontakt info gostiju koji nemaju email.
// Za svakog gosta bez emaila: search Gmail → izvuci email/telefon → updateaj CRM.

import { getUserSupabase, getCurrentUser, getSupabaseAdmin } from '../server/supabase.js'
import { safeDecrypt } from '../server/crypto.js'
import { setCorsHeaders } from './_lib/cors.js'

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

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'

// Regex patterns
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g
const PHONE_RE = /(?:\+385|00385|0)[\s.-]?(?:9[1-9]|[2-5]\d)[\s.-]?\d{3}[\s.-]?\d{3,4}/g

async function gmailFetch(url: string, token: string): Promise<Response> {
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } })
}

// Search Gmail for emails mentioning a guest name, extract contact info
async function findContactForGuest(
  name: string,
  surname: string,
  token: string,
  ownerEmail: string
): Promise<{ email: string | null; phone: string | null }> {
  const query = encodeURIComponent(`"${name} ${surname}"`)
  const listRes = await gmailFetch(`${GMAIL_API}/messages?q=${query}&maxResults=5`, token)

  if (!listRes.ok) return { email: null, phone: null }

  const listData = await listRes.json() as { messages?: Array<{ id: string }> }
  if (!listData.messages?.length) return { email: null, phone: null }

  let foundEmail: string | null = null
  let foundPhone: string | null = null

  // Check up to 3 messages
  for (const msg of listData.messages.slice(0, 3)) {
    if (foundEmail && foundPhone) break

    const msgRes = await gmailFetch(`${GMAIL_API}/messages/${msg.id}?format=full`, token)
    if (!msgRes.ok) continue

    const msgData = await msgRes.json() as {
      payload?: {
        headers?: Array<{ name: string; value: string }>
        parts?: Array<{ mimeType: string; body?: { data?: string } }>
        body?: { data?: string }
      }
    }

    const headers = msgData.payload?.headers || []
    const getHeader = (h: string) => (headers.find(x => x.name.toLowerCase() === h.toLowerCase()) || {}).value || ''

    // Extract email from From/To/Reply-To — pick the one that ISN'T the owner
    if (!foundEmail) {
      const fromEmails = (getHeader('From') + ' ' + getHeader('Reply-To')).match(EMAIL_RE) || []
      const toEmails = (getHeader('To') + ' ' + getHeader('Cc')).match(EMAIL_RE) || []
      const allEmails = [...fromEmails, ...toEmails]

      for (const e of allEmails) {
        const lower = e.toLowerCase()
        // Skip owner's own email and common no-reply addresses
        if (lower === ownerEmail.toLowerCase()) continue
        if (lower.includes('noreply') || lower.includes('no-reply') || lower.includes('booking.com') || lower.includes('airbnb')) continue
        foundEmail = e
        break
      }
    }

    // Extract phone from body
    if (!foundPhone) {
      let bodyText = ''
      const parts = msgData.payload?.parts || (msgData.payload ? [msgData.payload] : [])
      for (const part of parts) {
        if (part?.mimeType === 'text/plain' && part?.body?.data) {
          bodyText += Buffer.from(part.body.data, 'base64').toString('utf-8')
        }
      }
      if (!bodyText && msgData.payload?.body?.data) {
        bodyText = Buffer.from(msgData.payload.body.data, 'base64').toString('utf-8')
      }

      const phones = bodyText.match(PHONE_RE) || []
      if (phones[0]) foundPhone = phones[0].replace(/[\s.-]/g, '')
    }
  }

  return { email: foundEmail, phone: foundPhone }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  // Auth
  const authHeader = (req.headers.authorization || req.headers.Authorization) as string | undefined
  const supabase = getUserSupabase(authHeader)
  if (!supabase) { res.status(401).json({ error: 'Unauthorized' }); return }
  const user = await getCurrentUser(supabase)
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return }

  // Get Gmail token
  const admin = getSupabaseAdmin()
  const { data: profile } = await admin
    .from('profiles')
    .select('gmail_access_token, gmail_email, gmail_connected')
    .eq('id', user.id)
    .single()

  if (!profile?.gmail_connected || !profile.gmail_access_token) {
    res.status(400).json({ error: 'Gmail nije spojen. Idi u Postavke i poveži Gmail.' })
    return
  }

  // Get unique guests without email
  const { data: rows } = await admin
    .from('reservations')
    .select('tourist_name, tourist_surname')
    .eq('user_id', user.id)
    .is('guest_email', null)
    .not('tourist_name', 'is', null)

  if (!rows || rows.length === 0) {
    res.status(200).json({ success: true, searched: 0, found: 0, message: 'Svi gosti već imaju email adresu.' })
    return
  }

  // Deduplicate by name+surname
  const uniqueGuests = new Map<string, { name: string; surname: string }>()
  for (const r of rows) {
    const name = (r.tourist_name || '').trim()
    const surname = (r.tourist_surname || '').trim()
    if (!name) continue
    const key = `${name.toLowerCase()}|${surname.toLowerCase()}`
    if (!uniqueGuests.has(key)) {
      uniqueGuests.set(key, { name, surname })
    }
  }

  const guestList = Array.from(uniqueGuests.values())
  let found = 0
  let searched = 0
  const ownerEmail = profile.gmail_email || ''
  const token = safeDecrypt(profile.gmail_access_token)

  // Process in batches of 5
  for (let i = 0; i < guestList.length; i += 5) {
    const batch = guestList.slice(i, i + 5)
    const results = await Promise.all(
      batch.map(g => findContactForGuest(g.name, g.surname, token, ownerEmail))
    )

    for (let j = 0; j < batch.length; j++) {
      searched++
      const { email, phone } = results[j]
      if (!email && !phone) continue

      found++
      const g = batch[j]
      const updates: Record<string, string> = {}
      if (email) updates.guest_email = email
      if (phone) updates.guest_phone = phone

      // Update ALL reservations for this guest
      await admin
        .from('reservations')
        .update(updates)
        .eq('user_id', user.id)
        .ilike('tourist_name', g.name)
        .ilike('tourist_surname', g.surname)
    }
  }

  res.status(200).json({
    success: true,
    searched,
    found,
    message: `Pretraženo ${searched} gostiju. Pronađen kontakt za ${found}.`,
  })
}
