import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../hooks/useLang'
import { supabase } from '../lib/supabase'
import Navbar from '../components/landing/Navbar'
import HeroChatDemo from '../components/landing/HeroChatDemo'
import ProblemSection from '../components/landing/ProblemSection'
import SolutionSection from '../components/landing/SolutionSection'
import HowItWorks from '../components/landing/HowItWorks'
import AppScreenshots from '../components/landing/AppScreenshots'
import RoiCalculator from '../components/landing/RoiCalculator'
import Testimonials from '../components/landing/Testimonials'
import Pricing from '../components/landing/Pricing'
import Faq from '../components/landing/Faq'
import FinalCta from '../components/landing/FinalCta'
import Footer from '../components/landing/Footer'

export default function LandingPage() {
  const navigate = useNavigate()
  const { t } = useLang()

  // Handle Supabase auth callback (email confirmation redirect)
  useEffect(() => {
    if (window.location.hash.includes('access_token')) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) navigate('/app', { replace: true })
      })
    }
  }, [navigate])

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative min-h-screen flex items-center bg-gradient-to-br from-dark via-dark to-primary overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] tracking-tight">
                {t('Vaš apartman radi dok vi uživate.', 'Your apartment works while you enjoy.')}
              </h1>
              <p className="mt-6 text-lg sm:text-xl text-white/60 max-w-xl leading-relaxed">
                {t(
                  'AI asistent koji automatizira rezervacije, koordinira čišćenje i brine o gostima — sve putem jedne poruke.',
                  'AI assistant that automates bookings, coordinates cleaning and takes care of guests — all through one message.',
                )}
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <a
                  href="/app"
                  className="px-8 py-4 bg-white text-primary font-bold rounded-xl text-center hover:bg-white/90 transition-all hover:shadow-lg hover:shadow-white/20"
                >
                  Započni besplatno 14 dana
                </a>
                <a
                  href="#how-it-works"
                  className="px-8 py-4 border-2 border-white/20 text-white font-semibold rounded-xl text-center hover:border-white/40 hover:bg-white/5 transition-all"
                >
                  Pogledaj kako radi
                </a>
              </div>

              <div className="mt-12 flex gap-8 sm:gap-12">
                <div>
                  <div className="text-3xl font-extrabold text-primary-light">22h</div>
                  <div className="text-xs text-white/40 mt-1">uštede tjedno</div>
                </div>
                <div>
                  <div className="text-3xl font-extrabold text-primary-light">3 min</div>
                  <div className="text-xs text-white/40 mt-1">do check-in infoa</div>
                </div>
                <div>
                  <div className="text-3xl font-extrabold text-primary-light">0€</div>
                  <div className="text-xs text-white/40 mt-1">ekstra osoblja</div>
                </div>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <HeroChatDemo />
            </div>
          </div>
        </div>
      </section>

      <ProblemSection />
      <SolutionSection />
      <AppScreenshots />
      <HowItWorks />
      <RoiCalculator />
      <Testimonials />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  )
}
