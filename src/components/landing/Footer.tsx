import { NAV_LINKS, BRAND } from '../../lib/constants'

export default function Footer() {
  return (
    <footer className="py-12 bg-dark border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Logo + tagline */}
          <div className="text-center sm:text-left">
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-white text-xs font-bold">B</span>
              </div>
              <span className="text-white font-bold">{BRAND.name}</span>
            </div>
            <p className="text-white/30 text-xs mt-2">{BRAND.tagline}</p>
          </div>

          {/* Nav links */}
          <div className="flex gap-6">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-white/40 text-sm hover:text-white/70 transition-colors"
              >
                {link.label}
              </a>
            ))}
            <a
              href={`mailto:${BRAND.email}`}
              className="text-white/40 text-sm hover:text-white/70 transition-colors"
            >
              Kontakt
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/5 text-center">
          <p className="text-white/20 text-xs">
            © {new Date().getFullYear()} {BRAND.name} · Powered by {BRAND.company}
          </p>
        </div>
      </div>
    </footer>
  )
}
