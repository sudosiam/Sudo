import * as React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell,
  Legend,
} from 'recharts';
import { TrendingUp, Wallet, PiggyBank, ReceiptText } from 'lucide-react';
import { useQuery } from '../hooks/useQuery';
import { PageHeader } from '../components/layout/PageHeader';
import { PageKpi, PageKpis } from '../components/layout/PageKpis';
import { lastNMonths, formatMonthKey } from '../lib/dates';
import { formatPaise, formatPaiseRounded } from '../lib/money';
import { cn } from '../lib/utils';

interface MonthAgg {
  m: string;
  nw_delta: number;
  revenue: number;
  cogs: number;
  expenses: number;
  other_income: number;
}

interface MonthPoint {
  name: string;
  monthKey: string;
  netWorth: number;
  surplus: number;
  profit: number;
  expenses: number;
  revenue: number;
}

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
  return Math.abs(n) >= 100000 ? `${(n / 100000).toFixed(1)}L` : Math.abs(n) >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n));
};

const tooltipRupees = (value: unknown) => formatPaise(Number(value ?? 0));

function Kpi({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: number;
  sub?: string;
  icon: React.ReactNode;
  tone?: 'success' | 'destructive' | 'primary';
}) {
  return (
    <div className="app-surface p-3.5">
      <div className="flex items-center justify-between gap-2">
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
          'mt-2 text-lg font-bold tabular-nums',
          tone === 'success' && 'text-success',
          tone === 'destructive' && 'text-destructive',
        )}
      >
        {formatPaiseRounded(value)}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  latest,
  change,
  children,
}: {
  title: string;
  subtitle?: string;
  latest?: number;
  change?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="app-surface p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        {latest != null && (
          <div className="shrink-0 text-right">
            <p className="text-base font-bold tabular-nums">{formatPaiseRounded(latest)}</p>
            {change != null && (
              <p
                className={cn(
                  'text-[11px] font-medium tabular-nums',
                  change >= 0 ? 'text-success' : 'text-destructive',
                )}
              >
                {change >= 0 ? '+' : ''}
                {formatPaiseRounded(change)} vs prev
              </p>
            )}
          </div>
        )}
      </div>
      <div className="h-52">{children}</div>
    </div>
  );
}

function monthChange(series: MonthPoint[], key: keyof MonthPoint): number | undefined {
  if (series.length < 2) return undefined;
  const cur = series[series.length - 1][key] as number;
  const prev = series[series.length - 2][key] as number;
  return cur - prev;
}

export default function Growth() {
  const months = React.useMemo(() => lastNMonths(12), []);
  const startMonth = months[0];

  const { data: rows } = useQuery<MonthAgg>({
    queryKey: ['growth-agg'],
    query: `
      SELECT m,
             SUM(nw_delta) AS nw_delta,
             SUM(revenue) AS revenue,
             SUM(cogs) AS cogs,
             SUM(expenses) AS expenses,
             SUM(other_income) AS other_income
      FROM (
        SELECT substr(jl.date,1,7) AS m,
               SUM(CASE WHEN a.type IN ('asset','liability') THEN jl.amount ELSE 0 END) AS nw_delta,
               0 AS revenue, 0 AS cogs, 0 AS expenses, 0 AS other_income
        FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id
        GROUP BY m
        UNION ALL
        SELECT substr(date,1,7), 0, SUM(total), SUM(cogs_total), 0, 0 FROM sales GROUP BY substr(date,1,7)
        UNION ALL
        SELECT substr(date,1,7), 0, 0, 0, SUM(amount), 0 FROM expenses GROUP BY substr(date,1,7)
        UNION ALL
        SELECT substr(date,1,7), 0, 0, 0, 0, SUM(amount) FROM other_incomes GROUP BY substr(date,1,7)
      )
      GROUP BY m ORDER BY m`,
  });

  const series = React.useMemo(() => {
    const byMonth = new Map((rows ?? []).map((r) => [r.m, r]));
    let nwBase = 0;
    for (const r of rows ?? []) {
      if (r.m < startMonth) nwBase += r.nw_delta;
    }
    let nw = nwBase;
    let surplus = 0;
    return months.map((m) => {
      const r = byMonth.get(m);
      const profit = r ? r.revenue - r.cogs + r.other_income - r.expenses : 0;
      nw += r?.nw_delta ?? 0;
      surplus += profit;
      return {
        name: formatMonthKey(m).replace(' 20', " '"),
        monthKey: m,
        netWorth: nw,
        surplus,
        profit,
        expenses: r?.expenses ?? 0,
        revenue: r?.revenue ?? 0,
      };
    });
  }, [rows, months, startMonth]);

  const latest = series[series.length - 1];
  const totals = React.useMemo(
    () => ({
      revenue: series.reduce((s, r) => s + r.revenue, 0),
      expenses: series.reduce((s, r) => s + r.expenses, 0),
      profit: series.reduce((s, r) => s + r.profit, 0),
    }),
    [series],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Growth"
        actions={
          <PageKpis>
            <PageKpi tone="muted">12 months</PageKpi>
            <PageKpi tone="success">{formatPaiseRounded(totals.revenue)}</PageKpi>
            <PageKpi tone="destructive">{formatPaiseRounded(totals.expenses)} exp</PageKpi>
            <PageKpi tone="success">profit {formatPaiseRounded(totals.profit)}</PageKpi>
          </PageKpis>
        }
      />

      {/* Summary numbers */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Net worth"
          value={latest?.netWorth ?? 0}
          sub="Latest month end"
          icon={<Wallet />}
          tone="primary"
        />
        <Kpi
          label="Cumulative surplus"
          value={latest?.surplus ?? 0}
          sub="Running net profit"
          icon={<PiggyBank />}
          tone={(latest?.surplus ?? 0) >= 0 ? 'success' : 'destructive'}
        />
        <Kpi
          label="12-month revenue"
          value={totals.revenue}
          sub={`${formatPaiseRounded(latest?.profit ?? 0)} this month`}
          icon={<TrendingUp />}
          tone="success"
        />
        <Kpi
          label="12-month expenses"
          value={totals.expenses}
          sub={`${formatPaiseRounded(latest?.expenses ?? 0)} this month`}
          icon={<ReceiptText />}
          tone="destructive"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Stock / level metric → line chart */}
        <ChartCard
          title="Net worth"
          subtitle="Balance over time (assets − liabilities)"
          latest={latest?.netWorth}
          change={monthChange(series, 'netWorth')}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" {...axisProps} interval="preserveStartEnd" />
              <YAxis {...axisProps} width={48} tickFormatter={axisRupees} />
              <Tooltip formatter={tooltipRupees} contentStyle={tooltipStyle} />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Line
                type="monotone"
                dataKey="netWorth"
                name="Net worth"
                stroke="var(--primary)"
                strokeWidth={2.5}
                dot={{ r: 2, fill: 'var(--primary)' }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Running total → area chart */}
        <ChartCard
          title="Cumulative surplus"
          subtitle="Running total of net profit"
          latest={latest?.surplus}
          change={monthChange(series, 'surplus')}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="surplusFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--success)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--success)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" {...axisProps} interval="preserveStartEnd" />
              <YAxis {...axisProps} width={48} tickFormatter={axisRupees} />
              <Tooltip formatter={tooltipRupees} contentStyle={tooltipStyle} />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Area
                type="monotone"
                dataKey="surplus"
                name="Surplus"
                stroke="var(--success)"
                strokeWidth={2}
                fill="url(#surplusFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Period flow, can be ± → bar chart with conditional colour */}
        <ChartCard
          title="Monthly net profit"
          subtitle="Revenue − COGS − expenses + other income"
          latest={latest?.profit}
          change={monthChange(series, 'profit')}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" {...axisProps} interval="preserveStartEnd" />
              <YAxis {...axisProps} width={48} tickFormatter={axisRupees} />
              <Tooltip formatter={tooltipRupees} contentStyle={tooltipStyle} />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Bar dataKey="profit" name="Net profit" radius={[3, 3, 0, 0]} maxBarSize={22}>
                {series.map((row) => (
                  <Cell
                    key={row.monthKey}
                    fill={row.profit >= 0 ? 'var(--success)' : 'var(--destructive)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Two-series comparison → composed grouped bars + profit line */}
        <ChartCard
          title="Revenue vs expenses"
          subtitle="Monthly inflow vs outflow"
          latest={(latest?.revenue ?? 0) - (latest?.expenses ?? 0)}
          change={
            latest && series.length >= 2
              ? latest.revenue -
                latest.expenses -
                (series[series.length - 2].revenue - series[series.length - 2].expenses)
              : undefined
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" {...axisProps} interval="preserveStartEnd" />
              <YAxis {...axisProps} width={48} tickFormatter={axisRupees} />
              <Tooltip formatter={tooltipRupees} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="revenue" name="Revenue" barSize={14} radius={[3, 3, 0, 0]} fill="var(--success)" />
              <Bar dataKey="expenses" name="Expenses" barSize={14} radius={[3, 3, 0, 0]} fill="var(--destructive)" opacity={0.85} />
              <Line
                type="monotone"
                dataKey="profit"
                name="Net profit"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Monthly numbers table */}
      <div className="app-surface">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Monthly breakdown</h2>
          <p className="text-[11px] text-muted-foreground">All amounts in ₹</p>
        </div>
        <div className="app-table-wrap">
          <table className="app-table">
            <thead>
              <tr>
                <th>Month</th>
                <th className="app-table-right">Net worth</th>
                <th className="app-table-right">Surplus</th>
                <th className="app-table-right">Revenue</th>
                <th className="app-table-right">Expenses</th>
                <th className="app-table-right">Net profit</th>
              </tr>
            </thead>
            <tbody>
              {[...series].reverse().map((row) => (
                <tr key={row.monthKey} className="hover:bg-accent/30">
                  <td className="font-medium">{formatMonthKey(row.monthKey)}</td>
                  <td className="app-table-right">{formatPaise(row.netWorth)}</td>
                  <td className="app-table-right">{formatPaise(row.surplus)}</td>
                  <td className="app-table-right text-success">{formatPaise(row.revenue)}</td>
                  <td className="app-table-right text-destructive">{formatPaise(row.expenses)}</td>
                  <td
                    className={cn(
                      'app-table-right font-medium',
                      row.profit >= 0 ? 'text-success' : 'text-destructive',
                    )}
                  >
                    {formatPaise(row.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 font-semibold">
                <td className="px-4 py-2.5">12-month total</td>
                <td className="app-table-right">—</td>
                <td className="app-table-right">{formatPaise(latest?.surplus ?? 0)}</td>
                <td className="app-table-right">{formatPaise(totals.revenue)}</td>
                <td className="app-table-right">{formatPaise(totals.expenses)}</td>
                <td
                  className={cn(
                    'app-table-right',
                    totals.profit >= 0 ? 'text-success' : 'text-destructive',
                  )}
                >
                  {formatPaise(totals.profit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
