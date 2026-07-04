-- Sudo v0.2.2 — item opening stock baselines for inventory replay on purchase delete/edit
-- Fixes: "Could not find the 'opening_qty' column of 'items' in the schema cache"
--
-- Run in Supabase SQL Editor, then in PowerSync dashboard reconnect / refresh schema if offered.

alter table public.items
  add column if not exists opening_qty double precision not null default 0;

alter table public.items
  add column if not exists opening_unit_cost bigint not null default 0;

-- Items with no purchase/sale history: current qty/avg_cost is the opening baseline
update public.items i
set opening_qty = i.qty,
    opening_unit_cost = i.avg_cost
where i.opening_qty = 0
  and i.opening_unit_cost = 0
  and not exists (select 1 from public.sale_items si where si.item_id = i.id)
  and not exists (select 1 from public.purchase_items pi where pi.item_id = i.id);

-- Refresh PostgREST schema cache (Supabase API) immediately
notify pgrst, 'reload schema';
