import type { AbstractPowerSyncDatabase } from '@powersync/web';
import { uuid } from '../lib/utils';
import { ACC } from './accounts';
import { postEntry, unpostSource } from './ledger';
import type { Paise } from '../lib/money';

/** Create a bank/cash-like account with an optional opening balance. */
export async function createBankAccount(
  db: AbstractPowerSyncDatabase,
  name: string,
  openingBalance: Paise,
  openingDate: string,
): Promise<string> {
  const id = uuid();
  await db.writeTransaction(async (tx) => {
    const row = await tx.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM accounts WHERE subtype = 'bank'`,
    );
    const code = String(1101 + row.n);
    await tx.execute(
      `INSERT INTO accounts (id, code, name, type, subtype, is_system, archived, include_in_liquid, created_at)
       VALUES (?, ?, ?, 'asset', 'bank', 0, 0, 1, ?)`,
      [id, code, name, new Date().toISOString()],
    );
    if (openingBalance !== 0) {
      await postEntry(tx, {
        date: openingDate,
        memo: `Opening balance: ${name}`,
        sourceType: 'opening',
        sourceId: id,
        lines: [
          { accountId: id, amount: openingBalance },
          { accountId: ACC.EQUITY, amount: -openingBalance },
        ],
      });
    }
  });
  return id;
}

export async function renameBankAccount(db: AbstractPowerSyncDatabase, id: string, name: string) {
  await db.execute(`UPDATE accounts SET name = ? WHERE id = ?`, [name, id]);
}

/** Whether a bank account balance counts toward total liquid KPIs. Cash is always included. */
export async function setBankAccountIncludeInLiquid(
  db: AbstractPowerSyncDatabase,
  id: string,
  include: boolean,
) {
  await db.execute(`UPDATE accounts SET include_in_liquid = ? WHERE id = ?`, [include ? 1 : 0, id]);
}

/**
 * Delete a bank account. Only allowed when it has no journal activity
 * besides its own opening balance; otherwise it is archived.
 * Returns 'deleted' | 'archived'.
 */
export async function deleteBankAccount(
  db: AbstractPowerSyncDatabase,
  id: string,
): Promise<'deleted' | 'archived'> {
  let result: 'deleted' | 'archived' = 'deleted';
  await db.writeTransaction(async (tx) => {
    const activity = await tx.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.entry_id
       WHERE jl.account_id = ? AND NOT (je.source_type = 'opening' AND je.source_id = ?)`,
      [id, id],
    );
    if (activity.n > 0) {
      await tx.execute(`UPDATE accounts SET archived = 1 WHERE id = ?`, [id]);
      result = 'archived';
    } else {
      await unpostSource(tx, 'opening', id);
      await tx.execute(`DELETE FROM accounts WHERE id = ?`, [id]);
    }
  });
  return result;
}

/** Transfer money between two liquid accounts. */
export async function transferBetweenAccounts(
  db: AbstractPowerSyncDatabase,
  fromId: string,
  toId: string,
  amount: Paise,
  date: string,
  note: string,
) {
  const id = uuid();
  await db.writeTransaction(async (tx) => {
    await postEntry(tx, {
      date,
      memo: note || 'Transfer between accounts',
      sourceType: 'adjustment',
      sourceId: id,
      lines: [
        { accountId: toId, amount },
        { accountId: fromId, amount: -amount },
      ],
    });
  });
}

/** Owner deposit — money into a cash/bank account (Dr account, Cr equity). */
export async function depositToAccount(
  db: AbstractPowerSyncDatabase,
  accountId: string,
  amount: Paise,
  date: string,
  note: string,
) {
  const id = uuid();
  await db.writeTransaction(async (tx) => {
    const acct = await tx.getOptional<{ name: string }>(`SELECT name FROM accounts WHERE id = ?`, [accountId]);
    await postEntry(tx, {
      date,
      memo: note || `Deposit: ${acct?.name ?? 'account'}`,
      sourceType: 'deposit',
      sourceId: id,
      lines: [
        { accountId: accountId, amount },
        { accountId: ACC.EQUITY, amount: -amount },
      ],
    });
  });
}

/** Owner withdrawal — money out of a cash/bank account (Dr equity, Cr account). */
export async function withdrawFromAccount(
  db: AbstractPowerSyncDatabase,
  accountId: string,
  amount: Paise,
  date: string,
  note: string,
) {
  const id = uuid();
  await db.writeTransaction(async (tx) => {
    const acct = await tx.getOptional<{ name: string }>(`SELECT name FROM accounts WHERE id = ?`, [accountId]);
    await postEntry(tx, {
      date,
      memo: note || `Withdrawal: ${acct?.name ?? 'account'}`,
      sourceType: 'withdrawal',
      sourceId: id,
      lines: [
        { accountId: ACC.EQUITY, amount },
        { accountId: accountId, amount: -amount },
      ],
    });
  });
}
