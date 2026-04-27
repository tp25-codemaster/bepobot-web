import { useLanguage } from '../contexts/LanguageContext'

export function useLang() {
  const { lang, setLang } = useLanguage()
  const t = (hr: string, en: string) => (lang === 'hr' ? hr : en)
  return { lang, setLang, t }
}
