import { useState } from 'react'
import { useLicense } from '../lib/license'
import { useSettings } from '../lib/settings'

export default function Activate() {
  const { status, activate } = useLicense()
  const { settings } = useSettings()
  const [license, setLicense] = useState('')
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

  const submit = async () => {
    if (!license.trim()) return
    setBusy(true)
    setError('')
    try {
      await activate(license.trim())
    } catch (e) {
      setError(e.message || 'Activation failed')
    } finally {
      setBusy(false)
    }
  }

  const headline = status?.state === 'expired' ? 'Your license has ended' : 'Activate POS Software'
  const blurb =
    status?.state === 'expired'
      ? status.reason || 'Please enter a valid license to continue.'
      : 'Your trial has ended. Enter a license key to keep using the app.'

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
          <div className="text-muted text-sm mb-1">Your Machine ID — send this to your vendor to get a license</div>
          <div className="flex items-center gap-3">
            <code className="font-display text-xl tnum tracking-wide flex-1 break-all">{machineId}</code>
            <button className="btn-ghost py-2 px-4" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
          </div>
        </div>

        <label className="block">
          <span className="text-muted text-sm">Paste your license</span>
          <textarea
            className="input mt-1.5 font-mono text-sm h-28 resize-none"
            placeholder="xxxxxxxx.xxxxxxxx"
            value={license}
            onChange={(e) => setLicense(e.target.value)}
          />
        </label>

        {error && <p className="text-berry text-sm mt-2">{error}</p>}

        <button className="btn-accent w-full mt-4 text-xl py-4" disabled={!license.trim() || busy} onClick={submit}>
          {busy ? 'Activating…' : 'Activate'}
        </button>
      </div>
    </div>
  )
}
