import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isDemo } = useAuth()

  if (loading) {
    return (
      <div className="min-h-svh bg-light flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <div className="text-primary font-semibold text-sm">Učitavanje...</div>
        </div>
      </div>
    )
  }

  // Demo mode: allow access without auth
  if (isDemo) return <>{children}</>

  if (!user) return <Navigate to="/app/login" replace />

  return <>{children}</>
}
