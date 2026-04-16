import { useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import SideMenu from './SideMenu'
import { useSwipeMenu } from '../../hooks/useSwipeMenu'

interface AppShellProps {
  title: string
  children: React.ReactNode
}

export default function AppShell({ title, children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const hamburgerRef = useRef<HTMLButtonElement>(null)
  useSwipeMenu({ onOpen: () => setMenuOpen(true), onClose: () => setMenuOpen(false), isOpen: menuOpen })

  function handleCloseMenu() {
    setMenuOpen(false)
    // Vrati fokus na hamburger button kad se menu zatvori
    hamburgerRef.current?.focus()
  }

  const isOnDashboard = location.pathname === '/app'

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-primary flex-shrink-0 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button
              ref={hamburgerRef}
              onClick={() => setMenuOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Otvori izbornik"
              aria-expanded={menuOpen}
              aria-controls="side-menu"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
                <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <div className="text-white font-semibold text-sm tracking-tight" aria-hidden="true">{title}</div>
          </div>
          {!isOnDashboard && (
            <button
              onClick={() => navigate('/app')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white/80 text-xs font-medium hover:bg-white/20 hover:text-white transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Početna
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <main id="main-content" className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* Side menu */}
      <SideMenu open={menuOpen} onClose={handleCloseMenu} />
    </div>
  )
}
