import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Floor from './pages/Floor'
import Order from './pages/Order'
import Checkout from './pages/Checkout'
import Products from './pages/Products'
import TablesManage from './pages/TablesManage'
import Analytics from './pages/Analytics'
import History from './pages/History'
import Settings from './pages/Settings'
import Users from './pages/Users'

export default function App() {
  const { user, isAdmin } = useAuth()

  // Everything is behind the login screen.
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
    </Routes>
  )
}
