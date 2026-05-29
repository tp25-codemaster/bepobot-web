import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, profileLoading, isDemo } = useAuth()
  const location = useLocation()

  if (isDemo) return <>{children}</>

  // Block rendering until we know who the user is AND where to send them.
  // profileLoading stays true from the moment a user is detected until the
  // profile fetch resolves, so no protected page can render in the gap.
  if (loading || profileLoading) {
    return (
      <div className="min-h-svh bg-light flex items-center justify-center">
        <div className="text-primary font-semibold">Ucitavanje...</div>
      </div>
    )
  }

  if (!user) return <Navigate to="/app/login" replace />

  // Redirect to onboarding if not complete — except when already there
  const isOnboarding = location.pathname === '/onboarding'
  if (!isOnboarding && profile && !profile.onboarding_complete) {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}
