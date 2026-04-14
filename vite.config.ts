import { defineConfig, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Load .env.local into process.env so server/ code (which reads process.env)
// has access to VITE_SUPABASE_URL etc. during local dev.
function loadEnvLocal() {
  try {
    const envPath = resolve(__dirname, '.env.local')
    const content = readFileSync(envPath, 'utf8')
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    /* no .env.local, ignore */
  }
}
loadEnvLocal()

// Shape-compatible with Vercel handler signature. The dev adapter exposes
// res.status/.json to match what api/*.ts handlers expect.
interface DevRes {
  statusCode: number
  setHeader: (name: string, value: string) => void
  end: (body?: string) => void
  status(code: number): DevRes
  json(data: unknown): void
}

type ApiHandler = (
  req: {
    method?: string
    body: unknown
    headers: Record<string, string>
    url?: string
    query?: Record<string, string>
  },
  res: DevRes
) => Promise<void> | void

function parseQuery(url: string | undefined): Record<string, string> {
  if (!url) return {}
  const qIdx = url.indexOf('?')
  if (qIdx < 0) return {}
  const qs = url.slice(qIdx + 1)
  const params = new URLSearchParams(qs)
  const out: Record<string, string> = {}
  for (const [k, v] of params) out[k] = v
  return out
}

async function readBody(req: import('node:http').IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function wrapRes(res: import('node:http').ServerResponse): DevRes {
  const dev: DevRes = {
    get statusCode() {
      return res.statusCode
    },
    set statusCode(v: number) {
      res.statusCode = v
    },
    setHeader: (name, value) => res.setHeader(name, value),
    end: (body) => res.end(body),
    status(code: number) {
      res.statusCode = code
      return dev
    },
    json(data: unknown) {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(data))
    },
  }
  return dev
}

function mountHandler(
  server: ViteDevServer,
  route: string,
  importPath: string
) {
  server.middlewares.use(route, async (req, res) => {
    try {
      const body = req.method === 'GET' ? {} : await readBody(req)
      const handlerModule = (await server.ssrLoadModule(importPath)) as {
        default: ApiHandler
      }
      await handlerModule.default(
        {
          method: req.method,
          body,
          headers: req.headers as Record<string, string>,
          url: req.url,
          query: parseQuery(req.url),
        },
        wrapRes(res)
      )
    } catch (e) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          success: false,
          error: 'Dev middleware crash: ' + (e as Error).message,
        })
      )
    }
  })
}

function evisitorDevApi(): Plugin {
  return {
    name: 'evisitor-dev-api',
    apply: 'serve',
    configureServer(server) {
      mountHandler(server, '/api/evisitor-checkin', '/api/evisitor-checkin.ts')
      mountHandler(server, '/api/evisitor-connect', '/api/evisitor-connect.ts')
      mountHandler(
        server,
        '/api/evisitor-disconnect',
        '/api/evisitor-disconnect.ts'
      )
      mountHandler(
        server,
        '/api/reservation-create',
        '/api/reservation-create.ts'
      )
      mountHandler(
        server,
        '/api/reservation-public',
        '/api/reservation-public.ts'
      )
      mountHandler(
        server,
        '/api/reservation-submit',
        '/api/reservation-submit.ts'
      )
      mountHandler(
        server,
        '/api/reservation-checkin',
        '/api/reservation-checkin.ts'
      )
      mountHandler(server, '/api/bot-checkin', '/api/bot-checkin.ts')
      mountHandler(server, '/api/bot-reservations', '/api/bot-reservations.ts')
      mountHandler(
        server,
        '/api/bot-telegram-resolve',
        '/api/bot-telegram-resolve.ts'
      )
      mountHandler(server, '/api/bot-chat', '/api/bot-chat.ts')
      mountHandler(
        server,
        '/api/bot-process-email',
        '/api/bot-process-email.ts'
      )
      mountHandler(server, '/api/bot-gmail-poll', '/api/bot-gmail-poll.ts')
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), evisitorDevApi()],
})
