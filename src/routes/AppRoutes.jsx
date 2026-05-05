import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCustomerStore } from '../store/customerStore'
import LoginPage from '../pages/LoginPage'
import DashboardLayout from '../components/shared/DashboardLayout'
import DashboardHome from '../pages/DashboardHome'
import BillingPage from '../pages/BillingPage'
import InventoryPage from '../pages/InventoryPage'
import CustomersPage from '../pages/CustomersPage'
import LandingPage from '../pages/LandingPage'
import MyBethakLogin from '../pages/MyBethakLogin'
import MyBethakDashboard from '../pages/MyBethakDashboard'
import GamesPage from '../pages/GamesPage'

function AdminRoute({ children, allowedRoles }) {
  const { user, role } = useAuthStore()
  if (!user) return <Navigate to="/admin" replace />
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/admin/dashboard" replace />
  return children
}

function CustomerRoute({ children }) {
  const { customer } = useCustomerStore()
  if (!customer) return <Navigate to="/my-bethak" replace />
  return children
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/games" element={<GamesPage />} />

      {/* Customer Portal */}
      <Route path="/my-bethak" element={<MyBethakLogin />} />
      <Route path="/my-bethak/dashboard" element={
        <CustomerRoute><MyBethakDashboard /></CustomerRoute>
      } />

      {/* Admin Panel */}
      <Route path="/admin" element={<LoginPage />} />
      <Route path="/admin/*" element={<AdminRoute><DashboardLayout /></AdminRoute>}>
        <Route path="dashboard" element={<DashboardHome />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="customers" element={
          <AdminRoute allowedRoles={['super_admin', 'admin']}>
            <CustomersPage />
          </AdminRoute>
        } />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
