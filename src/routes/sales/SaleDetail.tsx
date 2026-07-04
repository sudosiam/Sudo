import * as React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDb } from '../../hooks/useQuery';
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
import { deleteSale } from '../../domain/sales';
import { haptic } from '../../lib/haptics';

interface SaleRow {
  id: string;
  invoice_no: string;
  date: string;
  status: string;
  subtotal: number;
  discount_amount: number;
  total: number;
  paid_amount: number;
  cogs_total: number;
  profit: number;
  note: string | null;
  party_id: string;
  party_name: string | null;
  party_phone: string | null;
  party_address: string | null;
}

export default function SaleDetail() {
  const { id } = useParams<{ id: string }>();
  const db = useDb();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const { data: sales, isLoading } = useQuery<SaleRow>({
    queryKey: ['sale', id],
    query: `SELECT s.*, p.name AS party_name, p.phone AS party_phone, p.address AS party_address
            FROM sales s LEFT JOIN parties p ON p.id = s.party_id WHERE s.id = ?`,
    parameters: [id],
  });
  const sale = sales?.[0];

  const { data: items } = useQuery<{ id: string; name: string; qty: number; unit_price: number; unit_cost: number; line_total: number }>({
    queryKey: ['sale-items', id],
    query: `SELECT id, name, qty, unit_price, unit_cost, line_total FROM sale_items WHERE sale_id = ?`,
    parameters: [id],
  });

  const { data: payments } = useQuery<{ id: string; date: string; amount: number; method: string | null; account_name: string | null }>({
    queryKey: ['sale-payments', id],
    query: `SELECT pm.id, pm.date, pa.amount, pm.method, a.name AS account_name
            FROM payment_allocations pa
            JOIN payments pm ON pm.id = pa.payment_id
            LEFT JOIN accounts a ON a.id = pm.account_id
            WHERE pa.sale_id = ?
            ORDER BY pm.date, pm.created_at`,
    parameters: [id],
  });

  if (isLoading) return <PageSpinner />;
  if (!sale) return <EmptyState title="Sale not found" />;

  const due = sale.total - sale.paid_amount;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={sale.invoice_no}
        subtitle={formatISODate(sale.date)}
        back="/sales"
        actions={
          <>
            <Button variant="outline" size="icon-sm" onClick={() => navigate(`/sales/${sale.id}/edit`)} aria-label="Edit">
              <Pencil />
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => setDeleteOpen(true)} aria-label="Delete">
              <Trash2 className="text-destructive" />
            </Button>
          </>
        }
      />

      {/* Customer */}
      <Link
        to={`/parties/${sale.party_id}`}
        className="app-surface mb-3 flex items-start gap-3 p-4 transition-colors hover:bg-accent/35"
        onClick={() => haptic()}
      >
        <Avatar name={sale.party_name ?? '?'} className="size-11" />
        <div className="min-w-0 flex-1 space-y-0.5 text-sm">
          <p className="font-medium">{sale.party_name}</p>
          {sale.party_phone && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="size-3" /> {sale.party_phone}
            </p>
          )}
          {sale.party_address && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3" /> {sale.party_address}
            </p>
          )}
        </div>
        <PayStatusBadge status={sale.status} />
      </Link>

      {/* Items */}
      <ListCard className="mb-3">
        <div className="app-table-wrap">
          <table className="app-table">
            <thead>
              <tr>
                <th>Item</th>
                <th className="app-table-right">Qty</th>
                <th className="app-table-right">Price</th>
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
            <span>Subtotal</span><span className="tabular-nums">{formatPaise(sale.subtotal)}</span>
          </div>
          {sale.discount_amount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Discount</span><span className="tabular-nums">−{formatPaise(sale.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span><span className="tabular-nums">{formatPaise(sale.total)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Paid</span><span className="tabular-nums">{formatPaise(sale.paid_amount)}</span>
          </div>
          {due > 0 && (
            <div className="flex justify-between text-xs font-medium text-destructive">
              <span>Balance due</span><span className="tabular-nums">{formatPaise(due)}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between rounded-lg bg-success/10 px-2 py-1.5 text-xs font-medium text-success">
            <span>Profit (after cost {formatPaise(sale.cogs_total)})</span>
            <span className="tabular-nums">{formatPaise(sale.profit)}</span>
          </div>
        </div>
      </ListCard>

      {/* Linked payments */}
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Transactions
      </h2>
      {!payments?.length ? (
        <p className="mb-3 rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          No payments received yet — record one from the Payments module.
        </p>
      ) : (
        <ListCard className="mb-3">
          {payments.map((p) => (
            <ListRow
              key={p.id}
              to={`/payments/${p.id}`}
              avatar={
                <div className="flex size-9 items-center justify-center rounded-full bg-success/10 text-success">
                  <ArrowLeftRight className="size-4" />
                </div>
              }
              title="Payment received"
              subtitle={`${formatISODateShort(p.date)}${p.account_name ? ` · ${p.account_name}` : ''}`}
              right={<span className="text-success">+{formatPaise(p.amount)}</span>}
            />
          ))}
        </ListCard>
      )}

      {sale.note && (
        <div className="flex items-start gap-2 rounded-lg border bg-card p-3 text-sm text-muted-foreground">
          <StickyNote className="mt-0.5 size-4 shrink-0" />
          {sale.note}
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await deleteSale(db, sale.id);
          haptic('success');
          navigate('/sales');
        }}
        title={`Delete ${sale.invoice_no}?`}
        message="Stock, ledger entries and linked payments created with this sale will be reversed."
      />
    </div>
  );
}
