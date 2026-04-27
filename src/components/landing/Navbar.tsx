import { useState, useEffect } from 'react'
import { NAV_LINKS } from '../../lib/constants'
import { useLang } from '../../hooks/useLang'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { lang, setLang } = useLang()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 pt-[env(safe-area-inset-top)] ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-border'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-12 sm:h-16">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white text-sm font-bold">B</span>
            </div>
            <span
              className={`text-lg font-bold transition-colors ${
                scrolled ? 'text-dark' : 'text-white'
              }`}
            >
              BepoBot
            </span>
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  scrolled ? 'text-text-muted' : 'text-white/80'
                }`}
              >
                {link.label}
              </a>
            ))}
            {/* Language toggle */}
            <button
              onClick={() => setLang(lang === 'hr' ? 'en' : 'hr')}
              className={`text-xs font-semibold tracking-widest transition-colors ${
                scrolled ? 'text-text-muted hover:text-primary' : 'text-white/60 hover:text-white'
              }`}
              aria-label="Switch language"
            >
              {lang === 'hr' ? 'HR|EN' : 'EN|HR'}
            </button>
            <a
              href="/app"
              className="px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
            >
              {lang === 'hr' ? 'Isprobaj besplatno' : 'Try for free'}
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2"
            aria-label="Menu"
          >
            <div className="w-6 flex flex-col gap-1.5">
              <span
                className={`block h-0.5 rounded transition-all ${
                  scrolled ? 'bg-dark' : 'bg-white'
                } ${menuOpen ? 'rotate-45 translate-y-2' : ''}`}
              />
              <span
                className={`block h-0.5 rounded transition-all ${
                  scrolled ? 'bg-dark' : 'bg-white'
                } ${menuOpen ? 'opacity-0' : ''}`}
              />
              <span
                className={`block h-0.5 rounded transition-all ${
                  scrolled ? 'bg-dark' : 'bg-white'
                } ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-border shadow-lg">
          <div className="px-4 py-4 flex flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="text-sm font-medium text-text-muted hover:text-primary py-2"
              >
                {link.label}
              </a>
            ))}
            <button
              onClick={() => setLang(lang === 'hr' ? 'en' : 'hr')}
              className="py-2 text-xs font-semibold tracking-widest text-text-muted hover:text-primary transition-colors text-left"
            >
              {lang === 'hr' ? 'HR | EN' : 'EN | HR'}
            </button>
            <a
              href="/app"
              className="mt-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg text-center hover:bg-primary/90 transition-colors"
            >
              {lang === 'hr' ? 'Isprobaj besplatno' : 'Try for free'}
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}
