import { PRICING_PLANS } from '../../lib/constants'
import { useScrollReveal } from '../../hooks/useScrollReveal'
import { useLang } from '../../hooks/useLang'

export default function Pricing() {
  const ref = useScrollReveal()
  const { t } = useLang()

  return (
    <section id="pricing" className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={ref} className="reveal text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-text tracking-tight">
            {t('Jednostavne cijene. Bez skrivenih troškova.', 'Simple pricing. No hidden fees.')}
          </h2>
          <p className="mt-4 text-text-muted text-lg">
            {t('14 dana besplatno · Otkazivanje bez kazne', '14 days free · Cancel anytime')}
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {PRICING_PLANS.map((plan, i) => (
            <PricingCard key={i} plan={plan} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

function PricingCard({
  plan,
  index,
}: {
  plan: typeof PRICING_PLANS[number]
  index: number
}) {
  const ref = useScrollReveal(index * 100)
  const { t } = useLang()

  return (
    <div
      ref={ref}
      className={`reveal relative p-6 rounded-2xl border-2 transition-all ${
        plan.highlighted
          ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10 scale-[1.02]'
          : 'border-border bg-white hover:border-primary/30'
      }`}
    >
      {plan.highlighted && 'badge' in plan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-white text-xs font-bold rounded-full">
          {t(plan.badge.hr, plan.badge.en)}
        </div>
      )}

      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-text">{plan.name}</h3>
        <p className="text-text-muted text-sm mt-1">{t(plan.description.hr, plan.description.en)}</p>
        <div className="mt-4">
          <span className="text-4xl font-extrabold text-text">{plan.price}€</span>
          <span className="text-text-muted text-sm">{t(plan.period.hr, plan.period.en)}</span>
        </div>
      </div>

      <ul className="space-y-3 mb-6">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className={f.included ? 'text-primary' : 'text-text-muted/40'}>
              {f.included ? '✓' : '✕'}
            </span>
            <span className={f.included ? 'text-text' : 'text-text-muted/40 line-through'}>
              {t(f.text.hr, f.text.en)}
            </span>
          </li>
        ))}
      </ul>

      <a
        href="/app"
        className={`block w-full py-3 rounded-xl text-center font-semibold text-sm transition-all ${
          plan.highlighted
            ? 'bg-primary text-white hover:bg-primary/90'
            : 'bg-light text-primary hover:bg-primary/10'
        }`}
      >
        {t('Započni besplatno', 'Start for free')}
      </a>
    </div>
  )
}
