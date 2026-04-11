import { STEPS } from '../../lib/constants'
import { useScrollReveal } from '../../hooks/useScrollReveal'

export default function HowItWorks() {
  const ref = useScrollReveal()

  return (
    <section id="how-it-works" className="py-20 sm:py-28 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={ref} className="reveal text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-text tracking-tight">
            Postavljeno za 3 dana. Radi zauvijek.
          </h2>
        </div>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-primary/20" />

          <div className="space-y-12">
            {STEPS.map((step, i) => (
              <StepItem key={i} {...step} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function StepItem({
  number,
  title,
  description,
  index,
}: {
  number: string
  title: string
  description: string
  index: number
}) {
  const ref = useScrollReveal(index * 150)

  return (
    <div ref={ref} className="reveal flex gap-6">
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm z-10 relative">
          {number}
        </div>
      </div>
      <div className="pt-2">
        <h3 className="text-xl font-bold text-text mb-2">{title}</h3>
        <p className="text-text-muted leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
