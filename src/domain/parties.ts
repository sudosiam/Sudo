import type { AbstractPowerSyncDatabase } from '@powersync/web';
import { uuid } from '../lib/utils';
import { mulQty, type Paise } from '../lib/money';
import { todayISO } from '../lib/dates';
import { ACC } from './accounts';
import { postEntry, unpostSource } from './ledger';

export interface PartyInput {
  name: string;
  type: 'customer' | 'vendor' | 'both';
  phone: string;
  address: string;
  note: string;
}

export async function createParty(db: AbstractPowerSyncDatabase, input: PartyInput) {
  const id = uuid();
  await db.execute(
    `INSERT INTO parties (id, name, type, phone, address, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name.trim(), input.type, input.phone || null, input.address || null, input.note || null, new Date().toISOString()],
  );
  return id;
}

export async function updateParty(db: AbstractPowerSyncDatabase, id: string, input: PartyInput) {
  await db.execute(
    `UPDATE parties SET name = ?, type = ?, phone = ?, address = ?, note = ? WHERE id = ?`,
    [input.name.trim(), input.type, input.phone || null, input.address || null, input.note || null, id],
  );
}

/** A party can only be deleted when nothing references it. Returns false if blocked. */
export async function deleteParty(db: AbstractPowerSyncDatabase, id: string): Promise<boolean> {
  const refs = await db.get<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM sales WHERE party_id = ?) +
            (SELECT COUNT(*) FROM purchases WHERE party_id = ?) +
            (SELECT COUNT(*) FROM payments WHERE party_id = ?) AS n`,
    [id, id, id],
  );
  if (refs.n > 0) return false;
  await db.execute(`DELETE FROM parties WHERE id = ?`, [id]);
  return true;
}

export interface ItemInput {
  name: string;
  categoryId: string | null;
  unit: string;
  sellingPrice: number | null; // paise
  /** Opening on-hand quantity (new items, or items with no purchase/sale history). */
  openingQty?: number;
  /** Opening weighted-average unit cost in paise. */
  openingUnitCost?: Paise;
}

async function itemHasTransactions(db: AbstractPowerSyncDatabase, id: string): Promise<boolean> {
  const refs = await db.get<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM sale_items WHERE item_id = ?) +
            (SELECT COUNT(*) FROM purchase_items WHERE item_id = ?) AS n`,
    [id, id],
  );
  return refs.n > 0;
}

export async function createItem(db: AbstractPowerSyncDatabase, input: ItemInput) {
  const id = uuid();
  const openingQty = Math.max(0, input.openingQty ?? 0);
  const openingCost = Math.max(0, input.openingUnitCost ?? 0);
  const openingValue = mulQty(openingQty, openingCost);

  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO items (id, name, category_id, unit, selling_price, qty, avg_cost, opening_qty, opening_unit_cost, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.name.trim(),
        input.categoryId,
        input.unit || null,
        input.sellingPrice,
        openingQty,
        openingCost,
        openingQty,
        openingCost,
        new Date().toISOString(),
      ],
    );
    if (openingValue !== 0) {
      await postEntry(tx, {
        date: todayISO(),
        memo: `Opening stock: ${input.name.trim()}`,
        sourceType: 'opening',
        sourceId: id,
        lines: [
          { accountId: ACC.INVENTORY, amount: openingValue },
          { accountId: ACC.EQUITY, amount: -openingValue },
        ],
      });
    }
  });
  return id;
}

export async function updateItem(db: AbstractPowerSyncDatabase, id: string, input: ItemInput) {
  const canSetOpening = !(await itemHasTransactions(db, id));
  const openingQty = canSetOpening ? Math.max(0, input.openingQty ?? 0) : undefined;
  const openingCost = canSetOpening ? Math.max(0, input.openingUnitCost ?? 0) : undefined;

  await db.writeTransaction(async (tx) => {
    if (canSetOpening && openingQty !== undefined && openingCost !== undefined) {
      await tx.execute(
        `UPDATE items SET name = ?, category_id = ?, unit = ?, selling_price = ?, qty = ?, avg_cost = ?, opening_qty = ?, opening_unit_cost = ? WHERE id = ?`,
        [
          input.name.trim(),
          input.categoryId,
          input.unit || null,
          input.sellingPrice,
          openingQty,
          openingCost,
          openingQty,
          openingCost,
          id,
        ],
      );
      await unpostSource(tx, 'opening', id);
      const openingValue = mulQty(openingQty, openingCost);
      if (openingValue !== 0) {
        await postEntry(tx, {
          date: todayISO(),
          memo: `Opening stock: ${input.name.trim()}`,
          sourceType: 'opening',
          sourceId: id,
          lines: [
            { accountId: ACC.INVENTORY, amount: openingValue },
            { accountId: ACC.EQUITY, amount: -openingValue },
          ],
        });
      }
    } else {
      await tx.execute(
        `UPDATE items SET name = ?, category_id = ?, unit = ?, selling_price = ? WHERE id = ?`,
        [input.name.trim(), input.categoryId, input.unit || null, input.sellingPrice, id],
      );
    }
  });
}

export async function deleteItem(db: AbstractPowerSyncDatabase, id: string): Promise<boolean> {
  const refs = await db.get<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM sale_items WHERE item_id = ?) +
            (SELECT COUNT(*) FROM purchase_items WHERE item_id = ?) AS n`,
    [id, id],
  );
  if (refs.n > 0) return false;
  await db.writeTransaction(async (tx) => {
    await unpostSource(tx, 'opening', id);
    await tx.execute(`DELETE FROM items WHERE id = ?`, [id]);
  });
  return true;
}

export async function createItemCategory(db: AbstractPowerSyncDatabase, name: string) {
  const id = uuid();
  await db.execute(`INSERT INTO item_categories (id, name) VALUES (?, ?)`, [id, name.trim()]);
  return id;
}

/** Custom expense category = expense account with subtype 'opex'. */
export async function createExpenseCategory(db: AbstractPowerSyncDatabase, name: string) {
  const id = uuid();
  const row = await db.get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM accounts WHERE subtype = 'opex'`,
  );
  const code = String(6100 + row.n);
  await db.execute(
    `INSERT INTO accounts (id, code, name, type, subtype, is_system, archived, created_at)
     VALUES (?, ?, ?, 'expense', 'opex', 0, 0, ?)`,
    [id, code, name.trim(), new Date().toISOString()],
  );
  return id;
}
