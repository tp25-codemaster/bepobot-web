import { useState } from 'react'
import { useScrollReveal } from '../../hooks/useScrollReveal'
import { supabase } from '../../lib/supabase'
import { useLang } from '../../hooks/useLang'

export default function FinalCta() {
  const ref = useScrollReveal()
  const { t } = useLang()
  const [email, setEmail] = useState('')
  const [apartments, setApartments] = useState('1')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)

    await supabase.from('waitlist').insert({
      email: email.trim(),
      apartments,
    })

    setSubmitted(true)
    setLoading(false)
  }

  return (
    <section className="py-20 sm:py-28 bg-gradient-to-br from-dark via-dark to-primary">
      <div ref={ref} className="reveal max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          {t('Spremni preuzeti kontrolu?', 'Ready to take control?')}
        </h2>
        <p className="mt-4 text-white/60 text-lg">
          {t('14 dana besplatno. Bez kartice. Otkazite kad zelite.', '14 days free. No credit card. Cancel anytime.')}
        </p>

        {submitted ? (
          <div className="mt-8 bg-white/10 backdrop-blur rounded-xl p-6">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-white font-semibold">
              {t('Hvala! Javit cemo vam se uskoro.', "Thanks! We'll be in touch soon.")}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 bg-white/10 backdrop-blur rounded-xl p-6 text-left space-y-4">
            <div>
              <label className="block text-white/70 text-sm mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('vas@email.com', 'you@email.com')}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:border-primary-light focus:ring-1 focus:ring-primary-light outline-none"
              />
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-1">
                {t('Koliko apartmana imate?', 'How many apartments do you have?')}
              </label>
              <select
                value={apartments}
                onChange={e => setApartments(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white outline-none"
              >
                <option value="1" className="text-dark">1</option>
                <option value="2-5" className="text-dark">2-5</option>
                <option value="6-10" className="text-dark">6-10</option>
                <option value="10+" className="text-dark">10+</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary-light text-dark font-bold text-lg rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
            >
              {loading
                ? t('Saljem...', 'Sending...')
                : t('Prijavi se na listu cekanja', 'Join the waitlist')}
            </button>
          </form>
        )}

        <a
          href="/app/login"
          className="mt-6 inline-block text-white/50 text-sm hover:text-white transition-colors"
        >
          {t('Ili kreiraj account odmah →', 'Or create an account now →')}
        </a>
      </div>
    </section>
  )
}
