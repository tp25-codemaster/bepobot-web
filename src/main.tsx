import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import AppSimulation from './pages/AppSimulation'
import EVisitorCheckIn from './pages/EVisitorCheckIn'
import GuestCheckIn from './pages/GuestCheckIn'
import KalendarPage from './pages/app/KalendarPage'
import ApartmaniPage from './pages/app/ApartmaniPage'
import KontaktiPage from './pages/app/KontaktiPage'
import EVisitorSettingsPage from './pages/app/EVisitorSettingsPage'
import PostavkePage from './pages/app/PostavkePage'
import RezervacijePage from './pages/app/RezervacijePage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/app/login" element={<LoginPage />} />
          <Route path="/checkin/:token" element={<GuestCheckIn />} />

          {/* Protected app routes */}
          <Route path="/app" element={
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
  </StrictMode>,
)
