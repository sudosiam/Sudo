-- Enable Supabase Realtime on all synced tables (replaces PowerSync publication).
-- Run in SQL Editor if you already deployed the base schema from SETUP.md.

do $$
declare t text;
begin
  foreach t in array array[
    'parties','item_categories','items','accounts','journal_entries','journal_lines',
    'sales','sale_items','purchases','purchase_items','payments','payment_allocations',
    'expenses','recurring_expenses','other_incomes','fixed_assets','app_settings'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
