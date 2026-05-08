import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCustomerStore } from '../store/customerStore'
import LoginPage from '../pages/LoginPage'
import DashboardLayout from '../components/shared/DashboardLayout'
import DashboardHome from '../pages/DashboardHome'
import BillingPage from '../pages/BillingPage'
import InventoryPage from '../pages/InventoryPage'
import CustomersPage from '../pages/CustomersPage'
import SalaryPage from '../pages/SalaryPage'
import RewardsPage from '../pages/RewardsPage'
import AnalyticsPage from '../pages/AnalyticsPage'
import KDSPage from '../pages/KDSPage'
import BranchesPage from '../pages/BranchesPage'
import StaffPage from '../pages/StaffPage'
import AnnouncementsPage from '../pages/AnnouncementsPage'
import ExpensesPage from '../pages/ExpensesPage'
import SettingsPage from '../pages/SettingsPage'
import TableManagementPage from '../pages/TableManagementPage'
import MenuPage from '../pages/MenuPage'
import GamesPage from '../pages/GamesPage'
import LandingPage from '../pages/LandingPage'
import MyBethakLogin from '../pages/MyBethakLogin'
import MyBethakDashboard from '../pages/MyBethakDashboard'
import CafeOrderPage from '../pages/CafeOrderPage'

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
        <Route path="salary" element={
          <AdminRoute allowedRoles={['super_admin', 'admin']}><SalaryPage /></AdminRoute>
        } />
        <Route path="rewards" element={
          <AdminRoute allowedRoles={['super_admin', 'admin']}><RewardsPage /></AdminRoute>
        } />
        <Route path="analytics" element={
          <AdminRoute allowedRoles={['super_admin', 'admin']}><AnalyticsPage /></AdminRoute>
        } />
        <Route path="branches" element={
          <AdminRoute allowedRoles={['super_admin']}><BranchesPage /></AdminRoute>
        } />
        <Route path="staff" element={
          <AdminRoute allowedRoles={['super_admin', 'admin']}><StaffPage /></AdminRoute>
        } />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="expenses" element={
          <AdminRoute allowedRoles={['super_admin', 'admin']}><ExpensesPage /></AdminRoute>
        } />
        <Route path="settings" element={
          <AdminRoute allowedRoles={['super_admin', 'admin']}><SettingsPage /></AdminRoute>
        } />
        <Route path="tables" element={
          <AdminRoute allowedRoles={['super_admin', 'admin', 'manager']}><TableManagementPage /></AdminRoute>
        } />
        <Route path="menu" element={
          <AdminRoute allowedRoles={['super_admin', 'admin', 'manager']}><MenuPage /></AdminRoute>
        } />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Route>

      <Route path="/kitchen" element={<AdminRoute allowedRoles={['super_admin', 'admin', 'manager']}><KDSPage /></AdminRoute>} />
      <Route path="/cafe/order" element={<CafeOrderPage />} />


      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
