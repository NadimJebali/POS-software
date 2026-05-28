export default function Modal({ title, subtitle, children, onClose, width = 480 }) {
  return (
    <div className="backdrop animate-rise" onClick={onClose}>
      <div
        className="card p-7 animate-pop"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5">
          <h2 className="font-display text-2xl font-bold">{title}</h2>
          {subtitle && <p className="text-muted text-sm mt-1">{subtitle}</p>}
        </div>
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  )
}
