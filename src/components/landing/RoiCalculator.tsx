import { useState } from 'react'
import { useScrollReveal } from '../../hooks/useScrollReveal'
import { useLang } from '../../hooks/useLang'

export default function RoiCalculator() {
  const ref = useScrollReveal()
  const { t } = useLang()
  const [apartments, setApartments] = useState(3)
  const [hours, setHours] = useState(20)
  const [rate, setRate] = useState(10)

  const planPrice = apartments <= 1 ? 89 : apartments <= 5 ? 149 : 299
  const annualWithout = hours * rate * 52
  const annualWith = planPrice * 12
  const savings = annualWithout - annualWith
  const weekends = Math.round(savings / (rate * 8))

  return (
    <section className="py-20 sm:py-28 bg-gradient-to-br from-dark via-dark to-primary">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={ref} className="reveal">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight text-center mb-12">
            {t('Koliko ćete uštedjeti?', 'How much will you save?')}
          </h2>

          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-white/10">
            <div className="space-y-8">
              <SliderField
                label={t('Koliko apartmana imate?', 'How many apartments do you have?')}
                value={apartments}
                onChange={setApartments}
                min={1}
                max={20}
                suffix=""
              />
              <SliderField
                label={t('Sati tjedno na administraciju?', 'Hours per week on admin?')}
                value={hours}
                onChange={setHours}
                min={5}
                max={40}
                suffix="h"
              />
              <SliderField
                label={t('Vaša satnica (€)?', 'Your hourly rate (€)?')}
                value={rate}
                onChange={setRate}
                min={5}
                max={30}
                suffix="€"
              />
            </div>

            <div className="mt-10 pt-8 border-t border-white/10">
              <div className="grid sm:grid-cols-2 gap-6 text-center">
                <div>
                  <div className="text-white/50 text-sm mb-1">{t('Bez BepoBota', 'Without BepoBot')}</div>
                  <div className="text-2xl font-bold text-danger-border">
                    {annualWithout.toLocaleString('hr-HR')}€<span className="text-sm font-normal">{t('/god', '/yr')}</span>
                  </div>
                  <div className="text-xs text-white/30 mt-1">{t('izgubljene vrijednosti', 'lost value')}</div>
                </div>
                <div>
                  <div className="text-white/50 text-sm mb-1">{t('Sa BepoBotom', 'With BepoBot')}</div>
                  <div className="text-2xl font-bold text-primary-light">
                    {annualWith.toLocaleString('hr-HR')}€<span className="text-sm font-normal">{t('/god', '/yr')}</span>
                  </div>
                  <div className="text-xs text-white/30 mt-1">{planPrice}€{t('/mj plan', '/mo plan')}</div>
                </div>
              </div>

              {savings > 0 && (
                <div className="mt-8 text-center">
                  <div className="text-4xl sm:text-5xl font-extrabold text-primary-light animate-pulse">
                    {savings.toLocaleString('hr-HR')}€
                  </div>
                  <div className="text-white/60 mt-2">{t('uštede godišnje', 'saved per year')}</div>
                  <div className="text-sm text-white/40 mt-1">
                    {t(`To je ${weekends} slobodnih vikenda.`, `That's ${weekends} free weekends.`)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  suffix: string
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <span className="text-white/80 text-sm">{label}</span>
        <span className="text-primary-light font-bold text-lg">
          {value}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-light [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary-light [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:cursor-pointer"
      />
    </div>
  )
}
