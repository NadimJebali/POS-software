import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { useSettings } from '../lib/settings'

const pad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓']

export default function Setup() {
  const { setup } = useAuth()
  const { save } = useSettings()

  const [shop, setShop] = useState('')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('admin')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [phase, setPhase] = useState('create') // 'create' | 'confirm'
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const value = phase === 'create' ? pin : confirm
  const setValue = phase === 'create' ? setPin : setConfirm

  const finish = async () => {
    if (pin !== confirm) {
      setError('PINs do not match — try again')
      setConfirm('')
      setPhase('confirm')
      return
    }
    setBusy(true)
    try {
      await setup({ username: username.trim() || 'admin', name: name.trim() || 'Administrator', pin })
      if (shop.trim()) await save({ shop_name: shop.trim() })
      // AuthProvider now has the signed-in admin → app renders the main UI.
    } catch (e) {
      setError(e.message || 'Could not complete setup')
      setBusy(false)
    }
  }

  const press = (k) => {
    setError('')
    if (k === '⌫') return setValue(value.slice(0, -1))
    if (k === '✓') {
      if (phase === 'create') {
        if (pin.length >= 4) setPhase('confirm')
        return
      }
      if (confirm.length >= 4) finish()
      return
    }
    if (value.length >= 8) return
    setValue(value + k)
  }

  return (
    <div className="h-screen flex items-center justify-center p-8">
      <div className="card w-[920px] max-w-full p-9 grid grid-cols-2 gap-9 animate-pop">
        {/* welcome + business/account details */}
        <div className="flex flex-col">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center font-display text-3xl text-[#2a1c0c] mb-5"
            style={{ background: 'linear-gradient(135deg,#f7b96b,#ec9a45)' }}
          >
            🧾
          </div>
          <h1 className="font-display text-3xl font-bold leading-tight">Welcome</h1>
          <p className="text-muted mt-1 mb-6">Let's set up your administrator account. You can add cashiers later.</p>

          <label className="block mb-4">
            <span className="text-muted text-sm">Business name (optional)</span>
            <input className="input mt-1.5" placeholder="e.g. Café Nadim" value={shop} onChange={(e) => setShop(e.target.value)} />
          </label>
          <label className="block mb-4">
            <span className="text-muted text-sm">Your name</span>
            <input className="input mt-1.5" placeholder="Administrator" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-muted text-sm">Username (used to sign in)</span>
            <input className="input mt-1.5" value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
        </div>

        {/* PIN create / confirm */}
        <div className="flex flex-col">
          <div className="mb-2">
            <h2 className="font-display text-xl font-bold">{phase === 'create' ? 'Create your PIN' : 'Re-enter your PIN'}</h2>
            <p className="text-muted text-sm">{phase === 'create' ? 'At least 4 digits. You\'ll use this to sign in.' : 'Confirm it matches.'}</p>
          </div>

          <div className="flex justify-center gap-3 my-5 h-8">
            {Array.from({ length: Math.max(4, value.length) }).map((_, i) => (
              <span key={i} className={`w-4 h-4 rounded-full transition ${i < value.length ? 'bg-ember' : 'bg-surface3'}`} />
            ))}
          </div>

          {error && <p className="text-berry text-center text-sm mb-3">{error}</p>}

          <div className="grid grid-cols-3 gap-2.5">
            {pad.map((k, i) => {
              const isOk = k === '✓'
              const okReady = (phase === 'create' ? pin.length >= 4 : confirm.length >= 4) && !busy
              return (
                <button
                  key={i}
                  disabled={isOk && !okReady}
                  onClick={() => press(k)}
                  className={`h-[62px] rounded-2xl text-2xl font-display font-semibold transition active:scale-95 disabled:opacity-30 ${
                    isOk ? 'bg-mint text-[#06281d]' : 'bg-surface2 border border-line hover:bg-surface3'
                  }`}
                >
                  {isOk && busy ? '…' : k}
                </button>
              )
            })}
          </div>

          {phase === 'confirm' && (
            <button className="text-muted text-sm mt-4 hover:text-cream" onClick={() => { setPhase('create'); setConfirm(''); setError('') }}>
              ← change PIN
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
