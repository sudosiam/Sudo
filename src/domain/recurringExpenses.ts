import type { AbstractPowerSyncDatabase } from '@powersync/web';
import { uuid } from '../lib/utils';
import { currentMonthKey, expenseDateInMonth, type MonthKey } from '../lib/dates';
import { postEntry } from './ledger';
import type { Paise } from '../lib/money';

export interface RecurringExpenseInput {
  label: string;
  categoryId: string;
  amount: Paise;
  accountId: string;
  dayOfMonth: number;
  note?: string;
  active?: boolean;
}

export function isRecurringDue(
  lastPostedMonth: string | null | undefined,
  monthKey: MonthKey = currentMonthKey(),
  active = true,
): boolean {
  if (!active) return false;
  if (!lastPostedMonth) return true;
  return lastPostedMonth < monthKey;
}

export async function createRecurringExpense(db: AbstractPowerSyncDatabase, input: RecurringExpenseInput) {
  const id = uuid();
  const day = Math.min(28, Math.max(1, input.dayOfMonth));
  await db.execute(
    `INSERT INTO recurring_expenses
       (id, label, category_id, amount, account_id, day_of_month, active, last_posted_month, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.label.trim(),
      input.categoryId,
      input.amount,
      input.accountId,
      day,
      input.active !== false ? 1 : 0,
      null,
      input.note?.trim() || null,
      new Date().toISOString(),
    ],
  );
  return id;
}

export async function updateRecurringExpense(
  db: AbstractPowerSyncDatabase,
  id: string,
  input: RecurringExpenseInput,
) {
  const day = Math.min(28, Math.max(1, input.dayOfMonth));
  await db.execute(
    `UPDATE recurring_expenses
     SET label = ?, category_id = ?, amount = ?, account_id = ?, day_of_month = ?, active = ?, note = ?
     WHERE id = ?`,
    [
      input.label.trim(),
      input.categoryId,
      input.amount,
      input.accountId,
      day,
      input.active !== false ? 1 : 0,
      input.note?.trim() || null,
      id,
    ],
  );
}

export async function deleteRecurringExpense(db: AbstractPowerSyncDatabase, id: string) {
  await db.execute(`DELETE FROM recurring_expenses WHERE id = ?`, [id]);
}

export async function postRecurringExpense(
  db: AbstractPowerSyncDatabase,
  id: string,
  opts?: { date?: string; monthKey?: MonthKey },
) {
  const rec = await db.getOptional<{
    id: string;
    label: string;
    category_id: string;
    amount: number;
    account_id: string;
    day_of_month: number;
    active: number;
    last_posted_month: string | null;
    note: string | null;
  }>(`SELECT * FROM recurring_expenses WHERE id = ?`, [id]);

  if (!rec) throw new Error('Recurring expense not found');

  const monthKey = opts?.monthKey ?? currentMonthKey();
  if (!isRecurringDue(rec.last_posted_month, monthKey, rec.active === 1)) {
    throw new Error('Already recorded this month');
  }

  const date = opts?.date ?? expenseDateInMonth(monthKey, rec.day_of_month);
  const note = [rec.label, rec.note?.trim()].filter(Boolean).join(' — ');
  const expenseId = uuid();

  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO expenses (id, category_id, date, amount, account_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [expenseId, rec.category_id, date, rec.amount, rec.account_id, note || null, new Date().toISOString()],
    );
    await postEntry(tx, {
      date,
      memo: 'Expense',
      sourceType: 'expense',
      sourceId: expenseId,
      lines: [
        { accountId: rec.category_id, amount: rec.amount },
        { accountId: rec.account_id, amount: -rec.amount },
      ],
    });
    await tx.execute(`UPDATE recurring_expenses SET last_posted_month = ? WHERE id = ?`, [monthKey, id]);
  });

  return expenseId;
}
