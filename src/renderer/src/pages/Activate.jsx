import { useState } from 'react'
import { useLicense } from '../lib/license'
import { useSettings } from '../lib/settings'

export default function Activate() {
  const { status, activate, activateByCode } = useLicense()
  const { settings } = useSettings()
  const [code, setCode] = useState('')
  const [license, setLicense] = useState('')
  const [showPaste, setShowPaste] = useState(false)
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

  // Activate online with the short code; falls back to a pasted key when expanded.
  const submit = async () => {
    const usingCode = !showPaste
    const value = (usingCode ? code : license).trim()
    if (!value) return
    setBusy(true)
    setError('')
    try {
      if (usingCode) {
        await activateByCode(value)
      } else {
        await activate(value)
      }
    } catch (e) {
      setError(e.message || 'Activation failed')
    } finally {
      setBusy(false)
    }
  }

  const headline = status?.state === 'expired' ? 'Your license has ended' : 'Activate POS Software'
  const blurb =
    status?.state === 'expired'
      ? status.reason || 'Enter your activation code to continue.'
      : 'Your trial has ended. Enter your activation code to keep using the app.'

  const canSubmit = (showPaste ? license.trim() : code.trim()) && !busy

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
            <button className="btn-ghost py-2 px-4" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
          </div>
        </div>

        {!showPaste ? (
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
        ) : (
          <label className="block">
            <span className="text-muted text-sm">Paste your license key</span>
            <textarea
              className="input mt-1.5 font-mono text-sm h-28 resize-none"
              placeholder="xxxxxxxx.xxxxxxxx"
              value={license}
              autoFocus
              onChange={(e) => setLicense(e.target.value)}
            />
          </label>
        )}

        {error && <p className="text-berry text-sm mt-2">{error}</p>}

        <button className="btn-accent w-full mt-4 text-xl py-4" disabled={!canSubmit} onClick={submit}>
          {busy ? 'Activating…' : 'Activate'}
        </button>

        <button
          className="btn-ghost w-full mt-2 text-sm py-2"
          onClick={() => {
            setShowPaste((v) => !v)
            setError('')
          }}
        >
          {showPaste ? 'Use an activation code instead' : 'Have a license key instead?'}
        </button>
      </div>
    </div>
  )
}
