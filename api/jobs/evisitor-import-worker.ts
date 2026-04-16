// POST /api/jobs/evisitor-import-worker
//
// QStash callback that runs eVisitor guest history import in background.
// Called with { jobId }.
//
// Flow:
//   1. Verify QStash signature
//   2. Load job + user from DB
//   3. Run existing eVisitor import logic (login → fetch → dedup → insert)
//   4. Update job progress in real-time
//   5. Mark completed

import https from 'node:https'
import { Buffer } from 'node:buffer'
import { getSupabaseAdmin } from '../../server/supabase.js'
import { decrypt } from '../../server/crypto.js'
import { verifyQStash, getJob, updateJob } from '../_lib/qstash.js'

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

function parseMsDate(d: string | null): string | null {
  if (!d) return null
  const match = d.match(/\/Date\((-?\d+)/)
  if (!match) return null
  return new Date(parseInt(match[1], 10)).toISOString().split('T')[0]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // Verify QStash signature
  const valid = await verifyQStash(req)
  if (!valid) {
    res.status(401).json({ error: 'Invalid signature' })
    return
  }

  const { jobId } = (req.body || {}) as { jobId?: string }
  if (!jobId) {
    res.status(400).json({ error: 'Missing jobId' })
    return
  }

  const job = await getJob(jobId)
  if (!job) {
    res.status(404).json({ error: 'Job not found' })
    return
  }

  await updateJob(jobId, { status: 'running', message: 'Povezujem se na eVisitor...' })

  // Load user's eVisitor credentials
  const admin = getSupabaseAdmin()
  const { data: profile } = await admin
    .from('profiles')
    .select('evisitor_username, evisitor_password, evisitor_connected')
    .eq('id', job.user_id)
    .single()

  if (!profile?.evisitor_connected || !profile.evisitor_username || !profile.evisitor_password) {
    await updateJob(jobId, {
      status: 'failed',
      error: 'eVisitor nije spojen',
    })
    res.status(200).json({ success: false })
    return
  }

  let password: string
  try {
    password = decrypt(profile.evisitor_password)
  } catch {
    await updateJob(jobId, { status: 'failed', error: 'Greška pri dekriptiranju' })
    res.status(200).json({ success: false })
    return
  }

  // Login
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
    await updateJob(jobId, { status: 'failed', error: 'eVisitor login network error' })
    res.status(200).json({ success: false })
    return
  }

  if (loginRes.statusCode !== 200 || loginRes.body.trim() === 'false') {
    await updateJob(jobId, { status: 'failed', error: 'eVisitor login neuspješan' })
    res.status(200).json({ success: false })
    return
  }

  const rawCookie = loginRes.headers['set-cookie']
  const cookies = Array.isArray(rawCookie) ? rawCookie : rawCookie ? [rawCookie] : []
  const evisitorC = cookies.find((c) => c.startsWith('.eVisitorAPI='))
  if (!evisitorC) {
    await updateJob(jobId, { status: 'failed', error: 'eVisitor nije vratio cookie' })
    res.status(200).json({ success: false })
    return
  }
  const cookieHeader = evisitorC.split(';')[0]

  // Fetch all tourists
  await updateJob(jobId, { message: 'Dohvaćam goste iz eVisitora...' })
  let touristRes: HttpsResponse
  try {
    touristRes = await httpsRequest({
      host: HOST,
      path: BASE + '/Rest/Htz/Tourist',
      method: 'GET',
      headers: { Cookie: cookieHeader, Accept: 'application/json' },
    })
  } catch (e) {
    await updateJob(jobId, { status: 'failed', error: 'eVisitor Tourist fetch error' })
    res.status(200).json({ success: false })
    return
  }

  // Logout (best effort)
  try {
    await httpsRequest({
      host: HOST,
      path: BASE + '/Resources/AspNetFormsAuth/Authentication/Logout',
      method: 'POST',
      headers: { Cookie: cookieHeader, 'Content-Length': '0' },
    })
  } catch { /* ignore */ }

  if (touristRes.statusCode !== 200) {
    await updateJob(jobId, { status: 'failed', error: `Tourist endpoint ${touristRes.statusCode}` })
    res.status(200).json({ success: false })
    return
  }

  let records: Array<Record<string, unknown>>
  try {
    const parsed = JSON.parse(touristRes.body)
    records = parsed.Records || []
  } catch {
    await updateJob(jobId, { status: 'failed', error: 'Nije moguće parsirati eVisitor odgovor' })
    res.status(200).json({ success: false })
    return
  }

  // Get default apartment
  const { data: apartments } = await admin
    .from('apartments')
    .select('id, name')
    .eq('user_id', job.user_id)
  const defaultApartmentId = apartments && apartments.length === 1 ? apartments[0].id : null

  // Start importing
  await updateJob(jobId, {
    message: `Uvozim ${records.length} gostiju...`,
    total: records.length,
    processed: 0,
  })

  let imported = 0
  let duplicates = 0
  let errors = 0

  for (let i = 0; i < records.length; i++) {
    const r = records[i]
    const touristName = (r.TouristName as string || '').trim()
    const touristSurname = (r.TouristSurname as string || '').trim()
    const documentNumber = (r.DocumentNumber as string || '').trim()
    const checkIn = parseMsDate(r.TimeStayFrom as string)
    const checkOut = parseMsDate(r.TimeEstimatedStayUntil as string) || parseMsDate(r.CheckOutTime as string)

    if (!touristName || !checkIn) continue

    // Dedup
    const { data: existing } = await admin
      .from('reservations')
      .select('id')
      .eq('user_id', job.user_id)
      .ilike('tourist_name', touristName)
      .ilike('tourist_surname', touristSurname)
      .eq('check_in', checkIn)
      .limit(1)

    if (existing && existing.length > 0) {
      duplicates++
    } else {
      const { error: insertErr } = await admin.from('reservations').insert({
        user_id: job.user_id,
        apartment_id: defaultApartmentId,
        guest_name: `${touristName} ${touristSurname}`.trim(),
        tourist_name: touristName,
        tourist_surname: touristSurname,
        date_of_birth: parseMsDate(r.DateOfBirth as string),
        document_number: documentNumber || null,
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

      if (insertErr) errors++
      else imported++
    }

    // Update progress every 20 items
    if ((i + 1) % 20 === 0) {
      await updateJob(jobId, {
        processed: i + 1,
        progress: Math.round(((i + 1) / records.length) * 100),
        message: `${imported} uvezeno, ${duplicates} duplikata...`,
      })
    }
  }

  // Done
  await updateJob(jobId, {
    status: 'completed',
    progress: 100,
    processed: records.length,
    message: `Uvezeno ${imported} gostiju, ${duplicates} duplikata preskočeno, ${errors} grešaka.`,
    result: { total: records.length, imported, duplicates, errors },
  })

  res.status(200).json({ success: true })
}
