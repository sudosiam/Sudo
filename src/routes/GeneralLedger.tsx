import * as React from 'react';
import { Link } from 'react-router-dom';
import { BookOpenText } from 'lucide-react';
import { useQuery, useDateClause } from '../hooks/useQuery';
import { ListRow, ListCard } from '../components/ListRow';
import { PageHeader } from '../components/layout/PageHeader';
import { PageKpi, PageKpis } from '../components/layout/PageKpis';
import { AccountPicker } from '../components/forms/AccountPicker';
import { EmptyState, ListCardSkeleton } from '../components/ui/misc';
import { LoadMoreButton } from '../components/ui/load-more';
import { buttonVariants } from '../components/ui/button';
import { SignedAmount } from '../lib/amountDisplay';
import { formatPaise } from '../lib/money';
import { formatISODateShort } from '../lib/dates';
import { sourceLink, sourceLabel } from '../domain/links';

interface EntryRow {
  id: string;
  date: string;
  memo: string | null;
  amount: number;
  source_type: string | null;
  source_id: string | null;
  party_name: string | null;
  account_name?: string;
  account_code?: string | null;
}

const PAGE = 200;

export default function GeneralLedger() {
  const [accountId, setAccountId] = React.useState('all');
  const [limit, setLimit] = React.useState(PAGE);
  const { clause, params } = useDateClause('jl.date');
  const isAll = accountId === 'all';

  React.useEffect(() => setLimit(PAGE), [accountId]);

  const { data: accounts } = useQuery<{ id: string; code: string | null; name: string; type: string }>({
    queryKey: ['gl-accounts'],
    query: `SELECT id, code, name, type FROM accounts WHERE archived = 0 ORDER BY code`,
  });

  const { data: opening } = useQuery<{ bal: number }>({
    queryKey: ['gl-opening', accountId, ...params],
    query:
      !isAll && params.length > 0
        ? `SELECT COALESCE(SUM(amount),0) AS bal FROM journal_lines WHERE account_id = ? AND date < ?`
        : `SELECT 0 AS bal`,
    parameters: !isAll && params.length > 0 ? [accountId, params[0]] : [],
  });

  const { data: entries, isLoading } = useQuery<EntryRow>({
    queryKey: ['gl-entries', accountId, clause, limit, ...params],
    query: isAll
      ? `SELECT jl.id, jl.date, je.memo, jl.amount, je.source_type, je.source_id, p.name AS party_name,
                a.name AS account_name, a.code AS account_code
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.entry_id
         JOIN accounts a ON a.id = jl.account_id
         LEFT JOIN parties p ON p.id = jl.party_id
         WHERE a.archived = 0 AND ${clause}
         ORDER BY jl.date DESC, je.created_at DESC
         LIMIT ?`
      : `SELECT jl.id, jl.date, je.memo, jl.amount, je.source_type, je.source_id, p.name AS party_name
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.entry_id
         LEFT JOIN parties p ON p.id = jl.party_id
         WHERE jl.account_id = ? AND ${clause}
         ORDER BY jl.date, je.created_at
         LIMIT ?`,
    parameters: isAll ? [...params, String(limit)] : [accountId, ...params, String(limit)],
  });

  const openingBal = opening?.[0]?.bal ?? 0;
  let running = openingBal;
  const rows = (entries ?? []).map((e) => {
    running += e.amount;
    return { ...e, balance: running };
  });

  const account = accounts?.find((a) => a.id === accountId);

  return (
    <div>
      <PageHeader
        title="General Ledger"
        actions={
          <PageKpis>
            <PageKpi tone="muted">{rows.length} entries</PageKpi>
          </PageKpis>
        }
      />

      {!!accounts?.length && (
        <AccountPicker
          className="mb-3"
          value={accountId}
          onChange={setAccountId}
          accounts={accounts}
        />
      )}

      {isLoading ? (
        <ListCardSkeleton />
      ) : !rows.length ? (
        <EmptyState
          icon={<BookOpenText />}
          title={isAll ? 'No entries in this period' : 'No entries for this account in this period'}
          message="Change the month filter above, or record a sale, purchase, or expense."
          action={
            <Link to="/sales/new" className={buttonVariants({ size: 'sm' })}>
              New sale
            </Link>
          }
        />
      ) : (
        <ListCard>
          {!isAll && params.length > 0 && (
            <div className="flex items-center justify-between border-b bg-muted/20 px-3.5 py-2 text-xs">
              <span className="text-muted-foreground">Opening balance</span>
              <span className="font-semibold tabular-nums">
                {formatPaise(Math.abs(openingBal))}
                <span className="ml-1 text-[10px] text-muted-foreground">{openingBal >= 0 ? 'Dr' : 'Cr'}</span>
              </span>
            </div>
          )}

          {rows.map((r) => {
            const link = sourceLink(r.source_type, r.source_id);
            const debit = r.amount > 0;
            return (
              <ListRow
                key={r.id}
                to={link ?? undefined}
                title={r.memo || sourceLabel(r.source_type)}
                subtitle={
                  <>
                    {formatISODateShort(r.date)}
                    {r.party_name ? ` · ${r.party_name}` : ''}
                    {isAll && r.account_name ? ` · ${r.account_name}` : ''}
                  </>
                }
                right={
                  <SignedAmount
                    amount={r.amount}
                    direction={debit ? 'debit' : 'credit'}
                    showSign={false}
                  />
                }
                rightSub={
                  isAll ? (
                    <span className="text-[10px]">{debit ? 'Dr' : 'Cr'}</span>
                  ) : (
                    <>
                      {formatPaise(Math.abs(r.balance))}
                      <span className="ml-0.5 text-[10px]">{r.balance >= 0 ? 'Dr' : 'Cr'}</span>
                    </>
                  )
                }
              />
            );
          })}

          {!isAll && account && (
            <div className="flex items-center justify-between border-t bg-muted/30 px-3.5 py-2 text-xs font-semibold">
              <span className="truncate text-muted-foreground">Closing · {account.name}</span>
              <span className="shrink-0 tabular-nums">
                {formatPaise(Math.abs(running))}
                <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                  {running >= 0 ? 'Dr' : 'Cr'}
                </span>
              </span>
            </div>
          )}
        </ListCard>
      )}

      {rows.length >= limit && (
        <LoadMoreButton onClick={() => setLimit((l) => l + PAGE)} />
      )}
    </div>
  );
}
