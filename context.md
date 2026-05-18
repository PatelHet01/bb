# Bombay Bethak — Project Context

> **AI Agent Reference File** — Read this before making any changes.

---

## 1. What Is This?

A **multi-branch cafe POS + operations dashboard** for "Bombay Bethak" (BB). Built in React + Vite, with Supabase as the backend (Postgres + Realtime).

- **Live URL**: `bombay-bethak.vercel.app`
- **Dev**: `localhost:5173`
- **Repo**: `github.com/PatelHet01/bb` (master branch)
- **Push script**: `sh push.sh` (auto-tags version)

---

## 2. Branches / Locations

| id | Name | Notes |
|---|---|---|
| `gurukul` | Gurukul | Main branch, no BB Cafe |
| `bhat` | Bhat | Has BB Cafe + dine-in tables + KDS + QR ordering |
| `visat` | Visat | Standard branch |

`branchId` from `useAuthStore()` is the logged-in user's branch. `super_admin` has `null` branchId and sees all branches.

---

## 3. Stack

- **Frontend**: React 18 + Vite, React Router v6, Tailwind-ish custom CSS (`index.css`)
- **State**: Zustand (`authStore`, `customerStore`)
- **DB / Auth**: Supabase (direct client from `src/lib/supabase.js`)
- **Toast**: `react-hot-toast`
- **Icons**: `lucide-react`
- **Animations**: `framer-motion` (used in CafeOrderPage)

---

## 4. File Map

```
src/
  pages/
    BillingPage.jsx        ← Main POS (most complex file, ~1300 lines)
    CafeOrderPage.jsx      ← Customer QR ordering page (/cafe/order?table=TOKEN)
    KDSPage.jsx            ← Kitchen Display Screen (/kitchen)
    DashboardHome.jsx      ← Dashboard with table status
    InventoryPage.jsx      ← Inventory management
    OrdersPage.jsx         ← Order history
    CustomersPage.jsx      ← CRM
    StaffSalaryPage.jsx    ← HR + Salary
    SettingsPage.jsx       ← Settings with tabs
    AnalyticsPage.jsx      ← Analytics
    VendorsPage.jsx        ← Vendor ledger
    ...
  components/
    shared/
      DashboardLayout.jsx  ← Sidebar + nav + layout wrapper
      OrderNotificationOverlay.jsx ← Global overlay for KDS notifications
      BBLogo.jsx
    billing/               ← Billing sub-components
    customers/             ← Customer sub-components
    inventory/             ← Inventory sub-components
  routes/
    AppRoutes.jsx          ← All routes
  store/
    authStore.js           ← Zustand: user, role, branchId, branchName, darkMode
    customerStore.js       ← Zustand: MyBethak customer session
  lib/
    supabase.js            ← Supabase client init
    branchConfig.js        ← BRANCH_CATEGORY_MAP, CATEGORY_ICONS, CATEGORY_SUBCATEGORIES
    additive_migration.sql ← Additive SQL (ALTER TABLE ADD COLUMN IF NOT EXISTS)
  utils/
    ledger.js
```

---

## 5. Database Schema (Key Tables)

### `orders`
```sql
id UUID PK, customer_id, branch_id, subtotal, discount, total,
status TEXT, -- 'pending','new','preparing','ready','completed','cancelled'
table_number INT, order_type TEXT, order_number TEXT, created_at
```

### `order_items`
```sql
id UUID PK, order_id (FK→orders), item_id (FK→items), offer_id,
quantity INT, price NUMERIC, total NUMERIC
```
> ⚠️ DO NOT ALTER THIS TABLE. All KDS item-level state goes in `kds_items`.

### `cafe_tables`
```sql
id UUID PK, table_number INT, branch_id, status TEXT (available/occupied),
current_order_id UUID, qr_token TEXT, created_at
```

### `pos_carts` (new, for draft carts)
```sql
table_id UUID PK (FK→cafe_tables), branch_id, cart_data JSONB,
customer_data JSONB, cust_balances JSONB, order_type TEXT,
discount_type TEXT, discount_value NUMERIC, last_updated TIMESTAMPTZ
```
> ⚠️ RLS is DISABLED on this table. Run: `ALTER TABLE pos_carts DISABLE ROW LEVEL SECURITY;`

### `items`
```sql
id UUID PK, name, variant, category, subcategory, unit, price, cost_price,
stock_quantity, low_stock_threshold, units_per_box, is_active,
is_archived, item_type ('SELLABLE'/'RAW_MATERIAL'), branch_id
```
> ⚠️ `pack_price` column NOT yet added. Run additive migration if needed.

### `customers`
```sql
id UUID PK, username, name, mobile_number UNIQUE, dob, branch_id,
ghoda_coins, registration_type ('self'/'admin'), email, created_at
```

### `kds_items` (NEW — to be created)
```sql
id UUID PK, order_id (FK→orders), item_id UUID, item_name TEXT,
quantity INT, status TEXT ('pending'/'preparing'/'ready'),
updated_at TIMESTAMPTZ, updated_by TEXT
```

---

## 6. Roles & Access

| Role | Access |
|---|---|
| `super_admin` | Everything, all branches |
| `admin` | Full branch access |
| `manager` | Billing, Inventory, KDS |

Auth is checked via `useAuthStore()` → `{ user, role, branchId }`.

---

## 7. Key Patterns & Conventions

### Data Fetching
- Direct Supabase calls (no API layer). Pattern: `const { data, error } = await supabase.from('table').select()`
- Always check `error` and `throw error` or `toast.error(error.message)`
- Realtime via `supabase.channel('name').on('postgres_changes', ...).subscribe()`

### State
- Zustand for global auth/customer state
- `useState` local to pages
- No Redux, no React Query

### Routing
- `/admin/*` → requires admin login → wrapped in `DashboardLayout`
- `/kitchen` → outside DashboardLayout (fullscreen capable)
- `/cafe/order` → public customer QR page
- `/my-bethak` → customer portal

### Sidebar Nav
- Defined in `DashboardLayout.jsx` → `NAV_GROUPS` array
- Each item has: `{ to, label, icon, roles[], feature }`
- Feature-gated by `system_settings` table → `role_permissions` key

### Notifications
- `OrderNotificationOverlay` is rendered inside `DashboardLayout` and `KDSPage`
- Uses Supabase Realtime broadcast channel `order-ready`

---

## 8. Order Status Flow

```
pending (pos_carts draft) 
  → new (QR customer placed) 
  → preparing (staff clicks "Start Preparing" OR staff POS confirms)
  → ready (KDS marks all items done → auto)
  → completed (payment received)
  → cancelled
```

---

## 9. BillingPage Architecture (important!)

- `syncCartToDB`: debounced (500ms) function that saves cart to `pos_carts` AND mirrors to `orders` table for KDS
- `tableCarts`: in-memory map `{ [table_id]: { cart, customer, custBalances, orderType, discountType, discountValue } }`
- `switchTable(table)`: loads from in-memory → DB → falls back to `current_order_id`
- Central `useEffect` watches all active context states → auto-syncs to cache + DB
- On checkout: deletes from `pos_carts`, marks order `completed`, clears table

---

## 10. Known Issues / Watch Out

- `pack_price` column doesn't exist in DB yet → removed from UI temporarily
- `pos_carts` table RLS must be DISABLED for syncing to work
- `kds_items` table not yet created
- `/kitchen` route is accessible but KDS operates on whole-order status (no item-level tracking yet)
- `syncCartToDB` creates a `pending` order in `orders` table for KDS visibility — this means KDS may see in-progress carts

---

## 11. SQL Files

| File | Purpose |
|---|---|
| `master_schema.sql` | Full DB reset (DO NOT run in prod) |
| `src/lib/additive_migration.sql` | Safe additive migrations |
| `scratch/migration_pos_carts.sql` | pos_carts table + RLS fix |
