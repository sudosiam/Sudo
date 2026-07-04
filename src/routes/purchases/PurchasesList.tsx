import * as React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, PackageOpen } from 'lucide-react';
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
  bill_no: string;
  date: string;
  total: number;
  status: string;
  party_name: string | null;
}

const PAGE = 100;

export default function PurchasesList() {
  const [search, setSearch] = React.useState('');
  const [limit, setLimit] = React.useState(PAGE);
  const { clause, params } = useDateClause('pu.date');

  const { data: summary } = useQuery<{ n: number; total: number }>({
    queryKey: ['purchases-summary', clause, ...params],
    query: `SELECT COUNT(*) AS n, COALESCE(SUM(pu.total),0) AS total FROM purchases pu WHERE ${clause}`,
    parameters: params,
  });

  const { data: rows, isLoading } = useQuery<Row>({
    queryKey: ['purchases-list', clause, search, limit, ...params],
    query: `SELECT pu.id, pu.bill_no, pu.date, pu.total, pu.status, p.name AS party_name
            FROM purchases pu LEFT JOIN parties p ON p.id = pu.party_id
            WHERE ${clause} AND (pu.bill_no LIKE ? OR COALESCE(p.name,'') LIKE ?)
            ORDER BY pu.date DESC, pu.created_at DESC
            LIMIT ?`,
    parameters: [...params, `%${search}%`, `%${search}%`, String(limit)],
  });

  const s = summary?.[0];

  return (
    <div>
      <PageHeader
        title="Purchases"
        actions={
          <>
            {s && (
              <PageKpis>
                <PageKpi tone="muted">{s.n} bills</PageKpi>
                <PageKpi tone="destructive">{formatPaiseRounded(s.total)}</PageKpi>
              </PageKpis>
            )}
            <Link to="/purchases/new" className={buttonVariants({ size: 'sm' })}>
              <Plus className="size-4" /> New purchase
            </Link>
          </>
        }
      />

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search bill or vendor…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <ListCardSkeleton />
      ) : !rows?.length ? (
        <EmptyState
          icon={<PackageOpen />}
          title="No purchases here"
          message="Try another month with the filter above, or record your first purchase."
          action={
            <Link to="/purchases/new" className={buttonVariants({ size: 'sm' })}>
              <Plus className="size-4" /> New purchase
            </Link>
          }
        />
      ) : (
        <ListCard>
          {rows.map((r) => (
            <ListRow
              key={r.id}
              to={`/purchases/${r.id}`}
              avatarName={r.party_name ?? '?'}
              title={
                <span className="flex min-w-0 items-center gap-2">
                  {r.bill_no}
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
