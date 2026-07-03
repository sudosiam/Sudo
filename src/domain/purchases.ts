import type { AbstractPowerSyncDatabase } from '@powersync/web';
import { uuid } from '../lib/utils';
import { mulQty } from '../lib/money';
import { ACC } from './accounts';
import { postEntry, unpostSource } from './ledger';
import { nextDocNumber } from './docnum';
import { applyPurchaseToItem, recomputeItemState } from './inventory';
import { getSetting } from './settings';
import { payStatus, type PurchaseInput } from './types';

type Tx = Parameters<Parameters<AbstractPowerSyncDatabase['writeTransaction']>[0]>[0];

function computeTotals(input: PurchaseInput) {
  const subtotal = input.lines.reduce((s, l) => s + mulQty(l.qty, l.unitPrice), 0);
  const total = Math.max(0, subtotal - input.discountAmount);
  return { subtotal, total };
}

export async function recalcPurchasePaid(tx: Tx, purchaseId: string) {
  const purchase = await tx.getOptional<{ total: number }>(
    `SELECT total FROM purchases WHERE id = ?`,
    [purchaseId],
  );
  if (!purchase) return;
  const row = await tx.get<{ paid: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS paid FROM payment_allocations WHERE purchase_id = ?`,
    [purchaseId],
  );
  await tx.execute(`UPDATE purchases SET paid_amount = ?, status = ? WHERE id = ?`, [
    row.paid,
    payStatus(purchase.total, row.paid),
    purchaseId,
  ]);
}

async function postPurchaseEntry(
  tx: Tx,
  purchaseId: string,
  billNo: string,
  input: PurchaseInput,
  total: number,
) {
  await postEntry(tx, {
    date: input.date,
    memo: `Purchase ${billNo}`,
    sourceType: 'purchase',
    sourceId: purchaseId,
    lines: [
      { accountId: ACC.INVENTORY, amount: total },
      { accountId: ACC.AP, amount: -total, partyId: input.partyId },
    ],
  });
}

async function createOutPayments(tx: Tx, purchaseId: string, input: PurchaseInput) {
  for (const p of input.payments.filter((p) => p.amount > 0)) {
    const paymentId = uuid();
    const now = new Date().toISOString();
    await tx.execute(
      `INSERT INTO payments (id, direction, party_id, date, amount, account_id, method, note, created_at)
       VALUES (?, 'out', ?, ?, ?, ?, ?, ?, ?)`,
      [paymentId, input.partyId, input.date, p.amount, p.accountId, p.method, null, now],
    );
    await tx.execute(
      `INSERT INTO payment_allocations (id, payment_id, sale_id, purchase_id, amount)
       VALUES (?, ?, NULL, ?, ?)`,
      [uuid(), paymentId, purchaseId, p.amount],
    );
    await postEntry(tx, {
      date: input.date,
      memo: `Payment made`,
      sourceType: 'payment',
      sourceId: paymentId,
      lines: [
        { accountId: ACC.AP, amount: p.amount, partyId: input.partyId },
        { accountId: p.accountId, amount: -p.amount },
      ],
    });
  }
}

export async function createPurchase(
  db: AbstractPowerSyncDatabase,
  input: PurchaseInput,
): Promise<string> {
  const prefix = await getSetting(db, 'purchase_prefix');
  const purchaseId = uuid();
  await db.writeTransaction(async (tx) => {
    const { subtotal, total } = computeTotals(input);
    const { seq, docNo: autoNo } = await nextDocNumber(tx, 'purchases', prefix || 'PUR');
    const docNo = input.docNo?.trim() || autoNo;
    const now = new Date().toISOString();
    await tx.execute(
      `INSERT INTO purchases (id, bill_no, seq, party_id, date, status, subtotal, discount_amount,
                              discount_pct, total, paid_amount, note, created_at)
       VALUES (?, ?, ?, ?, ?, 'credit', ?, ?, ?, ?, 0, ?, ?)`,
      [purchaseId, docNo, seq, input.partyId, input.date, subtotal, input.discountAmount, input.discountPct, total, input.note || null, now],
    );
    for (const line of input.lines) {
      await tx.execute(
        `INSERT INTO purchase_items (id, purchase_id, item_id, name, qty, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuid(), purchaseId, line.itemId, line.name, line.qty, line.unitPrice, mulQty(line.qty, line.unitPrice)],
      );
      await applyPurchaseToItem(tx, line.itemId, line.qty, line.unitPrice);
    }
    await postPurchaseEntry(tx, purchaseId, docNo, input, total);
    await createOutPayments(tx, purchaseId, input);
    await recalcPurchasePaid(tx, purchaseId);
  });
  return purchaseId;
}

export async function updatePurchase(
  db: AbstractPowerSyncDatabase,
  purchaseId: string,
  input: PurchaseInput,
): Promise<void> {
  await db.writeTransaction(async (tx) => {
    const purchase = await tx.get<{ bill_no: string }>(
      `SELECT bill_no FROM purchases WHERE id = ?`,
      [purchaseId],
    );
    const oldItems = await tx.getAll<{ item_id: string }>(
      `SELECT DISTINCT item_id FROM purchase_items WHERE purchase_id = ?`,
      [purchaseId],
    );
    await unpostSource(tx, 'purchase', purchaseId);
    await tx.execute(`DELETE FROM purchase_items WHERE purchase_id = ?`, [purchaseId]);

    const { subtotal, total } = computeTotals(input);
    await tx.execute(
      `UPDATE purchases SET party_id = ?, date = ?, subtotal = ?, discount_amount = ?, discount_pct = ?,
                            total = ?, note = ? WHERE id = ?`,
      [input.partyId, input.date, subtotal, input.discountAmount, input.discountPct, total, input.note || null, purchaseId],
    );
    for (const line of input.lines) {
      await tx.execute(
        `INSERT INTO purchase_items (id, purchase_id, item_id, name, qty, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuid(), purchaseId, line.itemId, line.name, line.qty, line.unitPrice, mulQty(line.qty, line.unitPrice)],
      );
    }
    await postPurchaseEntry(tx, purchaseId, purchase.bill_no, input, total);
    await createOutPayments(tx, purchaseId, input);
    await recalcPurchasePaid(tx, purchaseId);

    const affected = new Set<string>([
      ...oldItems.map((r) => r.item_id),
      ...input.lines.map((l) => l.itemId),
    ]);
    for (const itemId of affected) await recomputeItemState(tx, itemId);

    // Sale costs snapshotted from WAC may have drifted — leave historical
    // sale COGS as-is (period-accurate snapshot policy).
  });
}

export async function deletePurchase(
  db: AbstractPowerSyncDatabase,
  purchaseId: string,
): Promise<void> {
  await db.writeTransaction(async (tx) => {
    const affectedItems = await tx.getAll<{ item_id: string }>(
      `SELECT DISTINCT item_id FROM purchase_items WHERE purchase_id = ?`,
      [purchaseId],
    );
    await unpostSource(tx, 'purchase', purchaseId);

    const paymentIds = await tx.getAll<{ payment_id: string }>(
      `SELECT DISTINCT payment_id FROM payment_allocations WHERE purchase_id = ?`,
      [purchaseId],
    );
    await tx.execute(`DELETE FROM payment_allocations WHERE purchase_id = ?`, [purchaseId]);
    for (const { payment_id } of paymentIds) {
      const remaining = await tx.get<{ n: number }>(
        `SELECT COUNT(*) AS n FROM payment_allocations WHERE payment_id = ?`,
        [payment_id],
      );
      if (remaining.n === 0) {
        await unpostSource(tx, 'payment', payment_id);
        await tx.execute(`DELETE FROM payments WHERE id = ?`, [payment_id]);
      }
    }

    await tx.execute(`DELETE FROM purchase_items WHERE purchase_id = ?`, [purchaseId]);
    await tx.execute(`DELETE FROM purchases WHERE id = ?`, [purchaseId]);
    for (const { item_id } of affectedItems) await recomputeItemState(tx, item_id);
  });
}
