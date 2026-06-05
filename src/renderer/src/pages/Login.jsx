import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useSettings } from '../lib/settings'
import { useT } from '../lib/i18n'
import { IconBack } from '../components/icons'

const pad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

export default function Login() {
  const { login } = useAuth()
  const { settings } = useSettings()
  const { t } = useT()
  const [users, setUsers] = useState([])
  const [selected, setSelected] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [lockUntil, setLockUntil] = useState(0) // ms timestamp; 0 = not locked
  const [remaining, setRemaining] = useState(0) // seconds left on the lockout

  useEffect(() => {
    api.auth.users().then(setUsers).catch(() => setUsers([]))
  }, [])

  // Live countdown while locked out; clears itself when it reaches zero.
  useEffect(() => {
    if (!lockUntil) return
    const tick = () => {
      const secs = Math.ceil((lockUntil - Date.now()) / 1000)
      if (secs <= 0) {
        setLockUntil(0)
        setRemaining(0)
        setError('')
      } else {
        setRemaining(secs)
      }
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [lockUntil])

  const locked = lockUntil > 0 && remaining > 0

  const press = (k) => {
    if (locked) return
    setError('')
    if (k === '⌫') return setPin((p) => p.slice(0, -1))
    if (k === '' || pin.length >= 8) return
    setPin((p) => p + k)
  }

  const submit = async () => {
    if (pin.length < 4 || !selected || locked) return
    setBusy(true)
    try {
      await login(selected.username, pin)
    } catch (e) {
      const msg = e.message || 'Login failed'
      // Server returns "Too many attempts. Try again in Ns" — start the lockout timer.
      const m = /too many attempts.*?(\d+)s/i.exec(msg)
      if (m) setLockUntil(Date.now() + parseInt(m[1], 10) * 1000)
      setError(msg)
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  const monogram = (settings.shop_name || 'P').trim().charAt(0).toUpperCase()

  return (
    <div className="h-screen flex items-center justify-center p-8">
      <div className="card w-[860px] max-w-full p-8 grid grid-cols-2 gap-8 animate-pop">
        {/* brand + staff picker */}
        <div className="flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center font-display text-3xl text-[#2a1c0c]"
              style={{ background: 'linear-gradient(135deg,#f7b96b,#ec9a45)' }}
            >
              {monogram}
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold leading-none">{settings.shop_name}</h1>
              <p className="text-muted text-sm mt-1">{t('login.title')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 overflow-y-auto pr-1 content-start flex-1">
            {users.map((u) => (
              <button
                key={u.id}
                disabled={locked}
                onClick={() => {
                  setSelected(u)
                  setPin('')
                  setError('')
                }}
                className={`p-4 rounded-2xl border text-left transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  selected?.id === u.id ? 'border-ember bg-ember/10 shadow-glow' : 'border-line bg-surface2 hover:bg-surface3'
                }`}
              >
                <div className="font-semibold truncate">{u.name || u.username}</div>
                <div className={`text-xs mt-0.5 ${u.role === 'admin' ? 'text-ember' : 'text-muted'}`}>
                  {u.role === 'admin' ? t('login.administrator') : t('login.cashier')}
                </div>
              </button>
            ))}
            {users.length === 0 && <p className="text-muted col-span-2">{t('login.noUsers')}</p>}
          </div>
        </div>

        {/* PIN pad */}
        <div className="flex flex-col">
          {selected ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <button className="btn-ghost px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed" disabled={locked} onClick={() => setSelected(null)}>
                  <IconBack width={18} height={18} />
                </button>
                <span className="text-muted">
                  {t('login.enterPinFor')} <span className="text-cream font-semibold">{selected.name || selected.username}</span>
                </span>
              </div>

              <div className="flex justify-center gap-3 my-5 h-8">
                {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-4 h-4 rounded-full transition ${i < pin.length ? 'bg-ember' : 'bg-surface3'}`}
                  />
                ))}
              </div>

              {locked ? (
                <div className="mb-3 rounded-xl bg-berry/15 border border-berry/40 px-4 py-2.5 text-center">
                  <div className="text-berry font-semibold">{t('login.tooMany')}</div>
                  <div className="text-cream text-sm tnum">{t('login.lockedTryAgain', { n: remaining })}</div>
                </div>
              ) : (
                error && <p className="text-berry text-center text-sm mb-3">{error}</p>
              )}

              <div dir="ltr" className="grid grid-cols-3 gap-2.5">
                {pad.map((k, i) => (
                  <button
                    key={i}
                    disabled={k === '' || locked}
                    onClick={() => press(k)}
                    className={
                      k === ''
                        ? 'h-[64px] opacity-0 pointer-events-none'
                        : 'h-[64px] rounded-2xl text-2xl font-display font-semibold transition active:scale-95 bg-surface2 border border-line hover:bg-surface3 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100'
                    }
                  >
                    {k}
                  </button>
                ))}
              </div>

              <button className="btn-accent mt-4 text-xl py-4" disabled={pin.length < 4 || busy || locked} onClick={submit}>
                {locked ? t('login.locked', { n: remaining }) : busy ? t('login.signingIn') : t('login.signIn')}
              </button>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted text-center">
              <p>{t('login.pickAccount')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
