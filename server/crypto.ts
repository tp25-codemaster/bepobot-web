// AES-256-GCM enkripcija za osjetljive kredencijale (eVisitor password).
//
// Master key se čita iz env varijable CREDENTIAL_ENCRYPTION_KEY (32 bajta hex = 64 char).
// Ako nije postavljen, u dev modu koristi fallback (NE KORISTITI U PRODUKCIJI).
//
// Format šifriranog stringa: base64(iv[12] || authTag[16] || ciphertext)

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { Buffer } from 'node:buffer'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16

function getKey(): Buffer {
  const hex = process.env.CREDENTIAL_ENCRYPTION_KEY
  if (hex) {
    if (hex.length !== 64) {
      throw new Error(
        'CREDENTIAL_ENCRYPTION_KEY must be 64 hex chars (32 bytes).'
      )
    }
    return Buffer.from(hex, 'hex')
  }
  // DEV fallback — deterministic, NOT SECURE, only for local testing.
  // Production deploys MUST set CREDENTIAL_ENCRYPTION_KEY.
  console.warn(
    '[crypto] CREDENTIAL_ENCRYPTION_KEY not set — using insecure dev fallback'
  )
  return Buffer.from(
    'devdevdevdevdevdevdevdevdevdevdevdevdevdevdevdevdevdevdevdevdev1',
    'utf8'
  ).subarray(0, 32)
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function safeDecrypt(payload: string | null | undefined): string {
  if (!payload) return ''
  try {
    return decrypt(payload)
  } catch {
    return payload // fallback: vrati plaintext ako nije enkriptiran (legacy)
  }
}

export function decrypt(payload: string): string {
  const key = getKey()
  const buf = Buffer.from(payload, 'base64')
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error('Invalid encrypted payload: too short')
  }
  const iv = buf.subarray(0, IV_LEN)
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const encrypted = buf.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}
