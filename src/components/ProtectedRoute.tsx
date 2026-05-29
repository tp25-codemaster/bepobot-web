import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, isDemo } = useAuth()
  const location = useLocation()

  if (isDemo) return <>{children}</>

  if (!user && !loading) return <Navigate to="/app/login" replace />

  // Wait for both auth and profile to load before rendering
  if (loading || (user && !profile)) {
    return (
      <div className="min-h-svh bg-light flex items-center justify-center">
        <div className="text-primary font-semibold">Ucitavanje...</div>
      </div>
    )
  }

  // Redirect to onboarding if not complete — except when already there
  const isOnboarding = location.pathname === '/onboarding'
  if (!isOnboarding && profile && !profile.onboarding_complete) {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}
