import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Floor from './pages/Floor'
import Order from './pages/Order'
import Checkout from './pages/Checkout'
import Products from './pages/Products'
import TablesManage from './pages/TablesManage'
import Analytics from './pages/Analytics'
import History from './pages/History'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Floor />} />
        <Route path="/products" element={<Products />} />
        <Route path="/tables" element={<TablesManage />} />
        <Route path="/history" element={<History />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      {/* Full-screen flows without the sidebar */}
      <Route path="/order/:tableId" element={<Order />} />
      <Route path="/checkout/:orderId" element={<Checkout />} />
    </Routes>
  )
}
