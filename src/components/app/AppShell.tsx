import { useState } from 'react'
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
  useSwipeMenu({ onOpen: () => setMenuOpen(true), onClose: () => setMenuOpen(false), isOpen: menuOpen })

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-primary flex-shrink-0 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen(true)}
              className="w-8 h-8 flex items-center justify-center text-white"
              aria-label="Otvori meni"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <div className="text-white font-semibold text-sm">{title}</div>
          </div>
          <button
            onClick={() => navigate('/app')}
            className="text-white/60 text-sm hover:text-white transition-colors"
          >
            Chat
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>

      {/* Side menu */}
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  )
}
