import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useSettings } from '../lib/settings'
import { useAuth } from '../lib/auth'
import { useLicense } from '../lib/license'
import { api } from '../lib/api'
import { IconFloor, IconProducts, IconTables, IconHistory, IconChart, IconSettings, IconUsers, IconLogout } from './icons'

const links = [
  { to: '/', label: 'Floor', Icon: IconFloor, end: true },
  { to: '/products', label: 'Menu', Icon: IconProducts, admin: true, lowStock: true },
  { to: '/tables', label: 'Tables', Icon: IconTables, admin: true },
  { to: '/history', label: 'History', Icon: IconHistory },
  { to: '/analytics', label: 'Stats', Icon: IconChart },
  { to: '/users', label: 'Users', Icon: IconUsers, admin: true },
  { to: '/settings', label: 'Setup', Icon: IconSettings, admin: true }
]

function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="text-center">
      <div className="font-display text-cream text-base tnum leading-none">
        {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div className="text-[10px] text-muted mt-1 leading-tight">
        {now.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
      </div>
    </div>
  )
}

export default function Layout() {
  const { settings } = useSettings()
  const { user, isAdmin, logout } = useAuth()
  const { status: license } = useLicense()
  const [lowCount, setLowCount] = useState(0)

  // Low-stock indicator for the Menu nav item (admins only).
  useEffect(() => {
    if (!isAdmin) return
    const threshold = parseInt(settings.low_stock_threshold || '5', 10)
    api.products.list().then((ps) => setLowCount(ps.filter((p) => p.stock <= threshold).length))
  }, [isAdmin, settings.low_stock_threshold])

  const monogram = (settings.shop_name || 'P').trim().charAt(0).toUpperCase()
  const visible = links.filter((l) => !l.admin || isAdmin)

  return (
    <div className="flex h-screen">
      <nav className="w-[104px] shrink-0 flex flex-col items-center py-5 gap-1 bg-surface/70 border-r border-line backdrop-blur-md">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center font-display text-2xl text-[#2a1c0c] mb-4"
          style={{ background: 'linear-gradient(135deg,#f7b96b,#ec9a45)', boxShadow: '0 8px 22px -8px rgba(236,154,69,.7)' }}
          title={settings.shop_name}
        >
          {monogram}
        </div>

        <div className="flex-1 flex flex-col gap-1 w-full px-3 overflow-y-auto">
          {visible.map(({ to, label, Icon, end, lowStock }) => (
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
                  <span className="relative">
                    <Icon width={24} height={24} />
                    {lowStock && lowCount > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-berry text-white text-[10px] font-bold flex items-center justify-center tnum">
                        {lowCount}
                      </span>
                    )}
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* current user + logout */}
        <div className="w-full px-2 flex flex-col items-center gap-2 pt-2 border-t border-line">
          <div className="text-center leading-tight" title={user?.name}>
            <div className="text-xs font-semibold text-cream truncate max-w-[80px]">{user?.name || user?.username}</div>
            <div className={`text-[10px] ${isAdmin ? 'text-ember' : 'text-muted'}`}>{isAdmin ? 'Admin' : 'Cashier'}</div>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="w-12 py-2 rounded-xl bg-surface2 text-muted hover:text-berry hover:bg-surface3 flex items-center justify-center transition"
          >
            <IconLogout width={20} height={20} />
          </button>
          <Clock />
        </div>
      </nav>

      <main className="flex-1 overflow-hidden flex flex-col">
        {license?.state === 'trial' && (
          <div className="shrink-0 bg-ember/15 border-b border-ember/30 text-ember text-sm font-semibold px-5 py-2 text-center">
            Trial — {license.daysLeft} day{license.daysLeft === 1 ? '' : 's'} left{isAdmin ? ' · activate in Setup → License' : ''}
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
