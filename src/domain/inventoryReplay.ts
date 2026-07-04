/** Pure inventory replay — testable without a database. */

export interface InventoryReplayEvent {
  kind: 'purchase' | 'sale';
  date: string;
  created_at: string;
  qty: number;
  unit_price: number;
}

export function replayInventoryState(
  openingQty: number,
  openingUnitCost: number,
  events: InventoryReplayEvent[],
): { qty: number; avgCost: number } {
  const sorted = [...events].sort(
    (a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at),
  );

  let qty = openingQty;
  let avgCost = openingUnitCost;

  for (const e of sorted) {
    if (e.kind === 'purchase') {
      const newQty = qty + e.qty;
      if (newQty > 0) {
        avgCost = Math.round((qty * avgCost + e.qty * e.unit_price) / newQty);
      } else {
        avgCost = e.unit_price;
      }
      qty = newQty;
    } else {
      qty -= e.qty;
    }
  }

  return { qty, avgCost };
}
