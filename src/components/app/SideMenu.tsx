import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

interface SideMenuProps {
  open: boolean
  onClose: () => void
}

const menuItems = [
  { path: '/app', icon: '🏠', label: 'Pocetna' },
  { path: '/app/chat', icon: '💬', label: 'Chat' },
  { path: '/app/rezervacije', icon: '📋', label: 'Rezervacije' },
  { path: '/app/kalendar', icon: '📅', label: 'Kalendar' },
  { path: '/app/apartmani', icon: '🏠', label: 'Moji apartmani' },
  { path: '/app/kontakti', icon: '👥', label: 'Kontakti' },
  { path: '/app/gosti', icon: '🧳', label: 'Gosti (CRM)' },
  { path: '/app/evisitor', icon: '🏛️', label: 'eVisitor' },
  { path: '/app/postavke', icon: '⚙️', label: 'Postavke' },
]

export default function SideMenu({ open, onClose }: SideMenuProps) {
  const location = useLocation()
  const { user, profile, isDemo } = useAuth()

  // Close on escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 bottom-0 w-72 bg-white z-50 shadow-2xl transition-transform duration-300 ease-out flex flex-col ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* User info */}
        <div className="bg-primary p-5 pt-[calc(env(safe-area-inset-top)+20px)]">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-3">
            <span className="text-white text-xl font-bold">
              {profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'D'}
            </span>
          </div>
          <div className="text-white font-semibold">
            {profile?.full_name || (isDemo ? 'Demo korisnik' : user?.email || 'Korisnik')}
          </div>
          <div className="text-white/70 text-sm truncate">
            {isDemo ? 'demo@bepobot.hr' : user?.email || ''}
          </div>
          {profile?.plan && (
            <span className="inline-block mt-2 px-2 py-0.5 bg-white/15 text-white text-xs font-medium rounded-full capitalize">
              {profile.plan === 'trial' ? '14 dana trial' : profile.plan}
            </span>
          )}
        </div>

        {/* Menu items */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary border-r-3 border-primary'
                    : 'text-text hover:bg-gray-50'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Support */}
        <div className="border-t border-border p-4">
          <a
            href="mailto:info@bepobot.hr"
            className="flex items-center gap-3 px-1 py-2 text-sm text-text-muted hover:text-primary transition-colors"
          >
            <span className="text-lg">🆘</span>
            Podrska
          </a>
        </div>
      </div>
    </>
  )
}
