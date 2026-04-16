// Centralized CORS helper.
//
// Set ALLOWED_ORIGIN env var to restrict which frontend origin can call the API.
// In Vercel, configure per environment (production vs preview).
//
// Default: https://bepobot-web.vercel.app

const ALLOWED_ORIGIN = (process.env.ALLOWED_ORIGIN || 'https://bepobot-web.vercel.app').trim()

export function setCorsHeaders(
  res: { setHeader: (k: string, v: string) => void },
  methods = 'POST, OPTIONS',
): void {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}
