# Implementation Plan: Dedicated Temporary Cart System

## 1. Issue Analysis
**Current Problem:**
When adding items to multiple tables, the carts don't always persist correctly when switching back. This happens due to race conditions when trying to create a "pending" order in the main `orders` table on the first click, and `tableCarts` state losing sync. 
Also, storing temporary/draft carts in the main `orders` table can pollute financial data or KDS if not filtered perfectly.

**User Request:**
1. Create a dedicated temporary order mechanism that clears upon payment.
2. Ensure carts never disappear when switching tables.
3. Replace the horizontal pill bar with a **Dropdown** for table switching.

## 2. Architecture: `pos_carts` Table
Instead of using `orders` with `status='pending'`, we will create a dedicated `pos_carts` table to store ongoing cart states.

**Schema:**
```sql
CREATE TABLE pos_carts (
  table_id UUID PRIMARY KEY REFERENCES cafe_tables(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id),
  cart_data JSONB DEFAULT '[]'::jsonb,
  customer_data JSONB DEFAULT null,
  order_type TEXT DEFAULT 'Dine-in',
  discount_type TEXT DEFAULT 'FLAT',
  discount_value NUMERIC DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now()
);
```
*Why this is better:* 
- One row per table. 
- Upserting is atomic and simple (`ON CONFLICT (table_id) DO UPDATE`).
- Doesn't pollute `orders` or `order_items` tables.
- JSONB is perfect for storing the exact cart state.

## 3. Implementation Steps

### Step 1: Database Migration
Run a SQL query to create the `pos_carts` table.

### Step 2: Update `BillingPage.jsx` State
- Keep `tableCarts` in memory for zero-latency UI.
- Create a `syncCartToDB(tableId, cartState)` function that simply upserts the entire JSON to `pos_carts`.
- On page load, fetch all rows from `pos_carts` for the branch and populate the in-memory `tableCarts`.

### Step 3: Implement Table Switcher Dropdown
- Remove the horizontal pill bar.
- Add a sleek custom dropdown in the top header (next to the Back button or in the Cart header).
- The dropdown will list all tables. Tables with active carts will show a small dot or item count.

### Step 4: Checkout / Payment Flow
- When a payment is successful, delete the row from `pos_carts` for that `table_id`.
- Proceed with creating the actual `orders` and `order_items` exactly as it works now.

## 4. Expected Outcome
- **Zero Data Loss:** Cart state is saved reliably as JSON.
- **Clean DB:** Real orders are only created when money is received.
- **Better UX:** Dropdown saves space and makes table switching cleaner.
