// Pure translation engine shared by the renderer and the main process.
// Each process supplies its own dictionary; this module only resolves keys.

// Walk a dotted key ("order.total") into a nested dictionary object.
const resolve = (dict, key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dict)

/**
 * Resolve a dotted key for a language, falling back to English, then to the key
 * itself, and finally interpolating {placeholder} tokens from `vars`.
 * @param {object} dict - full dictionary keyed by language ({ en, fr, ar, ... })
 * @param {string} lang - requested language code
 * @param {string} key - dotted key path
 * @param {Record<string, unknown>} [vars] - placeholder values
 */
export function translate(dict, lang, key, vars) {
  let s = resolve(dict[lang], key)
  if (s == null) s = resolve(dict.en, key)
  if (s == null) return key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
  return s
}
