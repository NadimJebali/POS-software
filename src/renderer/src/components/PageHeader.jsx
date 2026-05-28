export default function PageHeader({ title, subtitle, children }) {
  return (
    <header className="flex items-end justify-between gap-4 mb-6 animate-rise">
      <div>
        <h1 className="font-display text-4xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted mt-1">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </header>
  )
}
