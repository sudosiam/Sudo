-- Sudo v0.2.0 — run in Supabase SQL Editor if you already deployed the base schema.
-- Fixes: "Could not find the 'include_in_liquid' column of 'accounts' in the schema cache"

-- 1. Bank accounts: optional exclusion from total liquid KPI
alter table public.accounts
  add column if not exists include_in_liquid integer not null default 1;

-- 2. Recurring expenses (new synced table)
create table if not exists public.recurring_expenses (
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

alter table public.recurring_expenses enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recurring_expenses' and policyname = 'owner_all'
  ) then
    create policy "owner_all" on public.recurring_expenses
      for all to authenticated
      using (owner_id = auth.uid())
      with check (owner_id = auth.uid());
  end if;
end $$;

grant select, insert, update, delete on public.recurring_expenses to authenticated;

-- 3. PowerSync publication (skip if table already published)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'powersync' and schemaname = 'public' and tablename = 'recurring_expenses'
  ) then
    alter publication powersync add table public.recurring_expenses;
  end if;
end $$;

-- After running: in PowerSync dashboard → Instance → Reconnect / refresh schema if offered,
-- then add to sync-rules.yaml:
--   - select * from recurring_expenses where owner_id = bucket.user_id
