import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SideMenu from './SideMenu'
import { useSwipeMenu } from '../../hooks/useSwipeMenu'

interface AppShellProps {
  title: string
  children: React.ReactNode
}

export default function AppShell({ title, children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const hamburgerRef = useRef<HTMLButtonElement>(null)
  useSwipeMenu({ onOpen: () => setMenuOpen(true), onClose: () => setMenuOpen(false), isOpen: menuOpen })

  function handleCloseMenu() {
    setMenuOpen(false)
    // Vrati fokus na hamburger button kad se menu zatvori
    hamburgerRef.current?.focus()
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-primary flex-shrink-0 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button
              ref={hamburgerRef}
              onClick={() => setMenuOpen(true)}
              className="w-8 h-8 flex items-center justify-center text-white"
              aria-label="Otvori izbornik"
              aria-expanded={menuOpen}
              aria-controls="side-menu"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
                <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <div className="text-white font-semibold text-sm" aria-hidden="true">{title}</div>
          </div>
          <button
            onClick={() => navigate('/app')}
            className="text-white/60 text-sm hover:text-white transition-colors"
          >
            Chat
          </button>
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
