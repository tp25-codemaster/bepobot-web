import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

type Lang = 'hr' | 'en'

interface LanguageContextValue {
  lang: Lang
  setLang: (l: Lang) => void
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'hr',
  setLang: () => {},
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem('bepobot_lang')
    return stored === 'en' ? 'en' : 'hr'
  })

  const setLang = (l: Lang) => {
    localStorage.setItem('bepobot_lang', l)
    setLangState(l)
  }

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
