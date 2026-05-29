import { createContext, useCallback, useContext, useState } from 'react'
import Modal from './Modal'

const Ctx = createContext(null)

const normalize = (opts) => (typeof opts === 'string' ? { message: opts } : opts || {})

// App-themed replacements for window.confirm / window.alert.
export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null)

  const confirm = useCallback((opts) => {
    const o = normalize(opts)
    return new Promise((resolve) => {
      setDialog({
        kind: 'confirm',
        resolve,
        title: o.title || 'Please confirm',
        message: o.message || '',
        confirmText: o.confirmText || 'Confirm',
        cancelText: o.cancelText || 'Cancel',
        danger: o.danger ?? /delete|cancel|remove|discard/i.test(o.message || '')
      })
    })
  }, [])

  const alert = useCallback((opts) => {
    const o = normalize(opts)
    return new Promise((resolve) => {
      setDialog({ kind: 'alert', resolve, title: o.title || 'Notice', message: o.message || '', confirmText: o.confirmText || 'OK' })
    })
  }, [])

  const close = (value) => {
    setDialog((d) => {
      if (d) d.resolve(value)
      return null
    })
  }

  return (
    <Ctx.Provider value={{ confirm, alert }}>
      {children}
      {dialog && (
        <Modal
          title={dialog.title}
          width={420}
          onClose={() => close(dialog.kind === 'confirm' ? false : undefined)}
        >
          {dialog.message && <p className="text-cream/90 leading-relaxed">{dialog.message}</p>}
          <div className="flex gap-3 pt-2">
            {dialog.kind === 'confirm' && (
              <button className="btn-ghost flex-1" onClick={() => close(false)}>
                {dialog.cancelText}
              </button>
            )}
            <button
              className={`${dialog.danger ? 'btn-danger' : 'btn-accent'} flex-1`}
              autoFocus
              onClick={() => close(dialog.kind === 'confirm' ? true : undefined)}
            >
              {dialog.confirmText}
            </button>
          </div>
        </Modal>
      )}
    </Ctx.Provider>
  )
}

export function useDialog() {
  return useContext(Ctx)
}
