import * as React from 'react';
import { Link } from 'react-router-dom';
import { Scale, Plus } from 'lucide-react';
import { useQuery } from '../hooks/useQuery';
import { PageHeader } from '../components/layout/PageHeader';
import { PageKpi, PageKpis } from '../components/layout/PageKpis';
import { ListRow, ListCard } from '../components/ListRow';
import { EmptyState, ListCardSkeleton } from '../components/ui/misc';
import { LoadMoreButton } from '../components/ui/load-more';
import { buttonVariants } from '../components/ui/button';
import { PayStatusBadge } from '../components/ui/badge';
import { formatPaise, formatPaiseRounded } from '../lib/money';
import { formatISODateShort } from '../lib/dates';

type Tab = 'receivable' | 'payable';

interface Row {
  id: string;
  doc_no: string;
  date: string;
  due: number;
  status: string;
  party_name: string | null;
}

const PAGE = 100;

export default function Dues() {
  const [tab, setTab] = React.useState<Tab>('receivable');
  const [limit, setLimit] = React.useState(PAGE);

  React.useEffect(() => setLimit(PAGE), [tab]);

  const { data: totals } = useQuery<{ receivable: number; payable: number }>({
    queryKey: ['dues-totals'],
    query: `SELECT
      (SELECT COALESCE(SUM(total - paid_amount),0) FROM sales WHERE status != 'paid') AS receivable,
      (SELECT COALESCE(SUM(total - paid_amount),0) FROM purchases WHERE status != 'paid') AS payable`,
  });

  const isRecv = tab === 'receivable';
  const { data: rows, isLoading } = useQuery<Row>({
    queryKey: ['dues-list', tab, limit],
    query: isRecv
      ? `SELECT s.id, s.invoice_no AS doc_no, s.date, (s.total - s.paid_amount) AS due, s.status, p.name AS party_name
         FROM sales s LEFT JOIN parties p ON p.id = s.party_id
         WHERE s.status != 'paid' AND (s.total - s.paid_amount) > 0
         ORDER BY s.date DESC
         LIMIT ?`
      : `SELECT pu.id, pu.bill_no AS doc_no, pu.date, (pu.total - pu.paid_amount) AS due, pu.status, p.name AS party_name
         FROM purchases pu LEFT JOIN parties p ON p.id = pu.party_id
         WHERE pu.status != 'paid' AND (pu.total - pu.paid_amount) > 0
         ORDER BY pu.date DESC
         LIMIT ?`,
    parameters: [String(limit)],
  });

  const t = totals?.[0];

  return (
    <div>
      <PageHeader
        title="Payables / Receivables"
        actions={
          t ? (
            <PageKpis>
              <PageKpi tone="success">receive {formatPaiseRounded(t.receivable)}</PageKpi>
              <PageKpi tone="destructive">pay {formatPaiseRounded(t.payable)}</PageKpi>
            </PageKpis>
          ) : undefined
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-3">
        <button
          className={`app-surface p-3 text-left transition-colors ${isRecv ? 'border-success/50 bg-success/5' : 'hover:bg-accent/40'}`}
          onClick={() => setTab('receivable')}
        >
          <p className="text-xs text-muted-foreground">To receive</p>
          <p className="mt-1 text-lg font-bold text-success tabular-nums">
            {formatPaiseRounded(t?.receivable ?? 0)}
          </p>
        </button>
        <button
          className={`app-surface p-3 text-left transition-colors ${!isRecv ? 'border-destructive/50 bg-destructive/5' : 'hover:bg-accent/40'}`}
          onClick={() => setTab('payable')}
        >
          <p className="text-xs text-muted-foreground">To pay</p>
          <p className="mt-1 text-lg font-bold text-destructive tabular-nums">
            {formatPaiseRounded(t?.payable ?? 0)}
          </p>
        </button>
      </div>

      {isLoading ? (
        <ListCardSkeleton />
      ) : !rows?.length ? (
        <EmptyState
          icon={<Scale />}
          title={isRecv ? 'Nothing to receive' : 'Nothing to pay'}
          message="All settled — nice."
          action={
            isRecv ? (
              <Link to="/sales/new" className={buttonVariants({ size: 'sm' })}>
                <Plus className="size-4" /> New sale
              </Link>
            ) : (
              <Link to="/payments?new=1" className={buttonVariants({ size: 'sm' })}>
                <Plus className="size-4" /> Record payment
              </Link>
            )
          }
        />
      ) : (
        <ListCard>
          {rows.map((r) => (
            <ListRow
              key={r.id}
              to={isRecv ? `/sales/${r.id}` : `/purchases/${r.id}`}
              avatarName={r.party_name ?? '?'}
              title={
                <span className="flex min-w-0 items-center gap-2">
                  {r.party_name}
                  <span className="truncate text-xs font-normal text-muted-foreground">{r.doc_no}</span>
                </span>
              }
              subtitle={formatISODateShort(r.date)}
              right={
                <span className={isRecv ? 'text-success' : 'text-destructive'}>
                  {formatPaise(r.due)}
                </span>
              }
              rightSub={<PayStatusBadge status={r.status} />}
            />
          ))}
        </ListCard>
      )}

      {rows && rows.length >= limit && (
        <LoadMoreButton onClick={() => setLimit((l) => l + PAGE)} />
      )}
    </div>
  );
}
