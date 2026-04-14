import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

const BOT_USERNAME = '@bepo25bot'
const PAIRING_EXPIRY_MINUTES = 15

function generatePairingCode(): string {
  // 6 chars, ambiguous chars removed (I, O, 0, 1)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  const buf = new Uint8Array(6)
  crypto.getRandomValues(buf)
  for (const byte of buf) out += chars[byte % chars.length]
  return out
}

export default function TelegramPairingCard() {
  const { user, profile, updateProfile } = useAuth()
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [unlinking, setUnlinking] = useState(false)

  const linked = Boolean(profile?.telegram_user_id)
  const activeCode =
    profile?.telegram_pairing_code &&
    profile?.telegram_pairing_expires_at &&
    new Date(profile.telegram_pairing_expires_at) > new Date()
      ? profile.telegram_pairing_code
      : null

  const pairingMessage = activeCode ? `/start ${activeCode}` : ''

  async function handleGenerate() {
    if (!user) return
    setGenerating(true)
    const code = generatePairingCode()
    const expires = new Date(
      Date.now() + PAIRING_EXPIRY_MINUTES * 60 * 1000
    ).toISOString()
    await supabase
      .from('profiles')
      .update({
        telegram_pairing_code: code,
        telegram_pairing_expires_at: expires,
      })
      .eq('id', user.id)
    await updateProfile({
      telegram_pairing_code: code,
      telegram_pairing_expires_at: expires,
    })
    setGenerating(false)
  }

  async function handleCopyMessage() {
    if (!pairingMessage) return
    try {
      await navigator.clipboard.writeText(pairingMessage)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  async function handleUnlink() {
    if (!confirm('Odspojiti Telegram? Bot ti više neće odgovarati.')) return
    setUnlinking(true)
    await updateProfile({
      telegram_user_id: null,
      telegram_pairing_code: null,
      telegram_pairing_expires_at: null,
    })
    setUnlinking(false)
  }

  return (
    <div className="bg-white rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-text flex items-center gap-2">
          <span className="text-xl">💬</span>
          Telegram bot
        </h3>
        <span
          className={`px-2 py-0.5 text-xs font-medium rounded-full ${
            linked
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-text-muted'
          }`}
        >
          {linked ? 'Povezano' : 'Nije povezano'}
        </span>
      </div>

      {linked ? (
        <div className="space-y-3">
          <div className="text-xs text-text-muted">
            Tvoj Telegram je povezan s BepoBot accountom. Razgovaraj s{' '}
            <span className="font-mono font-semibold text-primary">
              {BOT_USERNAME}
            </span>{' '}
            da upravljaš rezervacijama i prijavama na eVisitor.
          </div>
          <button
            onClick={handleUnlink}
            disabled={unlinking}
            className="w-full py-2 bg-white border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {unlinking ? 'Odspajam...' : 'Odspoji Telegram'}
          </button>
        </div>
      ) : activeCode ? (
        <div className="space-y-3">
          <div className="text-xs text-text-muted">
            1. Otvori{' '}
            <a
              href={`https://t.me/${BOT_USERNAME.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              {BOT_USERNAME}
            </a>{' '}
            na Telegramu
            <br />
            2. Pošalji mu ovu poruku:
          </div>
          <div className="bg-gray-50 border border-border rounded-lg p-3 font-mono text-sm text-text select-all">
            {pairingMessage}
          </div>
          <button
            onClick={handleCopyMessage}
            className="w-full py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
          >
            {copied ? '✓ Kopirano!' : '📋 Kopiraj poruku'}
          </button>
          <div className="text-xs text-text-muted text-center">
            Kod istječe za {PAIRING_EXPIRY_MINUTES} min. Osvježi stranicu nakon
            slanja poruke.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-text-muted">
            Poveži svoj Telegram s BepoBot accountom da bot{' '}
            <span className="font-semibold">{BOT_USERNAME}</span> može
            upravljati tvojim rezervacijama. Generiraj kod ispod i pošalji ga
            botu.
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {generating ? 'Generiram...' : '🔗 Generiraj pairing kod'}
          </button>
        </div>
      )}
    </div>
  )
}
