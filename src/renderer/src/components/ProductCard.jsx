import { money } from '../lib/settings'

// A tappable product tile for the order-taking grid: a prominent image (or a letter
// placeholder when none), then name, price and live remaining-stock — with low/out
// styling and an OUT/LOW corner badge. `remaining` is the units still addable.
export default function ProductCard({ product, remaining, threshold, index = 0, onAdd }) {
  const out = remaining <= 0
  const low = !out && remaining <= threshold
  return (
    <button
      onClick={() => onAdd(product)}
      disabled={out}
      style={{ animationDelay: `${Math.min(index * 20, 300)}ms` }}
      className={`animate-rise relative card p-0 h-56 flex flex-col text-left active:scale-[0.97] transition-all overflow-hidden ${
        out
          ? 'border-berry/60 ring-1 ring-berry/40 opacity-50 cursor-not-allowed'
          : low
            ? 'border-ember/60 ring-1 ring-ember/30 hover:bg-surface2'
            : 'hover:border-ember/40 hover:bg-surface2'
      }`}
    >
      {(out || low) && (
        <span
          className={`absolute top-0 right-0 z-10 px-2 py-0.5 rounded-bl-xl text-[10px] font-bold ${
            out ? 'bg-berry text-white' : 'bg-ember text-[#2a1c0c]'
          }`}
        >
          {out ? 'OUT' : 'LOW'}
        </span>
      )}
      <div className="h-36 w-full shrink-0 bg-surface2 flex items-center justify-center overflow-hidden">
        {product.image ? (
          <img src={product.image} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="font-display text-5xl text-muted/40">{(product.name || '?').charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
        <span className="text-base font-semibold leading-tight line-clamp-2 text-cream">
          {product.name}
          {product.modifier_count > 0 && <span className="text-[10px] text-muted font-normal ml-1">• options</span>}
        </span>
        <span className="flex items-center justify-between gap-2 mt-1">
          <span className="text-ember font-display font-bold text-lg tnum">{money(product.price)}</span>
          <span className={`text-[11px] font-semibold tnum ${out ? 'text-berry' : low ? 'text-ember' : 'text-muted'}`}>
            {out ? 'out' : `${remaining} left`}
          </span>
        </span>
      </div>
    </button>
  )
}
