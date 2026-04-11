import { useScrollReveal } from '../../hooks/useScrollReveal'

export default function FinalCta() {
  const ref = useScrollReveal()

  return (
    <section className="py-20 sm:py-28 bg-gradient-to-br from-dark via-dark to-primary">
      <div ref={ref} className="reveal max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Spremni preuzeti kontrolu?
        </h2>
        <p className="mt-4 text-white/60 text-lg">
          14 dana besplatno. Bez kartice. Otkažite kad želite.
        </p>
        <a
          href="/app"
          className="mt-8 inline-block px-10 py-4 bg-primary-light text-dark font-bold text-lg rounded-xl hover:brightness-110 transition-all hover:shadow-lg hover:shadow-primary-light/20"
        >
          Kreiraj account
        </a>
      </div>
    </section>
  )
}
