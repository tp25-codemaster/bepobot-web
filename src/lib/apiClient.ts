// Authenticated fetch helper — automatski dodaje Supabase JWT u Authorization header.

import { supabase } from './supabase'

export interface ApiResult<T = unknown> {
  ok: boolean
  status: number
  data: T | null
  error?: string
}

export async function apiPost<T = unknown>(
  path: string,
  body: unknown
): Promise<ApiResult<T>> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }

  try {
    const res = await fetch(path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    const text = await res.text()
    let parsed: unknown = null
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = text
    }

    return {
      ok: res.ok,
      status: res.status,
      data: (parsed as T) ?? null,
      error:
        !res.ok && parsed && typeof parsed === 'object' && 'error' in parsed
          ? String((parsed as { error: unknown }).error)
          : !res.ok
            ? `HTTP ${res.status}`
            : undefined,
    }
  } catch (e) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: (e as Error).message,
    }
  }
}
