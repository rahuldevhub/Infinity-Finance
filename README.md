# Infinity GST — GST Accounting Web App

A full-stack GST accounting application for **Infinity Enterprises**, built with React + TypeScript + Vite + Supabase.

---

## Features

- **Dashboard** — Monthly P&L overview, GST collected, ITC, net payable, bar charts
- **Invoices** — Create, view, download PDF, mark as paid, filter by month/brand/status
- **Expenses** — Track expenses with ITC eligibility, upload bills to cloud storage
- **GST Summary** — Month-wise output/input tax breakdown, B2B vs B2C comparison
- **GST Filing Helper** — GSTR-1 and GSTR-3B data with CSV export
- **Clients** — Manage client database with GSTIN
- **Settings** — Business details, bank info, sub-brands
- **PWA** — Installable on Android and iOS like a native app

---

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS v4
- **Backend/DB:** Supabase (PostgreSQL + Auth + Storage)
- **PDF:** @react-pdf/renderer
- **Charts:** Recharts
- **PWA:** vite-plugin-pwa

---

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **anon public key** from Settings → API

### 3. Configure Environment Variables

Edit `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run the Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Copy the full contents of `supabase-schema.sql`
3. Paste and click **Run**

### 5. Create the Storage Bucket

In Supabase → **Storage**:

1. Create a new bucket named `expense-bills`, set to **Private**
2. Run these storage RLS policies in the SQL Editor:

```sql
create policy "Authenticated users can upload bills"
on storage.objects for insert
with check (bucket_id = 'expense-bills' and auth.role() = 'authenticated');

create policy "Authenticated users can view bills"
on storage.objects for select
using (bucket_id = 'expense-bills' and auth.role() = 'authenticated');
```

---

## Creating User Accounts

> There is **no public signup** in the app by design. Create accounts manually.

### Step 1: Create Auth Users in Supabase

Go to Supabase → **Authentication** → **Users** → **Add User**:

| User       | Email                              | Role  |
|------------|------------------------------------|-------|
| Owner      | owner@infinityenterprises.com      | owner |
| CEO        | ceo@infinityenterprises.com        | ceo   |

### Step 2: Insert Profile Records

After creating the users, get their UUIDs from the Auth Users list, then run in SQL Editor:

```sql
insert into profiles (id, full_name, role) values
  ('paste-owner-uuid-here', 'Owner Full Name', 'owner'),
  ('paste-ceo-uuid-here',   'CEO Full Name',   'ceo');
```

### Step 3: Fill in Business Settings

Log in → **Settings** → Fill in GSTIN, address, bank account details.

---

## Running Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Build for Production

```bash
npm run build
npm run preview
```

Deploy the `dist/` folder to Vercel, Netlify, or any static host.

---

## Installing as PWA

### Android (Chrome)
1. Open the app in Chrome
2. Tap menu (⋮) → **Add to Home Screen** → **Install**

### iOS (Safari)
1. Open the app in Safari
2. Tap the Share button → **Add to Home Screen** → **Add**

---

## GST Calculation Logic

- Business state: **Tamil Nadu (code: 33)**
- Place of Supply = Tamil Nadu → **Intra-state** → CGST + SGST (split equally)
- Place of Supply ≠ Tamil Nadu → **Inter-state** → IGST only

---

## Sub-brands

Both sub-brands operate under the single GST registration of **Infinity Enterprises**:

| Sub-brand         | Use case                    |
|-------------------|-----------------------------|
| Ritera Publishing | Publishing-related invoices |
| Ratixinfo Tech    | Technology-related invoices |

The sub-brand is shown on invoice PDFs below the main company name.

---

## Invoice Number Format

`INF-YYYY-XXXX` — e.g. `INF-2024-0001`

Auto-incremented from the last invoice in the database. Can be manually overridden when creating an invoice.
