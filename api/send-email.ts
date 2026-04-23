import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// Shared secret so only our n8n workflows can call this
const API_SECRET = process.env.EMAIL_API_SECRET || ''

interface EmailRequest {
  to: string
  subject: string
  html: string
  replyTo?: string
  secret: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!API_SECRET) {
    console.error('EMAIL_API_SECRET not configured')
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  const { to, subject, html, replyTo, secret } = req.body as EmailRequest

  if (secret !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, html' })
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'BepoBot <noreply@bepobot.hr>',
      to: [to],
      subject,
      html,
      replyTo: replyTo || undefined,
    })

    if (error) {
      console.error('Resend error:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ success: true, id: data?.id })
  } catch (err) {
    console.error('Email send failed:', err)
    return res.status(500).json({ error: 'Failed to send email' })
  }
}
