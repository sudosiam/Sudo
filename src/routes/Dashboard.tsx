import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  ReceiptText,
  TrendingUp,
  TrendingDown,
  Wallet,
  Scale,
  ShoppingCart,
  PackageOpen,
} from 'lucide-react';
import { useQuery, useDateClause } from '../hooks/useQuery';
import { ListRow, ListCard } from '../components/ListRow';
import { PageHeader } from '../components/layout/PageHeader';
import { buttonVariants } from '../components/ui/button';
import { PayStatusBadge } from '../components/ui/badge';
import { formatPaise, formatPaiseRounded } from '../lib/money';
import { formatISODateShort } from '../lib/dates';
import { useMonthFilter } from '../stores/ui';
import { formatMonthKey } from '../lib/dates';
import { ACC } from '../domain/accounts';
import { periodPlQuery, periodPlParams, netProfitFromPl } from '../domain/pl';
import { cn } from '../lib/utils';

function Kpi({
  label,
  value,
  icon,
  tone,
  to,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: 'success' | 'destructive' | 'primary';
  to?: string;
}) {
  const body = (
    <div className="app-surface flex h-full flex-col justify-between p-3.5 transition-colors hover:bg-accent/30">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <span
          className={cn(
            'text-muted-foreground [&_svg]:size-4',
            tone === 'success' && 'text-success',
            tone === 'destructive' && 'text-destructive',
            tone === 'primary' && 'text-primary',
          )}
        >
          {icon}
        </span>
      </div>
      <p
        className={cn(
          'mt-2 truncate text-lg font-bold tabular-nums',
          tone === 'success' && 'text-success',
          tone === 'destructive' && 'text-destructive',
        )}
      >
        {formatPaiseRounded(value)}
      </p>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function Dashboard() {
  const { clause, params } = useDateClause('date');
  const mode = useMonthFilter((s) => s.mode);
  const month = useMonthFilter((s) => s.month);

  // Period KPIs (single scan each, all local SQLite)
  const { data: kpi } = useQuery<{
    revenue: number;
    cogs: number;
    gross_profit: number;
    expenses: number;
    other_income: number;
  }>({
    queryKey: ['kpi-period', clause, ...params],
    query: periodPlQuery(clause),
    parameters: periodPlParams(params),
  });

  // Position KPIs (always all-time)
  const { data: position } = useQuery<{ receivable: number; payable: number; liquid: number }>({
    queryKey: ['kpi-position'],
    query: `SELECT
      (SELECT COALESCE(SUM(amount),0) FROM journal_lines WHERE account_id = '${ACC.AR}') AS receivable,
      (SELECT -COALESCE(SUM(amount),0) FROM journal_lines WHERE account_id = '${ACC.AP}') AS payable,
      (SELECT COALESCE(SUM(jl.amount),0) FROM journal_lines jl
        JOIN accounts a ON a.id = jl.account_id
        WHERE a.subtype IN ('cash','bank') AND COALESCE(a.include_in_liquid, 1) = 1) AS liquid`,
  });

  const { data: recentSales } = useQuery<{ id: string; invoice_no: string; date: string; total: number; status: string; party_name: string | null }>({
    queryKey: ['recent-sales'],
    query: `SELECT s.id, s.invoice_no, s.date, s.total, s.status, p.name AS party_name
            FROM sales s LEFT JOIN parties p ON p.id = s.party_id
            ORDER BY s.date DESC, s.created_at DESC LIMIT 5`,
  });
  const { data: recentPurchases } = useQuery<{ id: string; bill_no: string; date: string; total: number; status: string; party_name: string | null }>({
    queryKey: ['recent-purchases'],
    query: `SELECT pu.id, pu.bill_no, pu.date, pu.total, pu.status, p.name AS party_name
            FROM purchases pu LEFT JOIN parties p ON p.id = pu.party_id
            ORDER BY pu.date DESC, pu.created_at DESC LIMIT 5`,
  });
  const { data: recentExpenses } = useQuery<{ id: string; date: string; amount: number; note: string | null; category_name: string | null }>({
    queryKey: ['recent-expenses'],
    query: `SELECT e.id, e.date, e.amount, e.note, a.name AS category_name
            FROM expenses e LEFT JOIN accounts a ON a.id = e.category_id
            ORDER BY e.date DESC, e.created_at DESC LIMIT 5`,
  });

  const k = kpi?.[0];
  const p = position?.[0];
  const netProfit = k ? netProfitFromPl(k) : 0;
  const periodLabel = mode === 'all' ? 'All time' : formatMonthKey(month);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle={periodLabel} />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Kpi label="Net Profit" value={netProfit} icon={<TrendingUp />} tone={netProfit >= 0 ? 'success' : 'destructive'} to="/reports/profit-loss" />
        <Kpi label="Revenue" value={k?.revenue ?? 0} icon={<ShoppingCart />} to="/sales" />
        <Kpi label="Cost of Goods" value={k?.cogs ?? 0} icon={<PackageOpen />} to="/purchases" />
        <Kpi label="Expenses" value={k?.expenses ?? 0} icon={<TrendingDown />} to="/expenses" />
        <Kpi label="Receivable" value={p?.receivable ?? 0} icon={<Scale />} tone="success" to="/dues" />
        <Kpi label="Payable" value={p?.payable ?? 0} icon={<Scale />} tone="destructive" to="/dues" />
        <Kpi label="Total Liquid" value={p?.liquid ?? 0} icon={<Wallet />} tone="primary" to="/banking" />
        <Kpi label="Other Income" value={k?.other_income ?? 0} icon={<Plus />} to="/income" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/sales/new" className={cn(buttonVariants({ size: 'sm' }), 'w-full')}>
          <Plus className="size-4" /> New sale
        </Link>
        <Link
          to="/expenses?new=1"
          className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'w-full')}
        >
          <ReceiptText className="size-4" /> New expense
        </Link>
      </div>

      {/* Recent activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="page-section-title mb-0">Recent sales</h2>
            <Link to="/sales" className="text-xs font-medium text-primary hover:underline">View all</Link>
          </div>
          <ListCard>
            {!recentSales?.length ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">No sales yet</p>
            ) : (
              recentSales.map((s) => (
                <ListRow
                  key={s.id}
                  to={`/sales/${s.id}`}
                  avatarName={s.party_name ?? '?'}
                  title={s.invoice_no}
                  subtitle={`${formatISODateShort(s.date)} · ${s.party_name ?? ''}`}
                  right={formatPaise(s.total)}
                  rightSub={<PayStatusBadge status={s.status} />}
                />
              ))
            )}
          </ListCard>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="page-section-title mb-0">Recent purchases</h2>
            <Link to="/purchases" className="text-xs font-medium text-primary hover:underline">View all</Link>
          </div>
          <ListCard>
            {!recentPurchases?.length ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">No purchases yet</p>
            ) : (
              recentPurchases.map((pu) => (
                <ListRow
                  key={pu.id}
                  to={`/purchases/${pu.id}`}
                  avatarName={pu.party_name ?? '?'}
                  title={pu.bill_no}
                  subtitle={`${formatISODateShort(pu.date)} · ${pu.party_name ?? ''}`}
                  right={formatPaise(pu.total)}
                  rightSub={<PayStatusBadge status={pu.status} />}
                />
              ))
            )}
          </ListCard>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="page-section-title mb-0">Recent expenses</h2>
            <Link to="/expenses" className="text-xs font-medium text-primary hover:underline">View all</Link>
          </div>
          <ListCard>
            {!recentExpenses?.length ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">No expenses yet</p>
            ) : (
              recentExpenses.map((e) => (
                <ListRow
                  key={e.id}
                  to={`/expenses/${e.id}`}
                  avatar={
                    <div className="flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                      <ReceiptText className="size-4" />
                    </div>
                  }
                  title={e.category_name ?? 'Expense'}
                  subtitle={`${formatISODateShort(e.date)}${e.note ? ` · ${e.note}` : ''}`}
                  right={<span className="text-destructive">−{formatPaise(e.amount)}</span>}
                />
              ))
            )}
          </ListCard>
        </section>
      </div>
    </div>
  );
}
