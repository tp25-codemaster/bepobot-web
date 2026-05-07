import { TESTIMONIALS } from '../../lib/constants'
import { useScrollReveal } from '../../hooks/useScrollReveal'
import { useLang } from '../../hooks/useLang'

export default function Testimonials() {
  const ref = useScrollReveal()
  const { t } = useLang()

  return (
    <section className="py-20 sm:py-28 bg-light">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={ref} className="reveal text-center mb-12">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
            {t('Beta korisnici kažu', 'Beta users say')}
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-text tracking-tight">
            {t('Ne vjerujte nama — vjerujte njima.', "Don't take our word for it.")}
          </h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          {TESTIMONIALS.map((item, i) => (
            <TestimonialCard
              key={i}
              name={item.name}
              detail={item.detail}
              quote={t(item.quote.hr, item.quote.en)}
              index={i}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function TestimonialCard({
  name,
  detail,
  quote,
  index,
}: {
  name: string
  detail: string
  quote: string
  index: number
}) {
  const ref = useScrollReveal(index * 100)

  return (
    <div
      ref={ref}
      className="reveal bg-white p-6 rounded-2xl border border-border"
    >
      <div className="text-primary text-3xl mb-4">"</div>
      <p className="text-text font-medium text-lg leading-relaxed mb-6">{quote}</p>
      <div>
        <div className="font-semibold text-text text-sm">{name}</div>
        <div className="text-text-muted text-xs">{detail}</div>
      </div>
    </div>
  )
}
