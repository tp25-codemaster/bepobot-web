// GET /api/gmail-connect?token=<supabase_jwt>
//
// Redirecta korisnika na Google OAuth consent screen.
// Token se šalje kao query param jer browser redirect ne može slati headers.

interface VercelRequest {
  method?: string
  query: { [key: string]: string | string[] | undefined }
  headers: { [key: string]: string | string[] | undefined }
}
interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (data: unknown) => void
  setHeader: (name: string, value: string) => void
  redirect: (url: string) => void
  end: () => void
}

const GOOGLE_CLIENT_ID = '590860880888-aq0jlqq7en5klatohs37ec7acuj0t2se.apps.googleusercontent.com'
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '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'
const REDIRECT_URI = 'https://bepobot-web.vercel.app/api/gmail-callback'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(204).end()
    return
  }

  const token = (req.query.token as string) || ''
  if (!token) {
    res.status(400).json({ error: 'Missing token parameter' })
    return
  }

  if (!GOOGLE_CLIENT_ID) {
    res.status(500).json({ error: 'Google OAuth not configured' })
    return
  }

  // Build Google OAuth URL
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.readonly email',
    access_type: 'offline',
    prompt: 'consent',
    state: token, // Pass JWT as state so callback can identify the user
  })

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
}
