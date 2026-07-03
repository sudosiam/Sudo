import * as React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useDateClause, useMonthRange } from '../../hooks/useQuery';
import { PageHeader } from '../../components/layout/PageHeader';
import { ListCard } from '../../components/ListRow';
import { EmptyState } from '../../components/ui/misc';
import { formatPaise } from '../../lib/money';
import { naturalBalance } from '../../domain/accounts';
import { periodPlQuery, periodPlParams, netProfitFromPl } from '../../domain/pl';
import { todayISO, formatMonthKey } from '../../lib/dates';
import { useMonthFilter } from '../../stores/ui';

function Table({
  head,
  children,
  footer,
}: {
  head: string[];
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <ListCard>
      <div className="app-table-wrap">
        <table className="app-table text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              {head.map((h, i) => (
                <th key={h} className={`px-3 py-2 font-medium ${i > 0 ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>
    </ListCard>
  );
}

const td = 'px-3 py-2 border-b break-words';
const tdR = `${td} text-right tabular-nums`;

/* ---------- Chart of Accounts ---------- */
function ChartOfAccounts() {
  const { data } = useQuery<{ id: string; code: string | null; name: string; type: string; bal: number }>({
    queryKey: ['rep-coa'],
    query: `SELECT a.id, a.code, a.name, a.type,
                   COALESCE((SELECT SUM(amount) FROM journal_lines WHERE account_id = a.id), 0) AS bal
            FROM accounts a WHERE a.archived = 0 ORDER BY a.code`,
  });
  const groups = ['asset', 'liability', 'equity', 'income', 'expense'];
  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const rows = (data ?? []).filter((a) => a.type === g);
        if (!rows.length) return null;
        return (
          <div key={g}>
            <h2 className="page-section-title">{g}s</h2>
            <Table head={['Code · Account', 'Balance']}>
              {rows.map((a) => (
                <tr key={a.id} className="last:[&>td]:border-b-0">
                  <td className={td}>
                    <span className="text-xs text-muted-foreground">{a.code}</span> {a.name}
                  </td>
                  <td className={tdR}>{formatPaise(naturalBalance(a.type, a.bal))}</td>
                </tr>
              ))}
            </Table>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Trial Balance ---------- */
function TrialBalance() {
  const range = useMonthRange();
  const asOf = range?.end ?? todayISO();
  const { data } = useQuery<{ id: string; code: string | null; name: string; bal: number }>({
    queryKey: ['rep-tb', asOf],
    query: `SELECT a.id, a.code, a.name,
                   COALESCE((SELECT SUM(amount) FROM journal_lines WHERE account_id = a.id AND date <= ?), 0) AS bal
            FROM accounts a WHERE a.archived = 0 ORDER BY a.code`,
    parameters: [asOf],
  });
  const rows = (data ?? []).filter((r) => r.bal !== 0);
  const totalDr = rows.reduce((s, r) => s + Math.max(0, r.bal), 0);
  const totalCr = rows.reduce((s, r) => s + Math.max(0, -r.bal), 0);
  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">As of {asOf}</p>
      <Table
        head={['Account', 'Debit', 'Credit']}
        footer={
          <tr className="bg-muted/30 text-xs font-semibold">
            <td className="px-3 py-2">Total</td>
            <td className="px-3 py-2 text-right tabular-nums">{formatPaise(totalDr)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{formatPaise(totalCr)}</td>
          </tr>
        }
      >
        {rows.map((r) => (
          <tr key={r.id}>
            <td className={td}>
              <span className="text-xs text-muted-foreground">{r.code}</span> {r.name}
            </td>
            <td className={tdR}>{r.bal > 0 ? formatPaise(r.bal) : ''}</td>
            <td className={tdR}>{r.bal < 0 ? formatPaise(-r.bal) : ''}</td>
          </tr>
        ))}
      </Table>
      {totalDr === totalCr && rows.length > 0 && (
        <p className="mt-2 text-center text-xs font-medium text-success">Books balance ✓</p>
      )}
    </div>
  );
}

/* ---------- Balance Sheet ---------- */
function BalanceSheet() {
  const range = useMonthRange();
  const asOf = range?.end ?? todayISO();
  const { data } = useQuery<{ id: string; name: string; type: string; bal: number }>({
    queryKey: ['rep-bs', asOf],
    query: `SELECT a.id, a.name, a.type,
                   COALESCE((SELECT SUM(amount) FROM journal_lines WHERE account_id = a.id AND date <= ?), 0) AS bal
            FROM accounts a WHERE a.archived = 0 ORDER BY a.code`,
    parameters: [asOf],
  });
  const rows = data ?? [];
  const assets = rows.filter((r) => r.type === 'asset' && r.bal !== 0);
  const liabilities = rows.filter((r) => r.type === 'liability' && r.bal !== 0);
  const equity = rows.filter((r) => r.type === 'equity' && r.bal !== 0);
  const retained = rows
    .filter((r) => r.type === 'income' || r.type === 'expense')
    .reduce((s, r) => s + -r.bal, 0); // income credit(-) minus expense debit(+)

  const totalAssets = assets.reduce((s, r) => s + r.bal, 0);
  const totalLiab = liabilities.reduce((s, r) => s + -r.bal, 0);
  const totalEquity = equity.reduce((s, r) => s + -r.bal, 0) + retained;

  const Section = ({ title, items, sign }: { title: string; items: typeof rows; sign: 1 | -1 }) => (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <Table head={['Account', 'Amount']}>
        {items.map((r) => (
          <tr key={r.id}>
            <td className={td}>{r.name}</td>
            <td className={tdR}>{formatPaise(sign * r.bal)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">As of {asOf}</p>
      <Section title="Assets" items={assets} sign={1} />
      <div className="app-surface-muted px-3 py-2 text-sm font-semibold">
        Total assets <span className="float-right tabular-nums">{formatPaise(totalAssets)}</span>
      </div>
      <Section title="Liabilities" items={liabilities} sign={-1} />
      <div>
        <h2 className="page-section-title">Equity</h2>
        <Table head={['Account', 'Amount']}>
          {equity.map((r) => (
            <tr key={r.id}>
              <td className={td}>{r.name}</td>
              <td className={tdR}>{formatPaise(-r.bal)}</td>
            </tr>
          ))}
          <tr>
            <td className={td}>Retained earnings (to date)</td>
            <td className={tdR}>{formatPaise(retained)}</td>
          </tr>
        </Table>
      </div>
      <div className="app-surface-muted px-3 py-2 text-sm font-semibold">
        Liabilities + Equity{' '}
        <span className="float-right tabular-nums">{formatPaise(totalLiab + totalEquity)}</span>
      </div>
      {totalAssets === totalLiab + totalEquity && (
        <p className="text-center text-xs font-medium text-success">Balanced ✓</p>
      )}
    </div>
  );
}

/* ---------- Profit & Loss ---------- */
function PlLine({
  label,
  amount,
  bold,
  tone,
  indent,
}: {
  label: string;
  amount: number;
  bold?: boolean;
  tone?: 'success' | 'destructive' | 'muted';
  indent?: boolean;
}) {
  const cls = bold ? 'font-semibold' : '';
  const amtCls =
    tone === 'success' ? 'text-success' : tone === 'destructive' ? 'text-destructive' : tone === 'muted' ? 'text-muted-foreground' : '';
  return (
    <tr className={bold ? 'bg-muted/20' : undefined}>
      <td className={`${td} ${cls} ${indent ? 'pl-6' : ''}`}>{label}</td>
      <td className={`${tdR} ${cls} ${amtCls}`}>
        {amount < 0 ? `(${formatPaise(-amount)})` : formatPaise(amount)}
      </td>
    </tr>
  );
}

function ProfitLoss() {
  const { clause, params } = useDateClause('date');
  const mode = useMonthFilter((s) => s.mode);
  const month = useMonthFilter((s) => s.month);
  const periodLabel = mode === 'all' ? 'All time' : formatMonthKey(month);

  const { data: summaryRows } = useQuery<{
    revenue: number;
    cogs: number;
    gross_profit: number;
    expenses: number;
    other_income: number;
  }>({
    queryKey: ['rep-pl', clause, ...params],
    query: periodPlQuery(clause),
    parameters: periodPlParams(params),
  });

  const { data: expenseRows } = useQuery<{ name: string; total: number }>({
    queryKey: ['rep-pl-exp', clause, ...params],
    query: `SELECT a.name AS name, SUM(e.amount) AS total
            FROM expenses e JOIN accounts a ON a.id = e.category_id
            WHERE ${clause.replaceAll('date', 'e.date')}
            GROUP BY e.category_id ORDER BY total DESC`,
    parameters: params,
  });

  const { data: incomeRows } = useQuery<{ source: string; total: number }>({
    queryKey: ['rep-pl-inc', clause, ...params],
    query: `SELECT source, SUM(amount) AS total
            FROM other_incomes
            WHERE ${clause}
            GROUP BY source ORDER BY total DESC`,
    parameters: params,
  });

  const s = summaryRows?.[0];
  const netProfit = s ? netProfitFromPl(s) : 0;

  if (!s) return null;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{periodLabel}</p>

      <div className="app-surface p-4">
        <p className="text-xs text-muted-foreground">Net profit</p>
        <p className={`mt-1 text-2xl font-bold tabular-nums ${netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
          {formatPaise(netProfit)}
        </p>
      </div>

      <Table head={['Line item', 'Amount']}>
        <PlLine label="Revenue (sales)" amount={s.revenue} />
        <PlLine label="Cost of goods sold" amount={-s.cogs} tone="muted" indent />
        <PlLine label="Gross profit" amount={s.gross_profit} bold tone={s.gross_profit >= 0 ? 'success' : 'destructive'} />
        {(incomeRows ?? []).map((r) => (
          <PlLine key={r.source} label={r.source} amount={r.total} indent />
        ))}
        {!incomeRows?.length ? (
          <PlLine label="Other income" amount={s.other_income} indent />
        ) : (
          <PlLine label="Total other income" amount={s.other_income} bold />
        )}
        {(expenseRows ?? []).map((r) => (
          <PlLine key={r.name} label={r.name} amount={-r.total} tone="muted" indent />
        ))}
        {!expenseRows?.length ? (
          <PlLine label="Operating expenses" amount={-s.expenses} tone="muted" indent />
        ) : (
          <PlLine label="Total operating expenses" amount={-s.expenses} bold tone="destructive" />
        )}
        <PlLine
          label="Net profit"
          amount={netProfit}
          bold
          tone={netProfit >= 0 ? 'success' : 'destructive'}
        />
      </Table>
    </div>
  );
}

/* ---------- Sales / Purchase reports ---------- */
function DocReport({ kind }: { kind: 'sales' | 'purchases' }) {
  const isSales = kind === 'sales';
  const { clause, params } = useDateClause('d.date');
  const { data: byParty } = useQuery<{ party_name: string | null; n: number; total: number; profit: number }>({
    queryKey: [`rep-${kind}-party`, clause, ...params],
    query: `SELECT p.name AS party_name, COUNT(*) AS n, SUM(d.total) AS total,
                   ${isSales ? 'SUM(d.profit)' : '0'} AS profit
            FROM ${kind} d LEFT JOIN parties p ON p.id = d.party_id
            WHERE ${clause}
            GROUP BY d.party_id ORDER BY total DESC`,
    parameters: params,
  });
  const { data: byMonth } = useQuery<{ m: string; n: number; total: number; profit: number }>({
    queryKey: [`rep-${kind}-month`],
    query: `SELECT substr(d.date, 1, 7) AS m, COUNT(*) AS n, SUM(d.total) AS total,
                   ${isSales ? 'SUM(d.profit)' : '0'} AS profit
            FROM ${kind} d
            GROUP BY m ORDER BY m DESC LIMIT 12`,
  });
  const grand = (byParty ?? []).reduce((s, r) => s + r.total, 0);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="page-section-title">
          {isSales ? 'Customer-wise' : 'Vendor-wise'} (selected period · total {formatPaise(grand)})
        </h2>
        {!byParty?.length ? (
          <EmptyState title="No data in this period" />
        ) : (
          <Table head={isSales ? ['Customer', 'Bills', 'Total', 'Profit'] : ['Vendor', 'Bills', 'Total']}>
            {byParty.map((r, i) => (
              <tr key={i}>
                <td className={td}>{r.party_name ?? '—'}</td>
                <td className={tdR}>{r.n}</td>
                <td className={tdR}>{formatPaise(r.total)}</td>
                {isSales && <td className={`${tdR} text-success`}>{formatPaise(r.profit)}</td>}
              </tr>
            ))}
          </Table>
        )}
      </div>
      <div>
        <h2 className="page-section-title">Month by month (last 12)</h2>
        {!byMonth?.length ? (
          <EmptyState title="No data yet" />
        ) : (
          <Table head={isSales ? ['Month', 'Bills', 'Total', 'Profit'] : ['Month', 'Bills', 'Total']}>
            {byMonth.map((r) => (
              <tr key={r.m}>
                <td className={td}>{r.m}</td>
                <td className={tdR}>{r.n}</td>
                <td className={tdR}>{formatPaise(r.total)}</td>
                {isSales && <td className={`${tdR} text-success`}>{formatPaise(r.profit)}</td>}
              </tr>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
}

/* ---------- Expense report ---------- */
function ExpenseReport() {
  const { clause, params } = useDateClause('e.date');
  const { data } = useQuery<{ name: string; n: number; total: number }>({
    queryKey: ['rep-exp', clause, ...params],
    query: `SELECT a.name AS name, COUNT(*) AS n, SUM(e.amount) AS total
            FROM expenses e JOIN accounts a ON a.id = e.category_id
            WHERE ${clause}
            GROUP BY e.category_id ORDER BY total DESC`,
    parameters: params,
  });
  const grand = (data ?? []).reduce((s, r) => s + r.total, 0);
  return !data?.length ? (
    <EmptyState title="No expenses in this period" />
  ) : (
    <Table
      head={['Category', 'Entries', 'Total', '% share']}
      footer={
        <tr className="bg-muted/30 text-xs font-semibold">
          <td className="px-3 py-2">Total</td>
          <td />
          <td className="px-3 py-2 text-right tabular-nums">{formatPaise(grand)}</td>
          <td />
        </tr>
      }
    >
      {data.map((r, i) => (
        <tr key={i}>
          <td className={td}>{r.name}</td>
          <td className={tdR}>{r.n}</td>
          <td className={tdR}>{formatPaise(r.total)}</td>
          <td className={tdR}>{grand ? `${Math.round((r.total / grand) * 100)}%` : ''}</td>
        </tr>
      ))}
    </Table>
  );
}

/* ---------- Inventory report ---------- */
function InventoryReport() {
  const { data } = useQuery<{ name: string; qty: number; avg_cost: number; selling_price: number | null }>({
    queryKey: ['rep-inv'],
    query: `SELECT name, qty, avg_cost, selling_price FROM items ORDER BY (qty * avg_cost) DESC`,
  });
  const totalValue = (data ?? []).reduce((s, r) => s + Math.round(r.qty * r.avg_cost), 0);
  return !data?.length ? (
    <EmptyState title="No items yet" />
  ) : (
    <Table
      head={['Item', 'Qty', 'Avg cost', 'Stock value', 'Margin/unit']}
      footer={
        <tr className="bg-muted/30 text-xs font-semibold">
          <td className="px-3 py-2">Total stock value</td>
          <td />
          <td />
          <td className="px-3 py-2 text-right tabular-nums">{formatPaise(totalValue)}</td>
          <td />
        </tr>
      }
    >
      {data.map((r, i) => (
        <tr key={i}>
          <td className={td}>{r.name}</td>
          <td className={tdR}>{r.qty}</td>
          <td className={tdR}>{formatPaise(r.avg_cost)}</td>
          <td className={tdR}>{formatPaise(Math.round(r.qty * r.avg_cost))}</td>
          <td className={`${tdR} ${r.selling_price != null && r.selling_price < r.avg_cost ? 'text-destructive' : 'text-success'}`}>
            {r.selling_price != null ? formatPaise(r.selling_price - r.avg_cost) : '—'}
          </td>
        </tr>
      ))}
    </Table>
  );
}

const TITLES: Record<string, string> = {
  'chart-of-accounts': 'Chart of Accounts',
  'trial-balance': 'Trial Balance',
  'balance-sheet': 'Balance Sheet',
  'profit-loss': 'Profit & Loss',
  sales: 'Sales Report',
  purchases: 'Purchase Report',
  expenses: 'Expense Report',
  inventory: 'Inventory Report',
};

export default function ReportPage() {
  const { report } = useParams<{ report: string }>();
  const title = TITLES[report ?? ''] ?? 'Report';
  return (
    <div>
      <PageHeader title={title} back="/reports" />
      {report === 'chart-of-accounts' && <ChartOfAccounts />}
      {report === 'trial-balance' && <TrialBalance />}
      {report === 'balance-sheet' && <BalanceSheet />}
      {report === 'profit-loss' && <ProfitLoss />}
      {report === 'sales' && <DocReport kind="sales" />}
      {report === 'purchases' && <DocReport kind="purchases" />}
      {report === 'expenses' && <ExpenseReport />}
      {report === 'inventory' && <InventoryReport />}
      {!TITLES[report ?? ''] && <EmptyState title="Unknown report" />}
    </div>
  );
}
