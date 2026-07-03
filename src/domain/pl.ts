/** Period profit & loss — shared by Dashboard and P&L report. */

export interface PeriodPlRow {
  revenue: number;
  cogs: number;
  gross_profit: number;
  expenses: number;
  other_income: number;
}

export interface PeriodPlSummary extends PeriodPlRow {
  net_profit: number;
}

/** SQL for period P&L totals. `clause` is a WHERE fragment, e.g. `date BETWEEN ? AND ?` or `1=1`. */
export function periodPlQuery(clause: string): string {
  return `SELECT
    (SELECT COALESCE(SUM(total), 0) FROM sales WHERE ${clause}) AS revenue,
    (SELECT COALESCE(SUM(cogs_total), 0) FROM sales WHERE ${clause}) AS cogs,
    (SELECT COALESCE(SUM(profit), 0) FROM sales WHERE ${clause}) AS gross_profit,
    (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE ${clause}) AS expenses,
    (SELECT COALESCE(SUM(amount), 0) FROM other_incomes WHERE ${clause}) AS other_income`;
}

/** Repeat period params once per subquery in {@link periodPlQuery}. */
export function periodPlParams(params: string[]): string[] {
  return [...params, ...params, ...params, ...params, ...params];
}

export function netProfitFromPl(row: Pick<PeriodPlRow, 'gross_profit' | 'other_income' | 'expenses'>): number {
  return row.gross_profit + row.other_income - row.expenses;
}

export function toPlSummary(row: PeriodPlRow): PeriodPlSummary {
  return { ...row, net_profit: netProfitFromPl(row) };
}
