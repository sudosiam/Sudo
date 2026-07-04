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
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useQuery, useDateClause } from '../hooks/useQuery';
import { ListRow, ListCard } from '../components/ListRow';
import { PageHeader } from '../components/layout/PageHeader';
import { buttonVariants } from '../components/ui/button';
import { PayStatusBadge } from '../components/ui/badge';
import { EmptyState, KpiCardSkeleton, ListCardSkeleton } from '../components/ui/misc';
import { formatPaise, formatPaiseRounded } from '../lib/money';
import { formatISODateShort, formatMonthKey, lastNMonths } from '../lib/dates';
import { useMonthFilter } from '../stores/ui';
import { ACC } from '../domain/accounts';
import { periodPlQuery, periodPlParams, netProfitFromPl } from '../domain/pl';
import { cn } from '../lib/utils';

const tooltipStyle = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--popover-foreground)',
};

const axisProps = {
  tick: { fontSize: 10 },
  stroke: 'var(--muted-foreground)',
  tickLine: false,
  axisLine: false,
} as const;

const axisRupees = (v: number) => {
  const n = v / 100;
  return Math.abs(n) >= 100000
    ? `${(n / 100000).toFixed(1)}L`
    : Math.abs(n) >= 1000
      ? `${Math.round(n / 1000)}k`
      : String(Math.round(n));
};

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
    <div className="app-surface flex h-full flex-col justify-between p-3.5 transition-[background-color] duration-150 ease-out hover:bg-accent/30">
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

interface MonthTrend {
  m: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export default function Dashboard() {
  const { clause, params } = useDateClause('date');
  const mode = useMonthFilter((s) => s.mode);
  const month = useMonthFilter((s) => s.month);
  const trendMonths = React.useMemo(() => lastNMonths(6), []);

  const { data: kpi, isLoading: kpiLoading } = useQuery<{
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

  const { data: position, isLoading: posLoading } = useQuery<{
    receivable: number;
    payable: number;
    liquid: number;
  }>({
    queryKey: ['kpi-position'],
    query: `SELECT
      (SELECT COALESCE(SUM(amount),0) FROM journal_lines WHERE account_id = '${ACC.AR}') AS receivable,
      (SELECT -COALESCE(SUM(amount),0) FROM journal_lines WHERE account_id = '${ACC.AP}') AS payable,
      (SELECT COALESCE(SUM(jl.amount),0) FROM journal_lines jl
        JOIN accounts a ON a.id = jl.account_id
        WHERE a.subtype IN ('cash','bank') AND COALESCE(a.include_in_liquid, 1) = 1) AS liquid`,
  });

  const { data: trendRows, isLoading: trendLoading } = useQuery<MonthTrend>({
    queryKey: ['dashboard-trend'],
    query: `
      SELECT m,
             SUM(revenue) AS revenue,
             SUM(expenses) AS expenses,
             SUM(revenue) - SUM(cogs) + SUM(other_income) - SUM(expenses) AS profit
      FROM (
        SELECT substr(date,1,7) AS m, SUM(total) AS revenue, SUM(cogs_total) AS cogs, 0 AS expenses, 0 AS other_income
        FROM sales GROUP BY m
        UNION ALL
        SELECT substr(date,1,7), 0, 0, SUM(amount), 0 FROM expenses GROUP BY substr(date,1,7)
        UNION ALL
        SELECT substr(date,1,7), 0, 0, 0, SUM(amount) FROM other_incomes GROUP BY substr(date,1,7)
      )
      GROUP BY m ORDER BY m`,
  });

  const { data: recentSales, isLoading: salesLoading } = useQuery<{
    id: string;
    invoice_no: string;
    date: string;
    total: number;
    status: string;
    party_name: string | null;
  }>({
    queryKey: ['recent-sales'],
    query: `SELECT s.id, s.invoice_no, s.date, s.total, s.status, p.name AS party_name
            FROM sales s LEFT JOIN parties p ON p.id = s.party_id
            ORDER BY s.date DESC, s.created_at DESC LIMIT 5`,
  });
  const { data: recentPurchases, isLoading: purchasesLoading } = useQuery<{
    id: string;
    bill_no: string;
    date: string;
    total: number;
    status: string;
    party_name: string | null;
  }>({
    queryKey: ['recent-purchases'],
    query: `SELECT pu.id, pu.bill_no, pu.date, pu.total, pu.status, p.name AS party_name
            FROM purchases pu LEFT JOIN parties p ON p.id = pu.party_id
            ORDER BY pu.date DESC, pu.created_at DESC LIMIT 5`,
  });
  const { data: recentExpenses, isLoading: expensesLoading } = useQuery<{
    id: string;
    date: string;
    amount: number;
    note: string | null;
    category_name: string | null;
  }>({
    queryKey: ['recent-expenses'],
    query: `SELECT e.id, e.date, e.amount, e.note, a.name AS category_name
            FROM expenses e LEFT JOIN accounts a ON a.id = e.category_id
            ORDER BY e.date DESC, e.created_at DESC LIMIT 5`,
  });

  const k = kpi?.[0];
  const p = position?.[0];
  const netProfit = k ? netProfitFromPl(k) : 0;
  const periodLabel = mode === 'all' ? 'All time' : formatMonthKey(month);
  const kpisLoading = kpiLoading || posLoading;

  const chartData = React.useMemo(() => {
    const byMonth = new Map((trendRows ?? []).map((r) => [r.m, r]));
    return trendMonths.map((m) => {
      const r = byMonth.get(m);
      return {
        name: formatMonthKey(m).replace(' 20', " '"),
        revenue: r?.revenue ?? 0,
        expenses: r?.expenses ?? 0,
        profit: r?.profit ?? 0,
      };
    });
  }, [trendRows, trendMonths]);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle={periodLabel} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {kpisLoading
          ? Array.from({ length: 8 }).map((_, i) => <KpiCardSkeleton key={i} />)
          : (
            <>
              <Kpi label="Net Profit" value={netProfit} icon={<TrendingUp />} tone={netProfit >= 0 ? 'success' : 'destructive'} to="/reports/profit-loss" />
              <Kpi label="Revenue" value={k?.revenue ?? 0} icon={<ShoppingCart />} to="/sales" />
              <Kpi label="Cost of Goods" value={k?.cogs ?? 0} icon={<PackageOpen />} to="/purchases" />
              <Kpi label="Expenses" value={k?.expenses ?? 0} icon={<TrendingDown />} to="/expenses" />
              <Kpi label="Receivable" value={p?.receivable ?? 0} icon={<Scale />} tone="success" to="/dues" />
              <Kpi label="Payable" value={p?.payable ?? 0} icon={<Scale />} tone="destructive" to="/dues" />
              <Kpi label="Total Liquid" value={p?.liquid ?? 0} icon={<Wallet />} tone="primary" to="/banking" />
              <Kpi label="Other Income" value={k?.other_income ?? 0} icon={<Plus />} to="/income" />
            </>
          )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="app-surface p-4">
          <h2 className="text-sm font-semibold">Revenue vs expenses</h2>
          <p className="mb-3 text-[11px] text-muted-foreground">Last 6 months</p>
          <div className="h-52">
            {trendLoading ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Loading chart…</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" {...axisProps} interval="preserveStartEnd" />
                  <YAxis {...axisProps} width={48} tickFormatter={axisRupees} />
                  <Tooltip formatter={(v) => formatPaise(Number(v ?? 0))} contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="revenue" name="Revenue" fill="var(--success)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="app-surface p-4">
          <h2 className="text-sm font-semibold">Net profit trend</h2>
          <p className="mb-3 text-[11px] text-muted-foreground">Last 6 months</p>
          <div className="h-52">
            {trendLoading ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Loading chart…</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                  <defs>
                    <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" {...axisProps} interval="preserveStartEnd" />
                  <YAxis {...axisProps} width={48} tickFormatter={axisRupees} />
                  <Tooltip formatter={(v) => formatPaise(Number(v ?? 0))} contentStyle={tooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    name="Net profit"
                    stroke="var(--primary)"
                    fill="url(#profitFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
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

      <div className="grid gap-4 lg:grid-cols-3">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="page-section-title mb-0">Recent sales</h2>
            <Link to="/sales" className="text-xs font-medium text-primary hover:underline">View all</Link>
          </div>
          {salesLoading ? (
            <ListCardSkeleton rows={3} />
          ) : !recentSales?.length ? (
            <EmptyState
              title="No sales yet"
              message="Record your first sale to see it here."
              action={
                <Link to="/sales/new" className={buttonVariants({ size: 'sm' })}>
                  <Plus className="size-4" /> New sale
                </Link>
              }
            />
          ) : (
            <ListCard>
              {recentSales.map((s) => (
                <ListRow
                  key={s.id}
                  to={`/sales/${s.id}`}
                  avatarName={s.party_name ?? '?'}
                  title={s.invoice_no}
                  subtitle={`${formatISODateShort(s.date)} · ${s.party_name ?? ''}`}
                  right={formatPaise(s.total)}
                  rightSub={<PayStatusBadge status={s.status} />}
                />
              ))}
            </ListCard>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="page-section-title mb-0">Recent purchases</h2>
            <Link to="/purchases" className="text-xs font-medium text-primary hover:underline">View all</Link>
          </div>
          {purchasesLoading ? (
            <ListCardSkeleton rows={3} />
          ) : !recentPurchases?.length ? (
            <EmptyState
              title="No purchases yet"
              message="Record bills and stock purchases here."
              action={
                <Link to="/purchases/new" className={buttonVariants({ size: 'sm' })}>
                  <Plus className="size-4" /> New purchase
                </Link>
              }
            />
          ) : (
            <ListCard>
              {recentPurchases.map((pu) => (
                <ListRow
                  key={pu.id}
                  to={`/purchases/${pu.id}`}
                  avatarName={pu.party_name ?? '?'}
                  title={pu.bill_no}
                  subtitle={`${formatISODateShort(pu.date)} · ${pu.party_name ?? ''}`}
                  right={formatPaise(pu.total)}
                  rightSub={<PayStatusBadge status={pu.status} />}
                />
              ))}
            </ListCard>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="page-section-title mb-0">Recent expenses</h2>
            <Link to="/expenses" className="text-xs font-medium text-primary hover:underline">View all</Link>
          </div>
          {expensesLoading ? (
            <ListCardSkeleton rows={3} />
          ) : !recentExpenses?.length ? (
            <EmptyState
              title="No expenses yet"
              message="Track operating costs and overheads."
              action={
                <Link to="/expenses?new=1" className={buttonVariants({ size: 'sm' })}>
                  <ReceiptText className="size-4" /> New expense
                </Link>
              }
            />
          ) : (
            <ListCard>
              {recentExpenses.map((e) => (
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
              ))}
            </ListCard>
          )}
        </section>
      </div>
    </div>
  );
}
