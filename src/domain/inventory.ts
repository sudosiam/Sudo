import type { AbstractPowerSyncDatabase } from '@powersync/web';
import { uuid } from '../lib/utils';
import { ACC } from './accounts';

type Tx = Parameters<Parameters<AbstractPowerSyncDatabase['writeTransaction']>[0]>[0];

interface InventoryEvent {
  kind: 'purchase' | 'sale';
  date: string;
  created_at: string;
  qty: number;
  unit_price: number;
}

async function loadInventoryEvents(tx: Tx, itemId: string): Promise<InventoryEvent[]> {
  const purchases = await tx.getAll<InventoryEvent>(
    `SELECT 'purchase' AS kind, p.date AS date, p.created_at AS created_at,
            pi.qty AS qty, pi.unit_price AS unit_price
     FROM purchase_items pi JOIN purchases p ON p.id = pi.purchase_id
     WHERE pi.item_id = ?`,
    [itemId],
  );
  const sales = await tx.getAll<InventoryEvent>(
    `SELECT 'sale' AS kind, s.date AS date, s.created_at AS created_at,
            si.qty AS qty, 0 AS unit_price
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE si.item_id = ?`,
    [itemId],
  );

  return [...purchases, ...sales].sort(
    (a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at),
  );
}

/** Qty after replaying purchases/sales only (no opening stock). */
async function replayTransactionQty(tx: Tx, itemId: string): Promise<number> {
  let qty = 0;
  for (const e of await loadInventoryEvents(tx, itemId)) {
    qty += e.kind === 'purchase' ? e.qty : -e.qty;
  }
  return qty;
}

/**
 * Recompute an item's on-hand qty and weighted-average cost by replaying
 * opening stock, then purchase and sale events in chronological order.
 *
 * Used after purchase edits/deletes where WAC must be rebuilt.
 * Sale edits/deletes use incremental restore/apply instead.
 */
export async function recomputeItemState(tx: Tx, itemId: string): Promise<void> {
  const item = await tx.getOptional<{ opening_qty: number; opening_unit_cost: number }>(
    `SELECT opening_qty, opening_unit_cost FROM items WHERE id = ?`,
    [itemId],
  );
  let qty = item?.opening_qty ?? 0;
  let avgCost = item?.opening_unit_cost ?? 0;

  for (const e of await loadInventoryEvents(tx, itemId)) {
    if (e.kind === 'purchase') {
      const newQty = qty + e.qty;
      if (newQty > 0) {
        avgCost = Math.round((qty * avgCost + e.qty * e.unit_price) / newQty);
      } else {
        avgCost = e.unit_price;
      }
      qty = newQty;
    } else {
      qty -= e.qty; // sales never change WAC
    }
  }

  await tx.execute(`UPDATE items SET qty = ?, avg_cost = ? WHERE id = ?`, [qty, avgCost, itemId]);
}

/** Incremental WAC update when new stock arrives (fast path for new purchases). */
export async function applyPurchaseToItem(
  tx: Tx,
  itemId: string,
  qty: number,
  unitPrice: number,
): Promise<void> {
  const item = await tx.getOptional<{ qty: number; avg_cost: number }>(
    `SELECT qty, avg_cost FROM items WHERE id = ?`,
    [itemId],
  );
  if (!item) return;
  const oldQty = item.qty ?? 0;
  const newQty = oldQty + qty;
  const newAvg =
    newQty > 0 ? Math.round((oldQty * (item.avg_cost ?? 0) + qty * unitPrice) / newQty) : unitPrice;
  await tx.execute(`UPDATE items SET qty = ?, avg_cost = ? WHERE id = ?`, [newQty, newAvg, itemId]);
}

/** Reduce stock on a sale (WAC unchanged). */
export async function applySaleToItem(tx: Tx, itemId: string, qty: number): Promise<void> {
  await tx.execute(`UPDATE items SET qty = qty - ? WHERE id = ?`, [qty, itemId]);
}

/** Restore stock when a sale line is removed (WAC unchanged). */
export async function restoreSaleToItem(tx: Tx, itemId: string, qty: number): Promise<void> {
  await tx.execute(`UPDATE items SET qty = qty + ? WHERE id = ?`, [qty, itemId]);
}

/** One-time backfill of opening_qty/opening_unit_cost for items created before v0.2.2. */
export async function backfillItemOpeningBaselines(db: AbstractPowerSyncDatabase) {
  const flagged = await db.getOptional<{ value: string }>(
    `SELECT value FROM app_settings WHERE key = 'opening_baseline_backfill_v1' LIMIT 1`,
  );
  if (flagged?.value === '1') return;

  const items = await db.getAll<{ id: string }>(`SELECT id FROM items`);
  await db.writeTransaction(async (tx) => {
    for (const { id } of items) {
      const row = await tx.getOptional<{ opening_qty: number; qty: number }>(
        `SELECT opening_qty, qty FROM items WHERE id = ?`,
        [id],
      );
      if (!row || (row.opening_qty ?? 0) > 0) continue;

      const opening = await tx.getOptional<{ amount: number }>(
        `SELECT jl.amount AS amount
         FROM journal_entries je
         JOIN journal_lines jl ON jl.entry_id = je.id
         WHERE je.source_type = 'opening' AND je.source_id = ?
           AND jl.account_id = ? AND jl.amount > 0
         LIMIT 1`,
        [id, ACC.INVENTORY],
      );

      if (!opening) {
        await tx.execute(`UPDATE items SET opening_qty = 0, opening_unit_cost = 0 WHERE id = ?`, [id]);
        continue;
      }

      const txQty = await replayTransactionQty(tx, id);
      const openingQty = Math.max(0, (row.qty ?? 0) - txQty);
      const openingCost = openingQty > 0 ? Math.round(opening.amount / openingQty) : 0;
      await tx.execute(
        `UPDATE items SET opening_qty = ?, opening_unit_cost = ? WHERE id = ?`,
        [openingQty, openingCost, id],
      );
    }

    await tx.execute(
      `INSERT OR REPLACE INTO app_settings (id, key, value) VALUES (?, ?, ?)`,
      [uuid(), 'opening_baseline_backfill_v1', '1'],
    );
  });
}
