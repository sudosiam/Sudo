import * as React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { usePowerSync } from '@powersync/react';
import { Pencil, Trash2, Phone, MapPin, StickyNote, ArrowLeftRight } from 'lucide-react';
import { useQuery } from '../../hooks/useQuery';
import { PageHeader } from '../../components/layout/PageHeader';
import { ListCard, ListRow } from '../../components/ListRow';
import { Button } from '../../components/ui/button';
import { Avatar, EmptyState, PageSpinner } from '../../components/ui/misc';
import { PayStatusBadge } from '../../components/ui/badge';
import { ConfirmDialog } from '../../components/ui/dialog';
import { formatPaise } from '../../lib/money';
import { formatISODate, formatISODateShort } from '../../lib/dates';
import { deletePurchase } from '../../domain/purchases';
import { haptic } from '../../lib/haptics';

interface PurchaseRow {
  id: string;
  bill_no: string;
  date: string;
  status: string;
  subtotal: number;
  discount_amount: number;
  total: number;
  paid_amount: number;
  note: string | null;
  party_id: string;
  party_name: string | null;
  party_phone: string | null;
  party_address: string | null;
}

export default function PurchaseDetail() {
  const { id } = useParams<{ id: string }>();
  const db = usePowerSync();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const { data: purchases, isLoading } = useQuery<PurchaseRow>({
    queryKey: ['purchase', id],
    query: `SELECT pu.*, p.name AS party_name, p.phone AS party_phone, p.address AS party_address
            FROM purchases pu LEFT JOIN parties p ON p.id = pu.party_id WHERE pu.id = ?`,
    parameters: [id],
  });
  const purchase = purchases?.[0];

  const { data: items } = useQuery<{ id: string; name: string; qty: number; unit_price: number; line_total: number }>({
    queryKey: ['purchase-items', id],
    query: `SELECT id, name, qty, unit_price, line_total FROM purchase_items WHERE purchase_id = ?`,
    parameters: [id],
  });

  const { data: payments } = useQuery<{ id: string; date: string; amount: number; account_name: string | null }>({
    queryKey: ['purchase-payments', id],
    query: `SELECT pm.id, pm.date, pa.amount, a.name AS account_name
            FROM payment_allocations pa
            JOIN payments pm ON pm.id = pa.payment_id
            LEFT JOIN accounts a ON a.id = pm.account_id
            WHERE pa.purchase_id = ?
            ORDER BY pm.date, pm.created_at`,
    parameters: [id],
  });

  if (isLoading) return <PageSpinner />;
  if (!purchase) return <EmptyState title="Purchase not found" />;

  const due = purchase.total - purchase.paid_amount;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={purchase.bill_no}
        subtitle={formatISODate(purchase.date)}
        back="/purchases"
        actions={
          <>
            <Button variant="outline" size="icon-sm" onClick={() => navigate(`/purchases/${purchase.id}/edit`)} aria-label="Edit">
              <Pencil />
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => setDeleteOpen(true)} aria-label="Delete">
              <Trash2 className="text-destructive" />
            </Button>
          </>
        }
      />

      <Link
        to={`/parties/${purchase.party_id}`}
        className="app-surface mb-3 flex items-start gap-3 p-4 transition-colors hover:bg-accent/35"
        onClick={() => haptic()}
      >
        <Avatar name={purchase.party_name ?? '?'} className="size-11" />
        <div className="min-w-0 flex-1 space-y-0.5 text-sm">
          <p className="font-medium">{purchase.party_name}</p>
          {purchase.party_phone && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="size-3" /> {purchase.party_phone}
            </p>
          )}
          {purchase.party_address && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3" /> {purchase.party_address}
            </p>
          )}
        </div>
        <PayStatusBadge status={purchase.status} />
      </Link>

      <ListCard className="mb-3">
        <div className="app-table-wrap">
          <table className="app-table">
            <thead>
              <tr>
                <th>Item</th>
                <th className="app-table-right">Qty</th>
                <th className="app-table-right">Cost</th>
                <th className="app-table-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items?.map((it) => (
                <tr key={it.id}>
                  <td>{it.name}</td>
                  <td className="app-table-right">{it.qty}</td>
                  <td className="app-table-right">{formatPaise(it.unit_price)}</td>
                  <td className="app-table-right font-semibold">{formatPaise(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-1.5 border-t px-4 py-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span><span className="tabular-nums">{formatPaise(purchase.subtotal)}</span>
          </div>
          {purchase.discount_amount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Discount</span><span className="tabular-nums">−{formatPaise(purchase.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span><span className="tabular-nums">{formatPaise(purchase.total)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Paid</span><span className="tabular-nums">{formatPaise(purchase.paid_amount)}</span>
          </div>
          {due > 0 && (
            <div className="flex justify-between text-xs font-medium text-destructive">
              <span>Balance due</span><span className="tabular-nums">{formatPaise(due)}</span>
            </div>
          )}
        </div>
      </ListCard>

      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Transactions
      </h2>
      {!payments?.length ? (
        <p className="mb-3 rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          No payments made yet — record one from the Payments module.
        </p>
      ) : (
        <ListCard className="mb-3">
          {payments.map((p) => (
            <ListRow
              key={p.id}
              to={`/payments/${p.id}`}
              avatar={
                <div className="flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <ArrowLeftRight className="size-4" />
                </div>
              }
              title="Payment made"
              subtitle={`${formatISODateShort(p.date)}${p.account_name ? ` · ${p.account_name}` : ''}`}
              right={<span className="text-destructive">−{formatPaise(p.amount)}</span>}
            />
          ))}
        </ListCard>
      )}

      {purchase.note && (
        <div className="flex items-start gap-2 rounded-lg border bg-card p-3 text-sm text-muted-foreground">
          <StickyNote className="mt-0.5 size-4 shrink-0" />
          {purchase.note}
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await deletePurchase(db, purchase.id);
          haptic('success');
          navigate('/purchases');
        }}
        title={`Delete ${purchase.bill_no}?`}
        message="Stock, ledger entries and linked payments created with this purchase will be reversed."
      />
    </div>
  );
}
