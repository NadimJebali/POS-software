import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { useLicense } from './lib/license'
import Layout from './components/Layout'
import Login from './pages/Login'
import Setup from './pages/Setup'
import Activate from './pages/Activate'
import Floor from './pages/Floor'
import Order from './pages/Order'
import Checkout from './pages/Checkout'
import Split from './pages/Split'
import Products from './pages/Products'
import TablesManage from './pages/TablesManage'
import Analytics from './pages/Analytics'
import History from './pages/History'
import Settings from './pages/Settings'
import Users from './pages/Users'

export default function App() {
  const { user, isAdmin, needsSetup } = useAuth()
  const { status: license } = useLicense()

  if (!license) return null // license check still loading
  // Locked until a valid license is entered (trial still counts as usable).
  if (license.state === 'unlicensed' || license.state === 'expired') return <Activate />

  if (needsSetup === null) return null // still checking — avoid a flash of the login screen
  if (needsSetup) return <Setup /> // first run: create the admin account
  // Everything else is behind the login screen.
  if (!user) return <Login />

  // Admin-only pages redirect cashiers back to the floor.
  const adminOnly = (el) => (isAdmin ? el : <Navigate to="/" replace />)

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Floor />} />
        <Route path="/products" element={adminOnly(<Products />)} />
        <Route path="/tables" element={adminOnly(<TablesManage />)} />
        <Route path="/history" element={<History />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={adminOnly(<Settings />)} />
        <Route path="/users" element={adminOnly(<Users />)} />
      </Route>
      {/* Full-screen flows without the sidebar */}
      <Route path="/order/:tableId" element={<Order />} />
      <Route path="/checkout/:orderId" element={<Checkout />} />
      <Route path="/split/:orderId" element={<Split />} />
    </Routes>
  )
}
