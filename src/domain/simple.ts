import type { AbstractPowerSyncDatabase } from '@powersync/web';
import { uuid } from '../lib/utils';
import { ACC } from './accounts';
import { postEntry, unpostSource } from './ledger';
import type { Paise } from '../lib/money';

/** Expenses, other income and fixed assets: single-entry style forms
 *  that still post proper double-entry journals under the hood. */

export interface ExpenseInput {
  categoryId: string; // an accounts row with subtype 'opex'
  date: string;
  amount: Paise;
  accountId: string; // paid from (bank/cash)
  note: string;
}

export async function createExpense(db: AbstractPowerSyncDatabase, input: ExpenseInput) {
  const id = uuid();
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO expenses (id, category_id, date, amount, account_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.categoryId, input.date, input.amount, input.accountId, input.note || null, new Date().toISOString()],
    );
    await postEntry(tx, {
      date: input.date,
      memo: 'Expense',
      sourceType: 'expense',
      sourceId: id,
      lines: [
        { accountId: input.categoryId, amount: input.amount },
        { accountId: input.accountId, amount: -input.amount },
      ],
    });
  });
  return id;
}

export async function updateExpense(
  db: AbstractPowerSyncDatabase,
  id: string,
  input: ExpenseInput,
) {
  await db.writeTransaction(async (tx) => {
    await unpostSource(tx, 'expense', id);
    await tx.execute(
      `UPDATE expenses SET category_id = ?, date = ?, amount = ?, account_id = ?, note = ? WHERE id = ?`,
      [input.categoryId, input.date, input.amount, input.accountId, input.note || null, id],
    );
    await postEntry(tx, {
      date: input.date,
      memo: 'Expense',
      sourceType: 'expense',
      sourceId: id,
      lines: [
        { accountId: input.categoryId, amount: input.amount },
        { accountId: input.accountId, amount: -input.amount },
      ],
    });
  });
}

export async function deleteExpense(db: AbstractPowerSyncDatabase, id: string) {
  await db.writeTransaction(async (tx) => {
    await unpostSource(tx, 'expense', id);
    await tx.execute(`DELETE FROM expenses WHERE id = ?`, [id]);
  });
}

export interface OtherIncomeInput {
  source: string;
  date: string;
  amount: Paise;
  accountId: string; // received into
  note: string;
}

export async function createOtherIncome(db: AbstractPowerSyncDatabase, input: OtherIncomeInput) {
  const id = uuid();
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO other_incomes (id, source, date, amount, account_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.source, input.date, input.amount, input.accountId, input.note || null, new Date().toISOString()],
    );
    await postEntry(tx, {
      date: input.date,
      memo: `Other income: ${input.source}`,
      sourceType: 'other_income',
      sourceId: id,
      lines: [
        { accountId: input.accountId, amount: input.amount },
        { accountId: ACC.OTHER_INCOME, amount: -input.amount },
      ],
    });
  });
  return id;
}

export async function updateOtherIncome(
  db: AbstractPowerSyncDatabase,
  id: string,
  input: OtherIncomeInput,
) {
  await db.writeTransaction(async (tx) => {
    await unpostSource(tx, 'other_income', id);
    await tx.execute(
      `UPDATE other_incomes SET source = ?, date = ?, amount = ?, account_id = ?, note = ? WHERE id = ?`,
      [input.source, input.date, input.amount, input.accountId, input.note || null, id],
    );
    await postEntry(tx, {
      date: input.date,
      memo: `Other income: ${input.source}`,
      sourceType: 'other_income',
      sourceId: id,
      lines: [
        { accountId: input.accountId, amount: input.amount },
        { accountId: ACC.OTHER_INCOME, amount: -input.amount },
      ],
    });
  });
}

export async function deleteOtherIncome(db: AbstractPowerSyncDatabase, id: string) {
  await db.writeTransaction(async (tx) => {
    await unpostSource(tx, 'other_income', id);
    await tx.execute(`DELETE FROM other_incomes WHERE id = ?`, [id]);
  });
}

export interface FixedAssetInput {
  name: string;
  purchaseDate: string;
  cost: Paise;
  accountId: string; // paid from
  note: string;
}

export async function createFixedAsset(db: AbstractPowerSyncDatabase, input: FixedAssetInput) {
  const id = uuid();
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO fixed_assets (id, name, purchase_date, cost, account_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.name, input.purchaseDate, input.cost, input.accountId, input.note || null, new Date().toISOString()],
    );
    await postEntry(tx, {
      date: input.purchaseDate,
      memo: `Fixed asset: ${input.name}`,
      sourceType: 'fixed_asset',
      sourceId: id,
      lines: [
        { accountId: ACC.FIXED_ASSETS, amount: input.cost },
        { accountId: input.accountId, amount: -input.cost },
      ],
    });
  });
  return id;
}

export async function updateFixedAsset(
  db: AbstractPowerSyncDatabase,
  id: string,
  input: FixedAssetInput,
) {
  await db.writeTransaction(async (tx) => {
    await unpostSource(tx, 'fixed_asset', id);
    await tx.execute(
      `UPDATE fixed_assets SET name = ?, purchase_date = ?, cost = ?, account_id = ?, note = ? WHERE id = ?`,
      [input.name, input.purchaseDate, input.cost, input.accountId, input.note || null, id],
    );
    await postEntry(tx, {
      date: input.purchaseDate,
      memo: `Fixed asset: ${input.name}`,
      sourceType: 'fixed_asset',
      sourceId: id,
      lines: [
        { accountId: ACC.FIXED_ASSETS, amount: input.cost },
        { accountId: input.accountId, amount: -input.cost },
      ],
    });
  });
}

export async function deleteFixedAsset(db: AbstractPowerSyncDatabase, id: string) {
  await db.writeTransaction(async (tx) => {
    await unpostSource(tx, 'fixed_asset', id);
    await tx.execute(`DELETE FROM fixed_assets WHERE id = ?`, [id]);
  });
}
