# Sudo — Cloud Sync Setup (Supabase Realtime)

The app works fully offline out of the box (data lives in a local SQLite database in your browser).
To get **login + real-time sync across devices**, create a free Supabase project and enable Realtime.
Takes about 10 minutes.

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
  opening_qty double precision not null default 0,
  opening_unit_cost bigint not null default 0,
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
  include_in_liquid integer not null default 1,
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

create table public.recurring_expenses (
  id text primary key,
  owner_id uuid not null default auth.uid(),
  label text not null,
  category_id text,
  amount bigint not null default 0,
  account_id text,
  day_of_month integer not null default 1,
  active integer not null default 1,
  last_posted_month text,
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
    'expenses','recurring_expenses','other_incomes','fixed_assets','app_settings'
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

-- ===== Realtime =====
-- After deploy, run supabase/migrations/20260704_realtime_publication.sql
```

### Already set up? Upgrade migrations

Run these in the Supabase **SQL Editor** (in order if you skipped earlier ones):

| Version | File | Fixes |
|---------|------|-------|
| v0.2.0 | `supabase/migrations/20260704_v0_2_0.sql` | `include_in_liquid`, `recurring_expenses` |
| v0.2.2 | `supabase/migrations/20260704_v0_2_2_inventory_opening.sql` | `opening_qty`, `opening_unit_cost` on items |
| v0.2.3 | `supabase/migrations/20260704_factory_reset_rpc.sql` | `factory_reset_user()` — wipe local + cloud in Settings |
| v0.3.0 | `supabase/migrations/20260704_v0_2_3_doc_number_uniqueness.sql` | Unique `(owner_id, invoice_no)` / `(owner_id, bill_no)` |
| v0.3.1 | `supabase/migrations/20260704_realtime_publication.sql` | Enable Realtime on all synced tables |

## 3. Enable Realtime

Run `supabase/migrations/20260704_realtime_publication.sql` in the SQL Editor (adds all business tables to the `supabase_realtime` publication).

In **Database → Replication**, confirm the tables are listed under Realtime.

## 4. Point the app at Supabase

Create `.env.local` in the project root (copy from `.env.example`):

```bash
VITE_SUPABASE_URL=https://YOURPROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...   # Settings -> API keys (anon/publishable key)
```

Restart the dev server (`npm run dev`). The app shows a login screen — sign in and local data uploads to Postgres; other devices receive changes via Supabase Realtime.

## Troubleshooting

- **Realtime disconnected** — Settings → Cloud sync → reconnect (↻), or sign out/in. Check that `20260704_realtime_publication.sql` was applied.
- **Upload errors** — Settings → Cloud sync shows rejected changes. Common causes: missing migration, RLS, or schema mismatch.
- **Same Supabase project** — `.env.local` URL/key must match the project where you ran the SQL.

## Notes

- **Single user**: after creating your account, disable public sign-ups in Supabase Auth settings.
- **Offline**: writes go to local SQLite first; pending changes upload when back online.
- **Backups**: Supabase keeps your Postgres data; you can also export from Settings inside the app.
