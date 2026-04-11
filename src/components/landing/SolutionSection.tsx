import { FEATURES } from '../../lib/constants'
import { useScrollReveal } from '../../hooks/useScrollReveal'

export default function SolutionSection() {
  const ref = useScrollReveal()

  return (
    <section id="features" className="py-20 sm:py-28 bg-light">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={ref} className="reveal text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-text tracking-tight">
            BepoBot — AI koji sve pamti umjesto vas.
          </h2>
          <p className="mt-4 text-text-muted text-lg leading-relaxed">
            Kažete botu jednom porukom što treba. On odradi sve ostalo.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feature, i) => (
            <FeatureCard key={i} {...feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureCard({
  icon,
  title,
  description,
  example,
  index,
}: {
  icon: string
  title: string
  description: string
  example: string
  index: number
}) {
  const ref = useScrollReveal(index * 80)

  return (
    <div
      ref={ref}
      className="reveal group bg-white p-6 rounded-2xl border border-border hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
    >
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-bold text-text mb-2">{title}</h3>
      <p className="text-sm text-text-muted leading-relaxed mb-4">{description}</p>

      {/* Example chat bubble */}
      <div className="bg-primary/5 border border-primary/10 rounded-xl px-3.5 py-2.5">
        <div className="flex items-start gap-2">
          <span className="text-primary text-xs mt-0.5">💬</span>
          <p className="text-xs text-primary/80 italic leading-relaxed">"{example}"</p>
        </div>
      </div>
    </div>
  )
}
