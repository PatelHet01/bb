import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCustomerStore } from '../store/customerStore'
import LoginPage from '../pages/LoginPage'
import DashboardLayout from '../components/shared/DashboardLayout'
import DashboardHome from '../pages/DashboardHome'
import BillingPage from '../pages/BillingPage'
import InventoryPage from '../pages/InventoryPage'
import CustomersPage from '../pages/CustomersPage'
import WhatsAppCRMPage from '../pages/WhatsAppCRMPage'
import StaffSalaryPage from '../pages/StaffSalaryPage'
import RewardsPage from '../pages/RewardsPage'
import AnalyticsPage from '../pages/AnalyticsPage'
import KDSPage from '../pages/KDSPage'
import BranchesPage from '../pages/BranchesPage'
import AnnouncementsPage from '../pages/AnnouncementsPage'
import ExpensesPage from '../pages/ExpensesPage'
import SettingsPage from '../pages/SettingsPage'
import MenuPage from '../pages/MenuPage'
import GamesPage from '../pages/GamesPage'
import LandingPage from '../pages/LandingPage'
import MyBethakLogin from '../pages/MyBethakLogin'
import MyBethakDashboard from '../pages/MyBethakDashboard'
import CafeOrderPage from '../pages/CafeOrderPage'
import OrdersPage from '../pages/OrdersPage'
import VendorsPage from '../pages/VendorsPage'
import BranchTransfersPage from '../pages/BranchTransfersPage'
import OffersPage from '../pages/OffersPage'
import CashTrackingPage from '../pages/CashTrackingPage'
import InternalLedgerPage from '../pages/InternalLedgerPage'
import SessionPage from '../pages/SessionPage'
import AuditPage from '../pages/AuditPage'

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
        <Route path="whatsapp" element={
          <AdminRoute allowedRoles={['super_admin', 'admin']}>
            <WhatsAppCRMPage />
          </AdminRoute>
        } />
        <Route path="offers" element={<OffersPage />} />
        
        {/* HR & Operations */}
        <Route path="hr" element={
          <AdminRoute allowedRoles={['super_admin', 'admin']}><StaffSalaryPage /></AdminRoute>
        } />
        <Route path="salary" element={<Navigate to="/admin/hr" replace />} />
        <Route path="staff" element={<Navigate to="/admin/hr" replace />} />
        
        {/* Redirects to Settings Tabs */}
        <Route path="rewards" element={<Navigate to="/admin/settings?tab=rewards" replace />} />
        <Route path="announcements" element={<Navigate to="/admin/settings?tab=announcements" replace />} />
        <Route path="transfers" element={<Navigate to="/admin/settings?tab=transfers" replace />} />
        
        {/* Redirects to Inventory Tabs */}
        <Route path="menu" element={<Navigate to="/admin/inventory?tab=menu" replace />} />
        
        <Route path="tables" element={<Navigate to="/admin/billing" replace />} />

        <Route path="analytics" element={
          <AdminRoute allowedRoles={['super_admin', 'admin']}><AnalyticsPage /></AdminRoute>
        } />
        <Route path="branches" element={
          <AdminRoute allowedRoles={['super_admin']}><BranchesPage /></AdminRoute>
        } />
        <Route path="expenses" element={
          <AdminRoute allowedRoles={['super_admin', 'admin']}><ExpensesPage /></AdminRoute>
        } />
        <Route path="settings" element={
          <AdminRoute allowedRoles={['super_admin', 'admin']}><SettingsPage /></AdminRoute>
        } />
        <Route path="orders" element={
          <AdminRoute allowedRoles={['super_admin', 'admin']}><OrdersPage /></AdminRoute>
        } />
        <Route path="vendors" element={
          <AdminRoute allowedRoles={['super_admin', 'admin']}><VendorsPage /></AdminRoute>
        } />
        <Route path="cash" element={
          <AdminRoute allowedRoles={['super_admin', 'admin']}><CashTrackingPage /></AdminRoute>
        } />
        <Route path="ledger" element={
          <AdminRoute allowedRoles={['super_admin', 'admin']}><InternalLedgerPage /></AdminRoute>
        } />
        <Route path="sessions" element={
          <AdminRoute allowedRoles={['super_admin', 'admin']}><SessionPage /></AdminRoute>
        } />
        <Route path="audit" element={
          <AdminRoute allowedRoles={['super_admin', 'admin']}><AuditPage /></AdminRoute>
        } />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Route>

      <Route path="/kitchen" element={<AdminRoute allowedRoles={['super_admin', 'admin', 'manager']}><KDSPage /></AdminRoute>} />
      <Route path="/cafe/order" element={<CafeOrderPage />} />


      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
