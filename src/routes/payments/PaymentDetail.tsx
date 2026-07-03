import * as React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { usePowerSync } from '@powersync/react';
import { Trash2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useQuery } from '../../hooks/useQuery';
import { PageHeader } from '../../components/layout/PageHeader';
import { ListCard, ListRow } from '../../components/ListRow';
import { Button } from '../../components/ui/button';
import { Avatar, EmptyState, PageSpinner } from '../../components/ui/misc';
import { ConfirmDialog } from '../../components/ui/dialog';
import { formatPaise } from '../../lib/money';
import { formatISODate } from '../../lib/dates';
import { deletePayment } from '../../domain/payments';
import { haptic } from '../../lib/haptics';

interface Row {
  id: string;
  direction: string;
  date: string;
  amount: number;
  method: string | null;
  note: string | null;
  party_id: string | null;
  party_name: string | null;
  account_name: string | null;
}

interface AllocRow {
  id: string;
  amount: number;
  sale_id: string | null;
  purchase_id: string | null;
  doc_no: string | null;
}

export default function PaymentDetail() {
  const { id } = useParams<{ id: string }>();
  const db = usePowerSync();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const { data: rows, isLoading } = useQuery<Row>({
    queryKey: ['payment', id],
    query: `SELECT pm.id, pm.direction, pm.date, pm.amount, pm.method, pm.note, pm.party_id,
                   p.name AS party_name, a.name AS account_name
            FROM payments pm
            LEFT JOIN parties p ON p.id = pm.party_id
            LEFT JOIN accounts a ON a.id = pm.account_id
            WHERE pm.id = ?`,
    parameters: [id],
  });
  const payment = rows?.[0];

  const { data: allocations } = useQuery<AllocRow>({
    queryKey: ['payment-allocs', id],
    query: `SELECT pa.id, pa.amount, pa.sale_id, pa.purchase_id,
                   COALESCE(s.invoice_no, pu.bill_no) AS doc_no
            FROM payment_allocations pa
            LEFT JOIN sales s ON s.id = pa.sale_id
            LEFT JOIN purchases pu ON pu.id = pa.purchase_id
            WHERE pa.payment_id = ?`,
    parameters: [id],
  });

  if (isLoading) return <PageSpinner />;
  if (!payment) return <EmptyState title="Payment not found" />;

  const isIn = payment.direction === 'in';

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={isIn ? 'Payment received' : 'Payment made'}
        subtitle={formatISODate(payment.date)}
        back="/payments"
        actions={
          <Button variant="outline" size="icon-sm" onClick={() => setDeleteOpen(true)} aria-label="Delete">
            <Trash2 className="text-destructive" />
          </Button>
        }
      />

      <div className="app-surface mb-3 p-5 text-center">
        <div
          className={`mx-auto mb-2 flex size-11 items-center justify-center rounded-full ${
            isIn ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
          }`}
        >
          {isIn ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
        </div>
        <p className={`text-2xl font-bold tabular-nums ${isIn ? 'text-success' : 'text-destructive'}`}>
          {isIn ? '+' : '−'}{formatPaise(payment.amount)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {payment.account_name}{payment.method ? ` · ${payment.method}` : ''}
        </p>
        {payment.note && <p className="mt-2 text-sm text-muted-foreground">{payment.note}</p>}
      </div>

      {payment.party_id && (
        <Link
          to={`/parties/${payment.party_id}`}
          className="app-surface mb-3 flex items-center gap-3 p-3 hover:bg-accent/35"
          onClick={() => haptic()}
        >
          <Avatar name={payment.party_name ?? '?'} />
          <div className="flex-1">
            <p className="text-sm font-medium">{payment.party_name}</p>
            <p className="text-xs text-muted-foreground">{isIn ? 'Customer' : 'Vendor'}</p>
          </div>
        </Link>
      )}

      <h2 className="page-section-title">Settled against</h2>
      {!allocations?.length ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          Not allocated to any invoice — treated as an on-account {isIn ? 'receipt' : 'payment'}.
        </p>
      ) : (
        <ListCard>
          {allocations.map((a) => (
            <ListRow
              key={a.id}
              to={a.sale_id ? `/sales/${a.sale_id}` : a.purchase_id ? `/purchases/${a.purchase_id}` : undefined}
              title={a.doc_no ?? 'Document'}
              subtitle={a.sale_id ? 'Sale invoice' : 'Purchase bill'}
              right={formatPaise(a.amount)}
            />
          ))}
        </ListCard>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await deletePayment(db, payment.id);
          haptic('success');
          navigate('/payments');
        }}
        title="Delete this payment?"
        message="Ledger entries will be reversed and settled invoices will go back to due."
      />
    </div>
  );
}
