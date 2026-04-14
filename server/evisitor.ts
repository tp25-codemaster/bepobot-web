// Shared eVisitor backend logic.
// Used by both Vercel serverless function (api/evisitor-checkin.ts)
// and the local Vite dev server plugin (vite.config.ts).
//
// Uses native node:https with legacy OpenSSL cipher list because
// eVisitor server (www.evisitor.hr) negotiates a weak Diffie-Hellman key
// that Node 18+ rejects by default:
//   "SSL routines:tls_process_ske_dhe:dh key too small"

import https from 'node:https'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'

interface HttpsResponse {
  statusCode: number
  headers: Record<string, string | string[] | undefined>
  body: string
}

function httpsRequest(
  opts: https.RequestOptions,
  body?: string
): Promise<HttpsResponse> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        ...opts,
        // Legacy-compatible ciphers so eVisitor's weak DH params are accepted.
        ciphers: 'DEFAULT:@SECLEVEL=0',
        minVersion: 'TLSv1',
      },
      (res) => {
        let data = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () =>
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            body: data,
          })
        )
      }
    )
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

export interface GuestCheckInInput {
  Facility?: string
  ID?: string
  TouristName?: string
  TouristSurname?: string
  TouristMiddleName?: string
  Gender?: string
  DateOfBirth?: string
  DocumentType?: string
  DocumentNumber?: string
  Citizenship?: string
  CountryOfBirth?: string
  CountryOfResidence?: string
  CityOfResidence?: string
  ResidenceAddress?: string
  StayFrom?: string
  TimeStayFrom?: string
  ForeseenStayUntil?: string
  TimeEstimatedStayUntil?: string
  ArrivalOrganisation?: string
  OfferedServiceType?: string
  TTPaymentCategory?: string
  _testMode?: boolean
}

export interface EVisitorResult {
  success: boolean
  testMode?: boolean
  touristId?: string
  touristName?: string
  facility?: string
  checkinStatus?: number
  checkinError?: string | null
  message?: string
  loggedInAs?: string
  error?: string
}

const HOST = 'www.evisitor.hr'
const BASE = '/eVisitorRhetos_API'

export interface EVisitorCredentials {
  username: string
  password: string
}

/**
 * Validira eVisitor kredencijale pokušajem Login → Logout (bez CheckIna).
 * Vraća { ok: true } ako login radi, inače { ok: false, error }.
 */
export async function validateCredentials(
  creds: EVisitorCredentials
): Promise<{ ok: true } | { ok: false; error: string }> {
  const loginBody = JSON.stringify({
    UserName: creds.username,
    Password: creds.password,
    PersistCookie: false,
  })

  let loginRes: HttpsResponse
  try {
    loginRes = await httpsRequest(
      {
        host: HOST,
        path: BASE + '/Resources/AspNetFormsAuth/Authentication/Login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Content-Length': Buffer.byteLength(loginBody),
        },
      },
      loginBody
    )
  } catch (e) {
    return { ok: false, error: 'TLS/network error: ' + (e as Error).message }
  }

  if (loginRes.statusCode !== 200) {
    return {
      ok: false,
      error: `Login HTTP ${loginRes.statusCode}: ${loginRes.body.slice(0, 200)}`,
    }
  }
  if (loginRes.body && loginRes.body.trim() === 'false') {
    return { ok: false, error: 'Pogrešno korisničko ime ili lozinka' }
  }

  const rawCookie = loginRes.headers['set-cookie']
  const cookies = Array.isArray(rawCookie)
    ? rawCookie
    : rawCookie
      ? [rawCookie]
      : []
  const evisitorC = cookies.find((c) => c.startsWith('.eVisitorAPI='))
  if (!evisitorC) {
    return { ok: false, error: 'eVisitor server nije vratio cookie' }
  }

  // Best-effort logout to free session.
  const cookieHeader = evisitorC.split(';')[0]
  try {
    await httpsRequest({
      host: HOST,
      path: BASE + '/Resources/AspNetFormsAuth/Authentication/Logout',
      method: 'POST',
      headers: { Cookie: cookieHeader, 'Content-Length': '0' },
    })
  } catch {
    /* ignore */
  }

  return { ok: true }
}

export async function runEVisitorCheckIn(
  g: GuestCheckInInput,
  creds: EVisitorCredentials
): Promise<EVisitorResult> {
  // 1. LOGIN
  const loginBody = JSON.stringify({
    UserName: creds.username,
    Password: creds.password,
    PersistCookie: false,
  })

  let loginRes: HttpsResponse
  try {
    loginRes = await httpsRequest(
      {
        host: HOST,
        path: BASE + '/Resources/AspNetFormsAuth/Authentication/Login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Content-Length': Buffer.byteLength(loginBody),
        },
      },
      loginBody
    )
  } catch (e) {
    return {
      success: false,
      error: 'Login network/TLS error: ' + (e as Error).message,
    }
  }

  if (loginRes.statusCode !== 200) {
    return {
      success: false,
      error: `Login HTTP ${loginRes.statusCode}: ${loginRes.body.slice(0, 200)}`,
    }
  }
  if (loginRes.body && loginRes.body.trim() === 'false') {
    return {
      success: false,
      error: 'eVisitor login returned false (invalid credentials?)',
    }
  }

  const rawCookie = loginRes.headers['set-cookie']
  const cookies = Array.isArray(rawCookie)
    ? rawCookie
    : rawCookie
      ? [rawCookie]
      : []
  const evisitorC = cookies.find((c) => c.startsWith('.eVisitorAPI='))
  if (!evisitorC) {
    return {
      success: false,
      error: 'No .eVisitorAPI cookie in login response',
    }
  }
  const cookieHeader = evisitorC.split(';')[0] // ".eVisitorAPI=<value>"

  const touristDisplayName = (
    (g.TouristName || '') +
    ' ' +
    (g.TouristSurname || '')
  ).trim()

  // 2. TEST MODE — skip real CheckIn, go straight to Logout
  if (g._testMode === true) {
    try {
      await httpsRequest({
        host: HOST,
        path: BASE + '/Resources/AspNetFormsAuth/Authentication/Logout',
        method: 'POST',
        headers: { Cookie: cookieHeader, 'Content-Length': '0' },
      })
    } catch {
      /* ignore logout errors */
    }
    return {
      success: true,
      testMode: true,
      touristName: touristDisplayName,
      facility: g.Facility || '',
      message: 'TEST MODE — eVisitor login uspješan, CheckIn preskočen',
      loggedInAs: creds.username,
    }
  }

  // 3. CHECKIN (real mode)
  // eVisitor expects a System.Guid (UUID), not a custom string.
  const touristId = g.ID || randomUUID()

  const checkinPayload = JSON.stringify({
    Facility: g.Facility || '',
    ID: touristId,
    TouristName: g.TouristName || '',
    TouristSurname: g.TouristSurname || '',
    TouristMiddleName: g.TouristMiddleName || '',
    Gender: g.Gender || '',
    DateOfBirth: g.DateOfBirth || '',
    DocumentType: g.DocumentType || '',
    DocumentNumber: g.DocumentNumber || '',
    Citizenship: g.Citizenship || '',
    CountryOfBirth: g.CountryOfBirth || g.Citizenship || '',
    CountryOfResidence: g.CountryOfResidence || g.Citizenship || '',
    CityOfResidence: g.CityOfResidence || '',
    ResidenceAddress: g.ResidenceAddress || '-',
    StayFrom: g.StayFrom || '',
    TimeStayFrom: g.TimeStayFrom || '14:00',
    ForeseenStayUntil: g.ForeseenStayUntil || '',
    TimeEstimatedStayUntil: g.TimeEstimatedStayUntil || '10:00',
    ArrivalOrganisation: g.ArrivalOrganisation || 'I',
    OfferedServiceType: g.OfferedServiceType || 'noćenje',
    TTPaymentCategory: g.TTPaymentCategory || '11',
  })

  let checkinRes: HttpsResponse
  try {
    checkinRes = await httpsRequest(
      {
        host: HOST,
        path: BASE + '/Rest/Htz/CheckInTourist',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Cookie: cookieHeader,
          'Content-Length': Buffer.byteLength(checkinPayload),
        },
      },
      checkinPayload
    )
  } catch (e) {
    return {
      success: false,
      error: 'CheckIn network error: ' + (e as Error).message,
    }
  }

  // 4. LOGOUT (best effort)
  try {
    await httpsRequest({
      host: HOST,
      path: BASE + '/Resources/AspNetFormsAuth/Authentication/Logout',
      method: 'POST',
      headers: { Cookie: cookieHeader, 'Content-Length': '0' },
    })
  } catch {
    /* ignore */
  }

  // eVisitor returns 200 + empty body on successful CheckIn,
  // or 200 + error JSON, or 4xx/5xx.
  const bodyTrim = (checkinRes.body || '').trim()
  const success = checkinRes.statusCode === 200 && bodyTrim === ''

  return {
    success,
    testMode: false,
    touristId,
    touristName: touristDisplayName,
    facility: g.Facility || '',
    checkinStatus: checkinRes.statusCode,
    checkinError: success ? null : bodyTrim.slice(0, 500) || 'Unknown error',
    message: success ? 'eVisitor prijava uspješna' : 'eVisitor CheckIn greška',
  }
}
