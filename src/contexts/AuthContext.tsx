import { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import * as Sentry from '@sentry/react'
import { supabase, isDemoMode } from '../lib/supabase.js'
import { useNavigate } from 'react-router-dom'

interface Profile {
  id: string
  full_name: string | null
  onboarding_complete: boolean
  plan: 'trial' | 'starter' | 'pro' | 'business'
  evisitor_username: string | null
  evisitor_password: string | null
  evisitor_connected: boolean
  evisitor_auto_checkin: boolean
  gmail_access_token: string | null
  gmail_refresh_token: string | null
  gmail_connected: boolean
  gmail_email: string | null
  telegram_user_id: number | null
  telegram_pairing_code: string | null
  telegram_pairing_expires_at: string | null
  created_at: string
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  isDemo: boolean
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (isDemoMode) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
        Sentry.setUser({ id: session.user.id })
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        Sentry.setUser({ id: session.user.id })
        // On fresh login/signup, fetch profile then navigate
        if (event === 'SIGNED_IN') {
          fetchProfile(session.user.id).then((prof) => {
            if (!prof?.onboarding_complete) {
              navigate('/onboarding')
            } else {
              // Only navigate to app if currently on login page
              if (window.location.pathname === '/app/login') {
                navigate('/app')
              }
            }
          })
        } else {
          fetchProfile(session.user.id)
        }
      } else {
        setProfile(null)
        Sentry.setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string): Promise<Profile | null> {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) setProfile(data as Profile)
    return (data as Profile) || null
  }

  async function signUp(email: string, password: string, fullName?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) return { error: translateError(error.message) }

    if (fullName && data.user) {
      await supabase.from('profiles').update({ full_name: fullName }).eq('id', data.user.id)
    }

    // Navigation handled by onAuthStateChange SIGNED_IN event
    return { error: null }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: translateError(error.message) }

    // Navigation handled by onAuthStateChange SIGNED_IN event
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setSession(null)
  }

  async function updateProfile(updates: Partial<Profile>) {
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()
    if (data) setProfile(data)
  }

  return (
    <AuthContext.Provider value={{
      user, profile, session, loading,
      isDemo: isDemoMode,
      signUp, signIn, signOut, updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Pogrešan email ili lozinka.'
  if (msg.includes('User already registered')) return 'Korisnik s tim emailom već postoji.'
  if (msg.includes('Password should be at least')) return 'Lozinka mora imati najmanje 6 znakova.'
  if (msg.includes('Unable to validate email')) return 'Neispravan email format.'
  return msg
}