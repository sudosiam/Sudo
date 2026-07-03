import type { AbstractPowerSyncDatabase } from '@powersync/web';

type Tx = Parameters<Parameters<AbstractPowerSyncDatabase['writeTransaction']>[0]>[0];

/**
 * Recompute an item's on-hand qty and weighted-average cost by replaying
 * its purchase and sale events in chronological order.
 *
 * Used after edits/deletes where an incremental WAC update would drift.
 * For normal fast-path writes (new sale / new purchase) the services apply
 * incremental updates instead — this full replay only touches one item.
 */
export async function recomputeItemState(tx: Tx, itemId: string): Promise<void> {
  interface Event {
    kind: 'purchase' | 'sale';
    date: string;
    created_at: string;
    qty: number;
    unit_price: number;
  }

  const purchases = await tx.getAll<Event>(
    `SELECT 'purchase' AS kind, p.date AS date, p.created_at AS created_at,
            pi.qty AS qty, pi.unit_price AS unit_price
     FROM purchase_items pi JOIN purchases p ON p.id = pi.purchase_id
     WHERE pi.item_id = ?`,
    [itemId],
  );
  const sales = await tx.getAll<Event>(
    `SELECT 'sale' AS kind, s.date AS date, s.created_at AS created_at,
            si.qty AS qty, 0 AS unit_price
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE si.item_id = ?`,
    [itemId],
  );

  const events = [...purchases, ...sales].sort(
    (a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at),
  );

  let qty = 0;
  let avgCost = 0;
  for (const e of events) {
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
