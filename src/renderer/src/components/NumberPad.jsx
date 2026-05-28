import { currencyDecimals } from '../lib/settings'

const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '⌫']

// Touch numeric keypad building a decimal string (e.g. "12.500").
export default function NumberPad({ value, onChange, maxDecimals }) {
  const limit = maxDecimals ?? currencyDecimals()

  const press = (k) => {
    if (k === '⌫') return onChange(value.slice(0, -1))
    if (k === '.') {
      if (limit === 0 || value.includes('.')) return
      return onChange((value === '' ? '0' : value) + '.')
    }
    if (value.includes('.') && value.split('.')[1].length >= limit) return
    onChange(value + k)
  }

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {keys.map((k) => (
        <button
          key={k}
          onClick={() => press(k)}
          className="h-[68px] rounded-2xl bg-surface2 border border-line text-3xl font-display font-semibold
                     active:scale-95 hover:bg-surface3 transition-all tnum"
        >
          {k}
        </button>
      ))}
    </div>
  )
}
