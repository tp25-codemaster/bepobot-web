// POST /api/evisitor-import
//
// Multi-tenant: dohvaća eVisitor povijest gostiju za ulogiranog usera
// i upserta u reservations tablicu.
// Koristi native node:https zbog eVisitor slabog DH keya.

import https from 'node:https'
import { Buffer } from 'node:buffer'
import { getUserSupabase, getCurrentUser, getSupabaseAdmin } from '../server/supabase.js'
import { decrypt } from '../server/crypto.js'

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

interface HttpsResponse {
  statusCode: number
  headers: Record<string, string | string[] | undefined>
  body: string
}

function httpsRequest(opts: https.RequestOptions, body?: string): Promise<HttpsResponse> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { ...opts, ciphers: 'DEFAULT:@SECLEVEL=0', minVersion: 'TLSv1' as const },
      (res) => {
        let data = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => (data += chunk))
        res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, headers: res.headers, body: data }))
      }
    )
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

const HOST = 'www.evisitor.hr'
const BASE = '/eVisitorRhetos_API'

// Parse Microsoft /Date(timestamp+offset)/ format
function parseMsDate(d: string | null): string | null {
  if (!d) return null
  const match = d.match(/\/Date\((-?\d+)/)
  if (!match) return null
  const ts = parseInt(match[1], 10)
  const date = new Date(ts)
  return date.toISOString().split('T')[0] // YYYY-MM-DD
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  // Auth — get current user
  const authHeader = (req.headers.authorization || req.headers.Authorization) as string | undefined
  const supabase = getUserSupabase(authHeader)
  if (!supabase) { res.status(401).json({ error: 'Unauthorized' }); return }
  const user = await getCurrentUser(supabase)
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return }

  // Get eVisitor credentials from profile (use admin to read encrypted password)
  const admin = getSupabaseAdmin()
  const { data: profile } = await admin
    .from('profiles')
    .select('evisitor_username, evisitor_password, evisitor_connected')
    .eq('id', user.id)
    .single()

  if (!profile?.evisitor_connected || !profile.evisitor_username || !profile.evisitor_password) {
    res.status(400).json({ error: 'eVisitor nije spojen. Idi u Postavke i poveži eVisitor.' })
    return
  }

  let password: string
  try {
    password = decrypt(profile.evisitor_password)
  } catch {
    res.status(500).json({ error: 'Greška pri dekriptiranju eVisitor lozinke.' })
    return
  }

  // 1. LOGIN to eVisitor
  const loginBody = JSON.stringify({
    UserName: profile.evisitor_username,
    Password: password,
    PersistCookie: false,
  })

  let loginRes: HttpsResponse
  try {
    loginRes = await httpsRequest({
      host: HOST,
      path: BASE + '/Resources/AspNetFormsAuth/Authentication/Login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Content-Length': String(Buffer.byteLength(loginBody)),
      },
    }, loginBody)
  } catch (e) {
    res.status(500).json({ error: 'eVisitor login network error: ' + (e as Error).message })
    return
  }

  if (loginRes.statusCode !== 200 || loginRes.body.trim() === 'false') {
    res.status(401).json({ error: 'eVisitor login neuspješan. Provjeri kredencijale.' })
    return
  }

  const rawCookie = loginRes.headers['set-cookie']
  const cookies = Array.isArray(rawCookie) ? rawCookie : rawCookie ? [rawCookie] : []
  const evisitorC = cookies.find((c) => c.startsWith('.eVisitorAPI='))
  if (!evisitorC) {
    res.status(500).json({ error: 'eVisitor nije vratio cookie.' })
    return
  }
  const cookieHeader = evisitorC.split(';')[0]

  // 2. GET all tourists
  let touristRes: HttpsResponse
  try {
    touristRes = await httpsRequest({
      host: HOST,
      path: BASE + '/Rest/Htz/Tourist',
      method: 'GET',
      headers: { Cookie: cookieHeader, Accept: 'application/json' },
    })
  } catch (e) {
    res.status(500).json({ error: 'eVisitor Tourist fetch error: ' + (e as Error).message })
    return
  }

  // 3. LOGOUT (best effort)
  try {
    await httpsRequest({
      host: HOST,
      path: BASE + '/Resources/AspNetFormsAuth/Authentication/Logout',
      method: 'POST',
      headers: { Cookie: cookieHeader, 'Content-Length': '0' },
    })
  } catch { /* ignore */ }

  if (touristRes.statusCode !== 200) {
    res.status(500).json({ error: `eVisitor Tourist endpoint returned ${touristRes.statusCode}` })
    return
  }

  let records: Array<Record<string, unknown>>
  try {
    const parsed = JSON.parse(touristRes.body)
    records = parsed.Records || []
  } catch {
    res.status(500).json({ error: 'Nije moguće parsirati eVisitor odgovor.' })
    return
  }

  // 4. Get user's apartments for matching by FacilityID
  const { data: apartments } = await admin
    .from('apartments')
    .select('id, name')
    .eq('user_id', user.id)

  // 5. Get user's Facility info from eVisitor (already fetched, use FacilityID from tourists)
  // For now, all tourists go to first apartment if only one exists
  const defaultApartmentId = apartments && apartments.length === 1 ? apartments[0].id : null

  // 6. Map and upsert into reservations
  let imported = 0
  let duplicates = 0
  let errors = 0

  for (const r of records) {
    const touristName = (r.TouristName as string || '').trim()
    const touristSurname = (r.TouristSurname as string || '').trim()
    const documentNumber = (r.DocumentNumber as string || '').trim()
    const checkIn = parseMsDate(r.TimeStayFrom as string)
    const checkOut = parseMsDate(r.TimeEstimatedStayUntil as string) || parseMsDate(r.CheckOutTime as string)

    if (!touristName || !checkIn) continue

    // Dedup: check if this exact guest+checkin already exists
    const { data: existing } = await admin
      .from('reservations')
      .select('id')
      .eq('user_id', user.id)
      .ilike('tourist_name', touristName)
      .ilike('tourist_surname', touristSurname)
      .eq('check_in', checkIn)
      .limit(1)

    if (existing && existing.length > 0) {
      duplicates++
      continue
    }

    const { error: insertErr } = await admin.from('reservations').insert({
      user_id: user.id,
      apartment_id: defaultApartmentId,
      guest_name: `${touristName} ${touristSurname}`.trim(),
      tourist_name: touristName,
      tourist_surname: touristSurname,
      gender: null,
      date_of_birth: parseMsDate(r.DateOfBirth as string),
      document_number: documentNumber || null,
      citizenship: null, // eVisitor returns UUID, not ISO code — skip for now
      city_of_residence: (r.CityResidenceAbroad as string) || null,
      residence_address: (r.ResidenceAddress as string) || null,
      guest_email: (r.TouristEmail as string) || null,
      guest_phone: (r.TouristTelephone as string) || null,
      check_in: checkIn,
      check_out: checkOut,
      status: 'completed',
      notes: `Imported from eVisitor`,
      evisitor_checked_in_at: parseMsDate(r.TimeOfInsertCheckIn as string),
      evisitor_tourist_id: (r.ID as string) || null,
    })

    if (insertErr) {
      errors++
    } else {
      imported++
    }
  }

  res.status(200).json({
    success: true,
    total: records.length,
    imported,
    duplicates,
    errors,
    message: `Uvezeno ${imported} gostiju, ${duplicates} duplikata preskočeno, ${errors} grešaka.`,
  })
}
