import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min
      gcTime: 10 * 60 * 1000, // 10 min
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// Sentry initialization — no-op if VITE_SENTRY_DSN not set
const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
    sendDefaultPii: false,
  })
}
import ProtectedRoute from './components/ProtectedRoute'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import AppSimulation from './pages/AppSimulation'
import EVisitorCheckIn from './pages/EVisitorCheckIn'
import GuestCheckIn from './pages/GuestCheckIn'
import KalendarPage from './pages/app/KalendarPage'
import ApartmaniPage from './pages/app/ApartmaniPage'
import KontaktiPage from './pages/app/KontaktiPage'
import GostiPage from './pages/app/GostiPage'
import EVisitorSettingsPage from './pages/app/EVisitorSettingsPage'
import PostavkePage from './pages/app/PostavkePage'
import RezervacijePage from './pages/app/RezervacijePage'
import DashboardPage from './pages/app/DashboardPage'

function FallbackUI() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="max-w-md text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-text mb-2">Nesto je poslo krivo</h1>
        <p className="text-sm text-text-muted mb-4">
          Dogodila se neocekivana greska. Pokusajte osvjeziti stranicu.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-white font-semibold rounded-lg"
        >
          Osvjezi
        </button>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<FallbackUI />}>
    <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/app/login" element={<LoginPage />} />
          <Route path="/checkin/:token" element={<GuestCheckIn />} />

          {/* Protected app routes */}
          <Route path="/app" element={
            <ProtectedRoute><DashboardPage /></ProtectedRoute>
          } />
          <Route path="/app/chat" element={
            <ProtectedRoute><AppSimulation /></ProtectedRoute>
          } />
          <Route path="/app/rezervacije" element={
            <ProtectedRoute><RezervacijePage /></ProtectedRoute>
          } />
          <Route path="/app/kalendar" element={
            <ProtectedRoute><KalendarPage /></ProtectedRoute>
          } />
          <Route path="/app/apartmani" element={
            <ProtectedRoute><ApartmaniPage /></ProtectedRoute>
          } />
          <Route path="/app/kontakti" element={
            <ProtectedRoute><KontaktiPage /></ProtectedRoute>
          } />
          <Route path="/app/gosti" element={
            <ProtectedRoute><GostiPage /></ProtectedRoute>
          } />
          <Route path="/app/evisitor" element={
            <ProtectedRoute><EVisitorSettingsPage /></ProtectedRoute>
          } />
          <Route path="/app/postavke" element={
            <ProtectedRoute><PostavkePage /></ProtectedRoute>
          } />

          {/* Legacy */}
          <Route path="/evisitor" element={
            <ProtectedRoute><EVisitorCheckIn /></ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
