import * as React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, ShoppingCart } from 'lucide-react';
import { useQuery, useDateClause } from '../../hooks/useQuery';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageKpi, PageKpis } from '../../components/layout/PageKpis';
import { ListRow, ListCard } from '../../components/ListRow';
import { buttonVariants } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { PayStatusBadge } from '../../components/ui/badge';
import { EmptyState, ListCardSkeleton } from '../../components/ui/misc';
import { LoadMoreButton } from '../../components/ui/load-more';
import { formatPaise, formatPaiseRounded } from '../../lib/money';
import { formatISODateShort } from '../../lib/dates';

interface Row {
  id: string;
  invoice_no: string;
  date: string;
  total: number;
  status: string;
  party_name: string | null;
}

const PAGE = 100;

export default function SalesList() {
  const [search, setSearch] = React.useState('');
  const [limit, setLimit] = React.useState(PAGE);
  const { clause, params } = useDateClause('s.date');

  const { data: summary } = useQuery<{ n: number; total: number; profit: number }>({
    queryKey: ['sales-summary', clause, ...params],
    query: `SELECT COUNT(*) AS n, COALESCE(SUM(s.total),0) AS total, COALESCE(SUM(s.profit),0) AS profit
            FROM sales s WHERE ${clause}`,
    parameters: params,
  });

  const { data: rows, isLoading } = useQuery<Row>({
    queryKey: ['sales-list', clause, search, limit, ...params],
    query: `SELECT s.id, s.invoice_no, s.date, s.total, s.status, p.name AS party_name
            FROM sales s LEFT JOIN parties p ON p.id = s.party_id
            WHERE ${clause} AND (s.invoice_no LIKE ? OR COALESCE(p.name,'') LIKE ?)
            ORDER BY s.date DESC, s.created_at DESC
            LIMIT ?`,
    parameters: [...params, `%${search}%`, `%${search}%`, String(limit)],
  });

  const s = summary?.[0];

  return (
    <div>
      <PageHeader
        title="Sales"
        actions={
          <>
            {s && (
              <PageKpis>
                <PageKpi tone="muted">{s.n} invoices</PageKpi>
                <PageKpi>{formatPaiseRounded(s.total)}</PageKpi>
                <PageKpi tone="success">profit {formatPaiseRounded(s.profit)}</PageKpi>
              </PageKpis>
            )}
            <Link to="/sales/new" className={buttonVariants({ size: 'sm' })}>
              <Plus className="size-4" /> New sale
            </Link>
          </>
        }
      />

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search invoice or customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <ListCardSkeleton />
      ) : !rows?.length ? (
        <EmptyState
          icon={<ShoppingCart />}
          title="No sales here"
          message="Try another month with the filter above, or record your first sale."
          action={
            <Link to="/sales/new" className={buttonVariants({ size: 'sm' })}>
              <Plus className="size-4" /> New sale
            </Link>
          }
        />
      ) : (
        <ListCard>
          {rows.map((r) => (
            <ListRow
              key={r.id}
              to={`/sales/${r.id}`}
              avatarName={r.party_name ?? '?'}
              title={
                <span className="flex min-w-0 items-center gap-2">
                  {r.invoice_no}
                  <span className="truncate text-xs font-normal text-muted-foreground">{r.party_name}</span>
                </span>
              }
              subtitle={formatISODateShort(r.date)}
              right={formatPaise(r.total)}
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
