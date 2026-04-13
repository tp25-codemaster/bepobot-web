import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        navigate('/app', { replace: true })
      }
    })

    // Fallback — if already signed in from the URL hash
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/app', { replace: true })
      } else {
        // No session, go to login
        navigate('/app/login', { replace: true })
      }
    })
  }, [navigate])

  return (
    <div className="min-h-svh bg-light flex items-center justify-center">
      <div className="text-primary font-semibold">Prijava u tijeku...</div>
    </div>
  )
}
