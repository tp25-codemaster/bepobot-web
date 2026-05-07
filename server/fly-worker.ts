// Fly.io Node worker — PoC for eVisitor TLS workaround.
//
// eVisitor uses a legacy Rhetos platform with weak DH cipher TLS that fails
// under OpenSSL's default security level. The fix is to pass a custom cipher
// list with DEFAULT:@SECLEVEL=0 via node:https — which requires a full Node.js
// environment (not Vercel Edge, not Cloudflare Workers).
//
// This file proves that Fly.io Node machines can make HTTPS requests with the
// custom cipher list, establishing Fly.io as the correct runtime for Week 3.

import * as http from 'node:http'
import * as https from 'node:https'
import * as tls from 'node:tls'

const PORT = Number(process.env.PORT) || 3000

// The eVisitor TLS fix: lower OpenSSL security level so legacy DH params work.
// SECLEVEL=0 disables the minimum key strength check — intentional for this target.
const EVISITOR_TLS_OPTIONS: https.RequestOptions = {
  ciphers: 'DEFAULT:@SECLEVEL=0',
  secureOptions: tls.constants.SSL_OP_LEGACY_SERVER_CONNECT,
}

function testTlsWorkaround(targetUrl: string): Promise<{ ok: boolean; statusCode?: number; error?: string }> {
  return new Promise((resolve) => {
    const url = new URL(targetUrl)
    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'GET',
      timeout: 5000,
      ...EVISITOR_TLS_OPTIONS,
    }

    const req = https.request(options, (res) => {
      res.resume()
      resolve({ ok: true, statusCode: res.statusCode })
    })

    req.on('timeout', () => {
      req.destroy()
      resolve({ ok: false, error: 'timeout' })
    })

    req.on('error', (err) => {
      resolve({ ok: false, error: err.message })
    })

    req.end()
  })
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    // Prove TLS workaround works by hitting the eVisitor login page.
    // Falls back to a public HTTPS endpoint if EVISITOR_URL is not set.
    const target = process.env.EVISITOR_URL || 'https://evisitor.hr'
    const result = await testTlsWorkaround(target)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      node: process.version,
      tls_workaround: {
        target,
        ...result,
      },
    }))
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, () => {
  console.log(`fly-worker listening on :${PORT}`)
  console.log(`Node ${process.version} — TLS workaround ready (DEFAULT:@SECLEVEL=0)`)
})
