# Sudo — Cloud Sync Setup (Supabase + PowerSync)

The app works fully offline out of the box (data lives in a local SQLite database in your browser).
To get **login + real-time sync across devices**, connect the two free-tier services below.
Takes about 15 minutes.

---

## 1. Create a Supabase project (free)

1. Go to [supabase.com](https://supabase.com) → New project (any name, e.g. `sudo-finance`).
2. Wait for the project to provision.
3. **Authentication → Providers → Email**: keep Email enabled. For a single-user app you may
   also want to disable "Allow new users to sign up" *after* you create your own account.

## 2. Run the database migration

Open **SQL Editor** in Supabase and run the whole script below. It creates every table,
enables Row Level Security (only you can read/write your rows), and creates the
`powersync` publication.

```sql
-- ===== Sudo Finance schema =====
-- All money columns are integer paise. IDs are text (client-generated).

create table public.parties (
  id text primary key,
  owner_id uuid not null default auth.uid(),
  name text not null,
  type text not null default 'customer',
  phone text,
  address text,
  note text,
  created_at text
);

create table public.item_categories (
  id text primary key,
  owner_id uuid not null default auth.uid(),
  name text not null
);

create table public.items (
  id text primary key,
  owner_id uuid not null default auth.uid(),
  name text not null,
  category_id text,
  unit text,
  selling_price bigint,
  qty double precision not null default 0,
  avg_cost bigint not null default 0,
  created_at text
);

create table public.accounts (
  id text primary key,
  owner_id uuid not null default auth.uid(),
  code text,
  name text not null,
  type text not null,
  subtype text,
  is_system integer not null default 0,
  archived integer not null default 0,
  created_at text
);

create table public.journal_entries (
  id text primary key,
  owner_id uuid not null default auth.uid(),
  date text not null,
  memo text,
  source_type text,
  source_id text,
  created_at text
);

create table public.journal_lines (
  id text primary key,
  owner_id uuid not null default auth.uid(),
  entry_id text not null,
  account_id text not null,
  amount bigint not null,
  party_id text,
  date text
);

create table public.sales (
  id text primary key,
  owner_id uuid not null default auth.uid(),
  invoice_no text,
  seq integer,
  party_id text,
  date text not null,
  status text,
  subtotal bigint not null default 0,
  discount_amount bigint not null default 0,
  discount_pct double precision not null default 0,
  total bigint not null default 0,
  paid_amount bigint not null default 0,
  cogs_total bigint not null default 0,
  profit bigint not null default 0,
  note text,
  created_at text
);

create table public.sale_items (
  id text primary key,
  owner_id uuid not null default auth.uid(),
  sale_id text not null,
  item_id text,
  name text,
  qty double precision not null default 0,
  unit_price bigint not null default 0,
  unit_cost bigint not null default 0,
  line_total bigint not null default 0
);

create table public.purchases (
  id text primary key,
  owner_id uuid not null default auth.uid(),
  bill_no text,
  seq integer,
  party_id text,
  date text not null,
  status text,
  subtotal bigint not null default 0,
  discount_amount bigint not null default 0,
  discount_pct double precision not null default 0,
  total bigint not null default 0,
  paid_amount bigint not null default 0,
  note text,
  created_at text
);

create table public.purchase_items (
  id text primary key,
  owner_id uuid not null default auth.uid(),
  purchase_id text not null,
  item_id text,
  name text,
  qty double precision not null default 0,
  unit_price bigint not null default 0,
  line_total bigint not null default 0
);

create table public.payments (
  id text primary key,
  owner_id uuid not null default auth.uid(),
  direction text not null,
  party_id text,
  date text not null,
  amount bigint not null default 0,
  account_id text,
  method text,
  note text,
  created_at text
);

create table public.payment_allocations (
  id text primary key,
  owner_id uuid not null default auth.uid(),
  payment_id text not null,
  sale_id text,
  purchase_id text,
  amount bigint not null default 0
);

create table public.expenses (
  id text primary key,
  owner_id uuid not null default auth.uid(),
  category_id text,
  date text not null,
  amount bigint not null default 0,
  account_id text,
  note text,
  created_at text
);

create table public.other_incomes (
  id text primary key,
  owner_id uuid not null default auth.uid(),
  source text,
  date text not null,
  amount bigint not null default 0,
  account_id text,
  note text,
  created_at text
);

create table public.fixed_assets (
  id text primary key,
  owner_id uuid not null default auth.uid(),
  name text not null,
  purchase_date text,
  cost bigint not null default 0,
  account_id text,
  note text,
  created_at text
);

create table public.app_settings (
  id text primary key,
  owner_id uuid not null default auth.uid(),
  key text not null,
  value text
);

-- ===== Row Level Security =====
do $$
declare t text;
begin
  foreach t in array array[
    'parties','item_categories','items','accounts','journal_entries','journal_lines',
    'sales','sale_items','purchases','purchase_items','payments','payment_allocations',
    'expenses','other_incomes','fixed_assets','app_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner_all" on public.%I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())',
      t
    );
  end loop;
end $$;

-- ===== Table privileges (required for Supabase REST API / app uploads) =====
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

-- ===== PowerSync publication =====
create publication powersync for table
  public.parties, public.item_categories, public.items, public.accounts,
  public.journal_entries, public.journal_lines, public.sales, public.sale_items,
  public.purchases, public.purchase_items, public.payments, public.payment_allocations,
  public.expenses, public.other_incomes, public.fixed_assets, public.app_settings;
```

## 3. Create a PowerSync Cloud instance (free)

1. Sign up at [powersync.journeyapps.com](https://powersync.journeyapps.com).
2. **Create instance** → name it (e.g. `sudo`).
3. In the instance settings choose **Connect to Supabase** and follow the wizard —
   it asks for your Supabase project URL / connection details and sets up the connection.
   (Docs: [Supabase + PowerSync guide](https://docs.powersync.com/integrations/supabase/guide).)
4. Enable **"Supabase auth"** in the instance's Client Auth settings (it verifies Supabase JWTs
   automatically using your Supabase project's JWT secret / URL).

## 4. Sync rules

In the PowerSync dashboard, open `sync-rules.yaml` for your instance, paste this, and deploy:

```yaml
bucket_definitions:
  user_data:
    parameters: select request.user_id() as user_id
    data:
      - select * from parties where owner_id = bucket.user_id
      - select * from item_categories where owner_id = bucket.user_id
      - select * from items where owner_id = bucket.user_id
      - select * from accounts where owner_id = bucket.user_id
      - select * from journal_entries where owner_id = bucket.user_id
      - select * from journal_lines where owner_id = bucket.user_id
      - select * from sales where owner_id = bucket.user_id
      - select * from sale_items where owner_id = bucket.user_id
      - select * from purchases where owner_id = bucket.user_id
      - select * from purchase_items where owner_id = bucket.user_id
      - select * from payments where owner_id = bucket.user_id
      - select * from payment_allocations where owner_id = bucket.user_id
      - select * from expenses where owner_id = bucket.user_id
      - select * from other_incomes where owner_id = bucket.user_id
      - select * from fixed_assets where owner_id = bucket.user_id
      - select * from app_settings where owner_id = bucket.user_id
```

## 5. Point the app at your services

Create `.env.local` in the project root (copy from `.env.example`):

```bash
VITE_SUPABASE_URL=https://YOURPROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...   # Settings -> API keys (anon/publishable key)
VITE_POWERSYNC_URL=https://YOURINSTANCE.powersync.journeyapps.com
```

Restart the dev server (`npm run dev`). The app now shows a login screen —
create your account, sign in, and everything you already entered locally will
upload and start syncing in real time to every device you sign in on.

## Notes

- **Single user**: after creating your account, disable public sign-ups in Supabase Auth settings.
- **Offline**: the app always writes locally first; PowerSync uploads queued changes whenever
  you come back online (works in the installed PWA too).
- **Backups**: Supabase keeps your Postgres data; you can also export from Settings inside the app.
