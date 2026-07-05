import { useState } from 'react'
import { useLicense } from '../lib/license'
import { useSettings } from '../lib/settings'
import { useT } from '../lib/i18n'

export default function Activate() {
  const { status, activateByCode, rebindByCode } = useLicense()
  const { settings } = useSettings()
  const { t } = useT()
  const [code, setCode] = useState('')
  const [boundElsewhere, setBoundElsewhere] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const machineId = status?.machineId || '…'
  const monogram = (settings.shop_name || 'P').trim().charAt(0).toUpperCase()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(machineId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  // Activate online with the short code. The server issues the signed key; the app
  // verifies it offline before storing it. No raw key is ever pasted here.
  const submit = async () => {
    const value = code.trim()
    if (!value) return
    setBusy(true)
    setError('')
    try {
      const res = await activateByCode(value)
      if (!res.ok) {
        // Already active on another machine → offer to move it here (rebind).
        if (res.code === 'machine_limit') setBoundElsewhere(true)
        else setError(res.message || 'Activation failed')
      }
    } finally {
      setBusy(false)
    }
  }

  // Confirmed "move it here": rebind the license onto this machine.
  const confirmMove = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await rebindByCode(code.trim())
      if (!res.ok) {
        setBoundElsewhere(false)
        setError(res.code === 'transfer_limit' ? t('license.transferLimit') : res.message || 'Move failed')
      }
      // On success the provider status flips to 'licensed' and this screen unmounts.
    } finally {
      setBusy(false)
    }
  }

  const headline = status?.state === 'expired' ? 'Your license has ended' : 'Activate POS Software'
  const blurb =
    status?.state === 'expired'
      ? status.reason || 'Enter your activation code to continue.'
      : 'Your trial has ended. Enter your activation code to keep using the app.'

  return (
    <div className="h-screen flex items-center justify-center p-8">
      <div className="card w-[640px] max-w-full p-9 animate-pop">
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center font-display text-3xl text-[#2a1c0c]"
            style={{ background: 'linear-gradient(135deg,#f7b96b,#ec9a45)' }}
          >
            {monogram}
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold leading-none">{headline}</h1>
            <p className="text-muted text-sm mt-1">{blurb}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-surface2 border border-line p-4 mb-5">
          <div className="text-muted text-sm mb-1">Your Machine ID — share this with your vendor if you need help</div>
          <div className="flex items-center gap-3">
            <code className="font-display text-xl tnum tracking-wide flex-1 break-all">{machineId}</code>
            <button className="btn-ghost py-3 px-4 min-h-[44px]" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
          </div>
        </div>

        {boundElsewhere ? (
          // Rebind confirmation — this code is bound to a different machine.
          <div className="rounded-2xl bg-ember/10 border border-ember/30 p-5">
            <h2 className="font-display text-lg font-bold text-ember">{t('license.moveTitle')}</h2>
            <p className="text-muted text-sm mt-1.5">{t('license.movePrompt')}</p>
            {error && <p className="text-berry text-sm mt-2">{error}</p>}
            <div className="flex gap-3 mt-4">
              <button
                className="btn-ghost flex-1 min-h-[44px] py-3"
                disabled={busy}
                onClick={() => {
                  setBoundElsewhere(false)
                  setError('')
                }}
              >
                {t('common.cancel')}
              </button>
              <button className="btn-accent flex-1 min-h-[44px] py-3 text-lg" disabled={busy} onClick={confirmMove}>
                {busy ? t('license.moving') : t('license.moveConfirm')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <label className="block">
              <span className="text-muted text-sm">Enter your activation code</span>
              <input
                className="input mt-1.5 font-display text-2xl tracking-[0.2em] text-center uppercase"
                placeholder="POSK-XXXX-XXXX-XXXX"
                value={code}
                autoFocus
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </label>

            {error && <p className="text-berry text-sm mt-2">{error}</p>}

            <button className="btn-accent w-full mt-4 text-xl py-4" disabled={!code.trim() || busy} onClick={submit}>
              {busy ? 'Activating…' : 'Activate'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
