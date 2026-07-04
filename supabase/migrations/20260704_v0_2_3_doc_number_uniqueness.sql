-- Sudo v0.2.3 — enforce unique invoice / bill numbers per business.
--
-- The client already re-rolls colliding sequence numbers before saving
-- (see src/domain/docnum.ts), but two offline devices can still both pick
-- the same number before either has synced. This constraint turns that rare
-- case into a loud, recoverable sync error instead of a silent duplicate
-- invoice number in the books.
--
-- If this fails with "could not create unique index" you already have
-- duplicate invoice/bill numbers in production — find and rename them first:
--   select owner_id, invoice_no, count(*) from public.sales
--     group by 1, 2 having count(*) > 1;
--   select owner_id, bill_no, count(*) from public.purchases
--     group by 1, 2 having count(*) > 1;

create unique index if not exists sales_owner_invoice_no_uidx
  on public.sales (owner_id, invoice_no);

create unique index if not exists purchases_owner_bill_no_uidx
  on public.purchases (owner_id, bill_no);
