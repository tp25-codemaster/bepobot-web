import { PROBLEMS } from '../../lib/constants'
import { useScrollReveal } from '../../hooks/useScrollReveal'

export default function ProblemSection() {
  const ref = useScrollReveal()

  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={ref} className="reveal text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-text tracking-tight">
            Poznajete li ovaj osjećaj?
          </h2>
          <p className="mt-4 text-text-muted text-lg leading-relaxed">
            Iznajmljivanje apartmana trebalo bi biti pasivni prihod. Umjesto toga, svaki dan trošite na mailove, poruke i koordinaciju.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          {PROBLEMS.map((problem, i) => (
            <ProblemCard key={i} {...problem} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

function ProblemCard({
  icon,
  title,
  description,
  index,
}: {
  icon: string
  title: string
  description: string
  index: number
}) {
  const ref = useScrollReveal(index * 100)

  return (
    <div
      ref={ref}
      className="reveal group p-6 rounded-2xl border-2 border-danger-border/40 bg-danger-light/30 hover:border-danger-border/70 transition-all duration-300"
    >
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-bold text-text mb-2">{title}</h3>
      <p className="text-sm text-text-muted leading-relaxed">{description}</p>
    </div>
  )
}
