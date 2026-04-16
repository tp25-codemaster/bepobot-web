import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isDemo } = useAuth()

  if (loading) {
    return (
      <div className="min-h-svh bg-light flex items-center justify-center">
        <div className="text-primary font-semibold">Ucitavanje...</div>
      </div>
    )
  }

  // Demo mode: allow access without auth
  if (isDemo) return <>{children}</>

  if (!user) return <Navigate to="/app/login" replace />

  return <>{children}</>
}
