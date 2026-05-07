import { useState } from 'react'
import { FAQ_ITEMS } from '../../lib/constants'
import { useScrollReveal } from '../../hooks/useScrollReveal'
import { useLang } from '../../hooks/useLang'

export default function Faq() {
  const ref = useScrollReveal()
  const { t } = useLang()

  return (
    <section id="faq" className="py-20 sm:py-28 bg-light">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={ref} className="reveal text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-text tracking-tight">
            {t('Česta pitanja', 'Frequently asked questions')}
          </h2>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <FaqItem
              key={i}
              question={t(item.question.hr, item.question.en)}
              answer={t(item.answer.hr, item.answer.en)}
              index={i}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function FaqItem({
  question,
  answer,
  index,
}: {
  question: string
  answer: string
  index: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useScrollReveal(index * 60)

  return (
    <div
      ref={ref}
      className="reveal bg-white rounded-xl border border-border overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left min-h-[52px]"
      >
        <span className="text-sm font-semibold text-text pr-4">{question}</span>
        <span
          className={`text-text-muted text-lg transition-transform flex-shrink-0 ${
            open ? 'rotate-45' : ''
          }`}
        >
          +
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          open ? 'max-h-40 pb-4' : 'max-h-0'
        }`}
      >
        <p className="px-5 text-sm text-text-muted leading-relaxed">{answer}</p>
      </div>
    </div>
  )
}
