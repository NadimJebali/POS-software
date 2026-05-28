import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useSettings } from '../lib/settings'
import { IconFloor, IconProducts, IconTables, IconHistory, IconChart, IconSettings } from './icons'

const links = [
  { to: '/', label: 'Floor', Icon: IconFloor, end: true },
  { to: '/products', label: 'Menu', Icon: IconProducts },
  { to: '/tables', label: 'Tables', Icon: IconTables },
  { to: '/history', label: 'History', Icon: IconHistory },
  { to: '/analytics', label: 'Stats', Icon: IconChart },
  { to: '/settings', label: 'Setup', Icon: IconSettings }
]

function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 30)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="text-center px-2">
      <div className="font-display text-cream text-lg tnum leading-none">
        {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div className="text-[10px] text-muted mt-1 leading-tight">
        {now.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })}
      </div>
    </div>
  )
}

export default function Layout() {
  const { settings } = useSettings()
  const monogram = (settings.shop_name || 'P').trim().charAt(0).toUpperCase()

  return (
    <div className="flex h-screen">
      <nav className="w-[104px] shrink-0 flex flex-col items-center py-5 gap-1 bg-surface/70 border-r border-line backdrop-blur-md">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center font-display text-2xl text-[#2a1c0c] mb-5"
          style={{ background: 'linear-gradient(135deg,#f7b96b,#ec9a45)', boxShadow: '0 8px 22px -8px rgba(236,154,69,.7)' }}
          title={settings.shop_name}
        >
          {monogram}
        </div>

        <div className="flex-1 flex flex-col gap-1 w-full px-3">
          {links.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `group relative w-full py-3 rounded-2xl flex flex-col items-center gap-1.5 text-[11px] font-semibold transition-all ${
                  isActive ? 'text-ember' : 'text-muted hover:text-cream hover:bg-surface2'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-1 rounded-r-full bg-ember shadow-[0_0_12px_rgba(236,154,69,.8)]" />
                  )}
                  <Icon width={24} height={24} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>

        <Clock />
      </nav>

      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
