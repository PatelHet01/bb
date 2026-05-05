-- ============================================================
-- BOMBAY BETHAK — MVP DATABASE SCHEMA (FIXED)
-- Drop and recreate cleanly. Run in Supabase SQL Editor.
-- ============================================================

-- Drop in reverse FK order
drop table if exists reward_redemptions cascade;
drop table if exists rewards cascade;
drop table if exists salary_records cascade;
drop table if exists workers cascade;
drop table if exists ghoda_transactions cascade;
drop table if exists advance_ledger cascade;
drop table if exists khata_ledger cascade;
drop table if exists order_payments cascade;
drop table if exists order_items cascade;
drop table if exists orders cascade;
drop table if exists items cascade;
drop table if exists customers cascade;
drop table if exists branches cascade;

-- BRANCHES (text PK — 'gurukul', 'bhat', 'visat')
create table branches (
  id text primary key,
  name text not null,
  location text,
  created_at timestamptz default now()
);

insert into branches (id, name, location) values
  ('gurukul', 'Gurukul', 'Gurukul, Ahmedabad'),
  ('bhat', 'Bhat', 'Bhat, Ahmedabad'),
  ('visat', 'Visat', 'Visat, Ahmedabad');

-- CUSTOMERS
create table customers (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  name text not null,
  mobile_number text unique not null,
  dob date not null,
  branch_id text references branches(id),
  ghoda_coins int default 0,
  created_at timestamptz default now()
);

-- ITEMS
create table items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  unit text default 'piece',
  price numeric(10,2) not null,
  cost_price numeric(10,2),
  stock int default 0,
  branch_id text references branches(id),
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ORDERS
create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  branch_id text references branches(id),
  total numeric(10,2) not null,
  status text default 'completed' check (status in ('completed','voided')),
  created_at timestamptz default now()
);

-- ORDER PAYMENTS (Supports split payments)
create table order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  mode text not null check (mode in ('CASH','ONLINE','KHATA','ADVANCE')),
  online_subtype text check (online_subtype in ('UPI','CREDIT_CARD','DEBIT_CARD') or online_subtype is null),
  amount numeric(10,2) not null,
  created_at timestamptz default now()
);

-- ORDER ITEMS
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  item_id uuid references items(id),
  quantity int not null,
  unit_price numeric(10,2) not null
);

-- KHATA LEDGER (Devaa / Levana)
create table khata_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  branch_id text references branches(id),
  type text not null check (type in ('CREDIT','PAYMENT','ADJUSTMENT')),
  amount numeric(10,2) not null,
  reason text,
  order_id uuid references orders(id) on delete set null,
  recorded_by text,
  created_at timestamptz default now()
);

-- ADVANCE LEDGER
create table advance_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  branch_id text references branches(id),
  type text not null check (type in ('TOPUP','DEDUCTION','REFUND')),
  amount numeric(10,2) not null,
  reason text,
  order_id uuid references orders(id) on delete set null,
  recorded_by text,
  created_at timestamptz default now()
);

-- GHODA TRANSACTIONS
create table ghoda_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  type text not null check (type in ('earn','spend','bet')),
  amount int not null,
  reason text,
  created_at timestamptz default now()
);

-- WORKERS
create table workers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text,
  branch_id text references branches(id),
  base_salary numeric(10,2),
  join_date date,
  created_at timestamptz default now()
);

-- SALARY RECORDS
create table salary_records (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid references workers(id),
  month int not null,
  year int not null,
  base_salary numeric(10,2),
  advance numeric(10,2) default 0,
  net_payable numeric(10,2),
  status text default 'unpaid' check (status in ('paid','unpaid','partial')),
  created_at timestamptz default now()
);

-- REWARDS
create table rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  ghoda_cost int not null,
  stock int default -1,
  is_active boolean default true,
  branch_id text references branches(id),
  created_at timestamptz default now()
);

-- REWARD REDEMPTIONS
create table reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  reward_id uuid references rewards(id),
  created_at timestamptz default now()
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Test customers
insert into customers (username, name, mobile_number, dob, branch_id, ghoda_coins) values
  ('rahul_s', 'Rahul Sharma', '9876543210', '1990-05-15', 'gurukul', 150),
  ('priya_p', 'Priya Patel', '9123456780', '1995-08-20', 'bhat', 80);

-- Gurukul — Smoke Lounge
insert into items (name, category, unit, price, branch_id) values
  ('Classic Cigarette', 'Smoke Lounge', 'piece', 15, 'gurukul'),
  ('Gutka Pouch', 'Smoke Lounge', 'piece', 1, 'gurukul'),
  ('Khaini Pouch', 'Smoke Lounge', 'piece', 1, 'gurukul'),
  ('Hookah Session', 'Smoke Lounge', 'session', 300, 'gurukul'),
  ('Lighter', 'Smoke Lounge', 'piece', 30, 'gurukul'),
  ('Rolling Paper', 'Smoke Lounge', 'pack', 20, 'gurukul'),
  ('E-Cigarette Refill', 'Smoke Lounge', 'piece', 150, 'gurukul');

-- Gurukul — Paan
insert into items (name, category, unit, price, branch_id) values
  ('Meetha Paan', 'Paan Parlour', 'piece', 20, 'gurukul'),
  ('Saada Paan', 'Paan Parlour', 'piece', 15, 'gurukul'),
  ('Special Paan', 'Paan Parlour', 'piece', 50, 'gurukul'),
  ('Chocolate Paan', 'Paan Parlour', 'piece', 60, 'gurukul'),
  ('Fire Paan', 'Paan Parlour', 'piece', 80, 'gurukul');

-- Bhat — Smoke
insert into items (name, category, unit, price, branch_id) values
  ('Classic Cigarette', 'Smoke Lounge', 'piece', 15, 'bhat'),
  ('Gutka Pouch', 'Smoke Lounge', 'piece', 1, 'bhat'),
  ('Hookah Session', 'Smoke Lounge', 'session', 300, 'bhat');

-- Bhat — Paan
insert into items (name, category, unit, price, branch_id) values
  ('Meetha Paan', 'Paan Parlour', 'piece', 20, 'bhat'),
  ('Special Paan', 'Paan Parlour', 'piece', 50, 'bhat');

-- Bhat — BB Cafe (from actual menu data)
insert into items (name, category, unit, price, branch_id) values
  ('Vada Pav (Oil)', 'BB Cafe', 'piece', 30, 'bhat'),
  ('Vada Pav (Butter)', 'BB Cafe', 'piece', 40, 'bhat'),
  ('Masala Chai', 'BB Cafe', 'piece', 20, 'bhat'),
  ('Bournvita Hot', 'BB Cafe', 'piece', 30, 'bhat'),
  ('Cold Coffee', 'BB Cafe', 'piece', 79, 'bhat'),
  ('Hazelnut Cold Coffee', 'BB Cafe', 'piece', 99, 'bhat'),
  ('Masala Maggi', 'BB Cafe', 'piece', 80, 'bhat'),
  ('Cheese Maggi', 'BB Cafe', 'piece', 100, 'bhat'),
  ('Veg Sandwich (Normal)', 'BB Cafe', 'piece', 40, 'bhat'),
  ('Cheese Veg Sandwich (Grill)', 'BB Cafe', 'piece', 150, 'bhat'),
  ('Peri Peri Sandwich (Grill)', 'BB Cafe', 'piece', 150, 'bhat'),
  ('Aloo Tikki Burger', 'BB Cafe', 'piece', 60, 'bhat'),
  ('Cheese Burger', 'BB Cafe', 'piece', 70, 'bhat'),
  ('Peri Peri Fries', 'BB Cafe', 'piece', 110, 'bhat'),
  ('Cheese Fries', 'BB Cafe', 'piece', 120, 'bhat'),
  ('Masala Pasta', 'BB Cafe', 'piece', 80, 'bhat'),
  ('Cheese Pasta', 'BB Cafe', 'piece', 130, 'bhat'),
  ('Veg Frankie', 'BB Cafe', 'piece', 80, 'bhat'),
  ('Cheese Frankie', 'BB Cafe', 'piece', 120, 'bhat'),
  ('Choco Blast Waffle (Single)', 'BB Cafe', 'piece', 50, 'bhat'),
  ('Sizzling Brownie + Ice Cream', 'BB Cafe', 'piece', 149, 'bhat'),
  ('Single Cheese Pizza', 'BB Cafe', 'piece', 120, 'bhat'),
  ('Pav Bhaji', 'BB Cafe', 'piece', 120, 'bhat'),
  ('Cheese Pav Bhaji', 'BB Cafe', 'piece', 160, 'bhat'),
  ('Aloo Paratha (Oil)', 'BB Cafe', 'piece', 70, 'bhat'),
  ('Paneer Paratha', 'BB Cafe', 'piece', 150, 'bhat');

-- Visat — Smoke
insert into items (name, category, unit, price, branch_id) values
  ('Classic Cigarette', 'Smoke Lounge', 'piece', 15, 'visat'),
  ('Gutka Pouch', 'Smoke Lounge', 'piece', 1, 'visat'),
  ('Hookah Session', 'Smoke Lounge', 'session', 300, 'visat');

-- Visat — Paan
insert into items (name, category, unit, price, branch_id) values
  ('Meetha Paan', 'Paan Parlour', 'piece', 20, 'visat'),
  ('Special Paan', 'Paan Parlour', 'piece', 50, 'visat'),
  ('Fire Paan', 'Paan Parlour', 'piece', 80, 'visat');

-- Disable RLS for MVP
alter table branches disable row level security;
alter table customers disable row level security;
alter table items disable row level security;
alter table orders disable row level security;
alter table order_items disable row level security;
alter table order_payments disable row level security;
alter table khata_ledger disable row level security;
alter table advance_ledger disable row level security;
alter table ghoda_transactions disable row level security;
alter table workers disable row level security;
alter table salary_records disable row level security;
alter table rewards disable row level security;
alter table reward_redemptions disable row level security;
