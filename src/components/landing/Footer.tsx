import { NAV_LINKS, BRAND } from '../../lib/constants'
import { useLang } from '../../hooks/useLang'

export default function Footer() {
  const { t } = useLang()

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
            <p className="text-white/30 text-xs mt-2">{t(BRAND.tagline.hr, BRAND.tagline.en)}</p>
          </div>

          {/* Nav links */}
          <div className="flex gap-6">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-white/40 text-sm hover:text-white/70 transition-colors"
              >
                {t(link.label.hr, link.label.en)}
              </a>
            ))}
            <a
              href={`mailto:${BRAND.email}`}
              className="text-white/40 text-sm hover:text-white/70 transition-colors"
            >
              {t('Kontakt', 'Contact')}
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-white/20 text-xs">
            © {new Date().getFullYear()} {BRAND.name} · Powered by {BRAND.company}
          </p>
          <div className="flex gap-4">
            <a href="/privacy" className="text-white/20 text-xs hover:text-white/50 transition-colors">
              {t('Privatnost', 'Privacy')}
            </a>
            <a href="/terms" className="text-white/20 text-xs hover:text-white/50 transition-colors">
              {t('Uvjeti korištenja', 'Terms of use')}
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
