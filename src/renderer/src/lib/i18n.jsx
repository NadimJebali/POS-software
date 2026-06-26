import { createContext, useContext, useEffect, useMemo } from 'react'
import { useSettings } from './settings'
import { locales } from './locales'
import { translate } from '../../../shared/i18n'

const Ctx = createContext(null)
const RTL_LANGS = new Set(['ar'])

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
    // Renderer adapter over the shared engine: resolve against the UI dictionary,
    // English fallback, then {placeholder} interpolation.
    const t = (key, vars) => translate(locales, lang, key, vars)
    return { t, lang, dir }
  }, [lang, dir])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useT() {
  return useContext(Ctx)
}
