-- Factory reset: delete all synced rows for the signed-in user in one RPC call.
-- Run in Supabase SQL Editor (see SETUP.md upgrade migrations).

create or replace function public.factory_reset_user()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.payment_allocations where owner_id = uid;
  delete from public.sale_items where owner_id = uid;
  delete from public.purchase_items where owner_id = uid;
  delete from public.journal_lines where owner_id = uid;
  delete from public.payments where owner_id = uid;
  delete from public.sales where owner_id = uid;
  delete from public.purchases where owner_id = uid;
  delete from public.expenses where owner_id = uid;
  delete from public.recurring_expenses where owner_id = uid;
  delete from public.other_incomes where owner_id = uid;
  delete from public.fixed_assets where owner_id = uid;
  delete from public.journal_entries where owner_id = uid;
  delete from public.items where owner_id = uid;
  delete from public.parties where owner_id = uid;
  delete from public.item_categories where owner_id = uid;
  delete from public.accounts where owner_id = uid;
  delete from public.app_settings where owner_id = uid;
end;
$$;

revoke all on function public.factory_reset_user() from public;
grant execute on function public.factory_reset_user() to authenticated;
