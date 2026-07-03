import * as React from 'react';
import { Plus, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from 'lucide-react';
import { useQuery, useDateClause } from '../../hooks/useQuery';
import { useFabDialog } from '../../hooks/useFabDialog';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageKpi, PageKpis } from '../../components/layout/PageKpis';
import { ListRow, ListCard } from '../../components/ListRow';
import { Button } from '../../components/ui/button';
import { EmptyState, PageSpinner, Segmented } from '../../components/ui/misc';
import { PaymentDialog } from '../../components/forms/PaymentDialog';
import { formatPaise, formatPaiseRounded } from '../../lib/money';
import { formatISODateShort } from '../../lib/dates';

type Filter = 'all' | 'in' | 'out';

interface Row {
  id: string;
  direction: string;
  date: string;
  amount: number;
  method: string | null;
  party_name: string | null;
  account_name: string | null;
}

export default function Payments() {
  const [filter, setFilter] = React.useState<Filter>('all');
  const { open: dialogOpen, openDialog: openPaymentDialog, closeDialog: closePaymentDialog } = useFabDialog();
  const { clause, params } = useDateClause('pm.date');

  const dirClause = filter === 'all' ? '1=1' : `pm.direction = '${filter}'`;

  const { data: summary } = useQuery<{ total_in: number; total_out: number }>({
    queryKey: ['payments-summary', clause, ...params],
    query: `SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount END),0) AS total_in,
                   COALESCE(SUM(CASE WHEN direction='out' THEN amount END),0) AS total_out
            FROM payments pm WHERE ${clause}`,
    parameters: params,
  });

  const { data: rows, isLoading } = useQuery<Row>({
    queryKey: ['payments-list', clause, filter, ...params],
    query: `SELECT pm.id, pm.direction, pm.date, pm.amount, pm.method,
                   p.name AS party_name, a.name AS account_name
            FROM payments pm
            LEFT JOIN parties p ON p.id = pm.party_id
            LEFT JOIN accounts a ON a.id = pm.account_id
            WHERE ${clause} AND ${dirClause}
            ORDER BY pm.date DESC, pm.created_at DESC
            LIMIT 300`,
    parameters: params,
  });

  const s = summary?.[0];

  return (
    <div>
      <PageHeader
        title="Payments"
        actions={
          <>
            {s && (
              <PageKpis>
                <PageKpi tone="muted">{rows?.length ?? 0} payments</PageKpi>
                <PageKpi tone="success">in {formatPaiseRounded(s.total_in)}</PageKpi>
                <PageKpi tone="destructive">out {formatPaiseRounded(s.total_out)}</PageKpi>
              </PageKpis>
            )}
            <Button size="sm" onClick={openPaymentDialog}>
              <Plus /> New payment
            </Button>
          </>
        }
      />

      <div className="mb-3">
        <Segmented
          options={[
            { value: 'all', label: 'All' },
            { value: 'in', label: 'Received' },
            { value: 'out', label: 'Paid' },
          ]}
          value={filter}
          onChange={setFilter}
          className="w-full sm:w-auto"
        />
      </div>

      {isLoading ? (
        <PageSpinner />
      ) : !rows?.length ? (
        <EmptyState
          icon={<ArrowLeftRight />}
          title="No payments here"
          message="Payments recorded with sales/purchases and standalone ones all appear here."
        />
      ) : (
        <ListCard>
          {rows.map((r) => (
            <ListRow
              key={r.id}
              to={`/payments/${r.id}`}
              avatar={
                <div
                  className={`flex size-9 items-center justify-center rounded-full ${
                    r.direction === 'in' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                  }`}
                >
                  {r.direction === 'in' ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                </div>
              }
              title={r.party_name ?? (r.direction === 'in' ? 'Payment received' : 'Payment made')}
              subtitle={`${formatISODateShort(r.date)}${r.account_name ? ` · ${r.account_name}` : ''}${r.method ? ` · ${r.method}` : ''}`}
              right={
                <span className={r.direction === 'in' ? 'text-success' : 'text-destructive'}>
                  {r.direction === 'in' ? '+' : '−'}{formatPaise(r.amount)}
                </span>
              }
            />
          ))}
        </ListCard>
      )}

      <PaymentDialog open={dialogOpen} onClose={closePaymentDialog} />
    </div>
  );
}
