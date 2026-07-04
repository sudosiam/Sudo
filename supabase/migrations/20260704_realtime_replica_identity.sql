-- Realtime filtered subscriptions need full row images on UPDATE/DELETE.
-- Without this, other devices may receive partial rows and miss changes.
-- Run in Supabase SQL Editor after 20260704_realtime_publication.sql.

do $$
declare t text;
begin
  foreach t in array array[
    'parties','item_categories','items','accounts','journal_entries','journal_lines',
    'sales','sale_items','purchases','purchase_items','payments','payment_allocations',
    'expenses','recurring_expenses','other_incomes','fixed_assets','app_settings'
  ] loop
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;
