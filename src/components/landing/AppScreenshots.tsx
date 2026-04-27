import { useState } from 'react'
import { useLang } from '../../hooks/useLang'
import { useScrollReveal } from '../../hooks/useScrollReveal'

const TABS = [
  {
    id: 'pocetna',
    labelHr: 'Početna',
    labelEn: 'Dashboard',
    src: '/screenshots/screen-pocetna.jpg',
  },
  {
    id: 'rezervacije',
    labelHr: 'Rezervacije',
    labelEn: 'Reservations',
    src: '/screenshots/screen-rezervacije.jpg',
  },
  {
    id: 'kalendar',
    labelHr: 'Kalendar',
    labelEn: 'Calendar',
    src: '/screenshots/screen-kalendar.jpg',
  },
  {
    id: 'nav',
    labelHr: 'Navigacija',
    labelEn: 'Navigation',
    src: '/screenshots/screen-nav.jpg',
  },
]

export default function AppScreenshots() {
  const { t } = useLang()
  const [active, setActive] = useState(0)
  const ref = useScrollReveal()

  return (
    <section className="py-20 sm:py-28 bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={ref} className="reveal text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            {t('Sve na jednom mjestu', 'Everything in one place')}
          </h2>
          <p className="mt-4 text-white/50 text-lg max-w-xl mx-auto">
            {t(
              'Intuitivno sučelje koje možeš koristiti s mobitela u sekundi.',
              'An intuitive interface you can use from your phone in seconds.',
            )}
          </p>
        </div>

        {/* Tab bar — horizontally scrollable on mobile */}
        <div className="flex overflow-x-auto gap-2 mb-8 pb-1 justify-start sm:justify-center scrollbar-hide">
          {TABS.map((tab, i) => (
            <button
              key={tab.id}
              onClick={() => setActive(i)}
              className={`flex-shrink-0 px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                active === i
                  ? 'bg-primary text-white shadow-lg shadow-primary/30'
                  : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
              }`}
            >
              {t(tab.labelHr, tab.labelEn)}
            </button>
          ))}
        </div>

        {/* Screenshot frame */}
        <div className="flex justify-center">
          <div className="relative w-[280px] sm:w-[320px]">
            {/* Phone shell */}
            <div className="relative rounded-[2.5rem] overflow-hidden border-[6px] border-white/10 bg-slate-800 shadow-2xl shadow-black/60">
              {/* Dynamic island */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-full z-10" />

              {/* Screenshot */}
              {TABS.map((tab, i) => (
                <img
                  key={tab.id}
                  src={tab.src}
                  alt={t(tab.labelHr, tab.labelEn)}
                  className={`w-full aspect-[9/19.5] object-cover object-top transition-opacity duration-300 ${
                    active === i ? 'opacity-100' : 'opacity-0 absolute inset-0'
                  }`}
                />
              ))}
            </div>

            {/* Glow */}
            <div className="absolute -inset-4 bg-primary/10 rounded-full blur-3xl -z-10" />
          </div>
        </div>
      </div>
    </section>
  )
}
