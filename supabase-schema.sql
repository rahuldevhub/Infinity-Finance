-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  role text not null check (role in ('owner', 'ceo')),
  created_at timestamptz default now()
);

-- Business settings table
create table if not exists business_settings (
  id uuid default uuid_generate_v4() primary key,
  gst_name text not null default 'Infinity Enterprises',
  gstin text not null default '',
  address text not null default '',
  state text not null default 'Tamil Nadu',
  state_code text not null default '33',
  sub_brands text[] not null default '{"Ritera Publishing","Ratixinfo Tech"}',
  bank_details jsonb not null default '{"bank_name":"","account_number":"","ifsc_code":"","branch":"","account_name":""}',
  updated_at timestamptz default now()
);

-- Insert default business settings row
insert into business_settings (gst_name, gstin, address, state, state_code, sub_brands, bank_details)
values (
  'Infinity Enterprises',
  '',
  '',
  'Tamil Nadu',
  '33',
  '{"Ritera Publishing","Ratixinfo Tech"}',
  '{"bank_name":"","account_number":"","ifsc_code":"","branch":"","account_name":""}'
) on conflict do nothing;

-- Clients table
create table if not exists clients (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  gstin text,
  address text not null default '',
  state text not null default '',
  state_code text not null default '',
  email text,
  phone text,
  created_at timestamptz default now()
);

-- Invoices table
create table if not exists invoices (
  id uuid default uuid_generate_v4() primary key,
  invoice_number text unique not null,
  invoice_date date not null,
  due_date date,
  client_id uuid references clients(id) on delete restrict,
  sub_brand text not null,
  place_of_supply text not null,
  place_of_supply_code text not null,
  is_igst boolean not null default false,
  items jsonb[] not null default '{}',
  taxable_value numeric(12,2) not null default 0,
  cgst_amount numeric(12,2) not null default 0,
  sgst_amount numeric(12,2) not null default 0,
  igst_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  payment_status text not null default 'pending' check (payment_status in ('paid', 'pending', 'partial')),
  invoice_type text default 'gst' check (invoice_type in ('gst', 'non_gst')),
  notes text,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- Expenses table
create table if not exists expenses (
  id uuid default uuid_generate_v4() primary key,
  date date not null,
  vendor_name text not null,
  description text not null default '',
  category text not null,
  taxable_amount numeric(12,2) not null default 0,
  gst_amount numeric(12,2) not null default 0,
  gst_rate numeric(5,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  is_itc_eligible boolean not null default true,
  bill_url text,
  gstin_of_vendor text,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- Row Level Security (RLS)
alter table profiles enable row level security;
alter table business_settings enable row level security;
alter table clients enable row level security;
alter table invoices enable row level security;
alter table expenses enable row level security;

-- Profiles: users can read all, update their own
create policy "Users can view all profiles" on profiles for select using (auth.role() = 'authenticated');
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Business settings: authenticated users can read and update
create policy "Authenticated users can view settings" on business_settings for select using (auth.role() = 'authenticated');
create policy "Authenticated users can update settings" on business_settings for update using (auth.role() = 'authenticated');

-- Clients: authenticated users have full access
create policy "Authenticated users can manage clients" on clients for all using (auth.role() = 'authenticated');

-- Invoices: authenticated users have full access
create policy "Authenticated users can manage invoices" on invoices for all using (auth.role() = 'authenticated');

-- Expenses: authenticated users have full access
create policy "Authenticated users can manage expenses" on expenses for all using (auth.role() = 'authenticated');

-- Storage bucket for expense bills (run this in Supabase dashboard > Storage)
-- insert into storage.buckets (id, name, public) values ('expense-bills', 'expense-bills', false);
-- create policy "Authenticated users can upload bills" on storage.objects for insert with check (bucket_id = 'expense-bills' and auth.role() = 'authenticated');
-- create policy "Authenticated users can view bills" on storage.objects for select using (bucket_id = 'expense-bills' and auth.role() = 'authenticated');

-- ============================================================
-- FEATURE 1: Cash Flow Tracker
-- ============================================================

create table if not exists cash_transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  type text not null check (type in ('in', 'out')),
  category text not null,
  description text not null,
  amount numeric not null check (amount > 0),
  payment_mode text not null default 'bank' check (payment_mode in ('cash', 'bank', 'upi', 'card', 'razorpay')),
  reference text,
  sub_brand text,
  created_at timestamptz default now(),
  created_by uuid references auth.users
);

alter table cash_transactions enable row level security;
create policy "Authenticated users full access"
  on cash_transactions for all to authenticated using (true) with check (true);

-- ============================================================
-- FEATURE 2: Quotation Builder
-- ============================================================

create table if not exists quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_number text unique not null,
  date date not null,
  valid_until date,
  client_id uuid references clients,
  client_name_override text,
  client_email_override text,
  sub_brand text not null,
  title text not null,
  items jsonb not null default '[]',
  taxable_value numeric default 0,
  include_gst boolean default true,
  gst_rate numeric default 18,
  cgst_amount numeric default 0,
  sgst_amount numeric default 0,
  igst_amount numeric default 0,
  is_igst boolean default false,
  total_amount numeric default 0,
  notes text,
  terms text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'approved', 'rejected', 'converted')),
  converted_invoice_id uuid references invoices,
  created_at timestamptz default now(),
  created_by uuid references auth.users
);

alter table quotations enable row level security;
create policy "Authenticated users can manage quotations"
  on quotations for all using (auth.role() = 'authenticated');

-- Invoice type column (run this if invoices table already exists):
-- ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type text DEFAULT 'gst' CHECK (invoice_type IN ('gst', 'non_gst'));

-- Enhancement columns (run these if table already exists):
-- ALTER TABLE quotations ADD COLUMN IF NOT EXISTS consultant_name text;
-- ALTER TABLE quotations ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'percent' CHECK (discount_type IN ('flat', 'percent'));
-- ALTER TABLE quotations ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0;
-- ALTER TABLE quotations ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;
-- ALTER TABLE quotations ADD COLUMN IF NOT EXISTS payment_schedule jsonb DEFAULT '[]';

-- ─── Proforma Invoices ────────────────────────────────────────────────────────
create table if not exists proforma_invoices (
  id uuid default uuid_generate_v4() primary key,
  proforma_number text not null unique,
  date date not null default current_date,
  due_date date,
  client_id uuid references clients(id) on delete set null,
  client_name_override text,
  sub_brand text not null default '',
  quotation_id uuid references quotations(id) on delete set null,
  items jsonb not null default '[]',
  taxable_value numeric not null default 0,
  include_gst boolean not null default true,
  gst_rate numeric not null default 18,
  cgst_amount numeric not null default 0,
  sgst_amount numeric not null default 0,
  igst_amount numeric not null default 0,
  is_igst boolean not null default false,
  total_amount numeric not null default 0,
  notes text,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'partial')),
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'cancelled')),
  converted_invoice_id uuid references invoices(id) on delete set null,
  created_at timestamptz default now(),
  created_by uuid references auth.users
);

alter table proforma_invoices enable row level security;
create policy "Authenticated users can manage proforma_invoices"
  on proforma_invoices for all using (auth.role() = 'authenticated');

-- ─── Payment Receipts ─────────────────────────────────────────────────────────
create table if not exists payment_receipts (
  id uuid default uuid_generate_v4() primary key,
  receipt_number text not null unique,
  date date not null default current_date,
  client_id uuid references clients(id) on delete set null,
  client_name_override text,
  sub_brand text not null default '',
  amount_received numeric not null default 0,
  payment_mode text not null default 'Bank' check (payment_mode in ('Cash', 'Bank', 'UPI', 'Card', 'Razorpay', 'Cheque')),
  payment_reference text,
  towards text,
  invoice_id uuid references invoices(id) on delete set null,
  proforma_id uuid references proforma_invoices(id) on delete set null,
  quotation_id uuid references quotations(id) on delete set null,
  notes text,
  created_at timestamptz default now(),
  created_by uuid references auth.users
);

alter table payment_receipts enable row level security;
create policy "Authenticated users can manage payment_receipts"
  on payment_receipts for all using (auth.role() = 'authenticated');
