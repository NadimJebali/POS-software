import { createContext, useContext, useEffect, useMemo } from 'react'
import { useSettings } from './settings'
import { locales } from './locales'

const Ctx = createContext(null)
const RTL_LANGS = new Set(['ar'])

const resolve = (dict, key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dict)

export function I18nProvider({ children }) {
  const { settings } = useSettings()
  const lang = locales[settings.language] ? settings.language : 'en'
  const dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr'

  // Reflect language + direction on the document so the whole layout mirrors for RTL.
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
  }, [lang, dir])

  const value = useMemo(() => {
    // t('a.b', { n: 3 }) → looks up the key, falls back to English, then the key itself,
    // and fills {placeholders} from vars.
    const t = (key, vars) => {
      let s = resolve(locales[lang], key)
      if (s == null) s = resolve(locales.en, key)
      if (s == null) return key
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
      return s
    }
    return { t, lang, dir }
  }, [lang, dir])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useT() {
  return useContext(Ctx)
}
