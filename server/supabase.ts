// Server-side Supabase helpers.
// Kreiramo klijent koji koristi JWT trenutnog usera — RLS politike
// automatski izoliraju podatke po user_id.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

export interface AuthedRequest {
  authHeader?: string
}

/**
 * Iz "Authorization: Bearer <jwt>" headera stvara Supabase klijent koji
 * operira u kontekstu tog usera (RLS se primjenjuje normalno).
 *
 * Vraća null ako header nedostaje ili je neispravan.
 */
export function getUserSupabase(authHeader?: string): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase env vars missing (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)'
    )
  }
  if (!authHeader) return null
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Dohvati authed usera iz klijenta. Vraća null ako JWT nije valjan.
 */
export async function getCurrentUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) return null
  return data.user
}
