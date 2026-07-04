import type { AbstractPowerSyncDatabase } from '@powersync/web';
import { uuid } from '../lib/utils';
import { mulQty } from '../lib/money';
import { ACC } from './accounts';
import { postEntry, unpostSource } from './ledger';
import { nextDocNumber, assertDocNumberAvailable } from './docnum';
import { applySaleToItem, restoreSaleToItem, assertSaleStock } from './inventory';
import { getSetting } from './settings';
import { payStatus, type SaleInput } from './types';

type Tx = Parameters<Parameters<AbstractPowerSyncDatabase['writeTransaction']>[0]>[0];

function computeTotals(input: SaleInput) {
  const subtotal = input.lines.reduce((s, l) => s + mulQty(l.qty, l.unitPrice), 0);
  const total = Math.max(0, subtotal - input.discountAmount);
  return { subtotal, total };
}

/** Refresh paid_amount + status of a sale from its payment allocations. */
export async function recalcSalePaid(tx: Tx, saleId: string) {
  const sale = await tx.getOptional<{ total: number }>(`SELECT total FROM sales WHERE id = ?`, [
    saleId,
  ]);
  if (!sale) return;
  const row = await tx.get<{ paid: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS paid FROM payment_allocations WHERE sale_id = ?`,
    [saleId],
  );
  await tx.execute(`UPDATE sales SET paid_amount = ?, status = ? WHERE id = ?`, [
    Math.min(row.paid, sale.total),
    payStatus(sale.total, row.paid),
    saleId,
  ]);
}

async function insertSaleLines(
  tx: Tx,
  saleId: string,
  input: SaleInput,
  unitCostByItem?: Map<string, number>,
) {
  await assertSaleStock(tx, input.lines);
  let cogs = 0;
  for (const line of input.lines) {
    const item = await tx.getOptional<{ avg_cost: number }>(
      `SELECT avg_cost FROM items WHERE id = ?`,
      [line.itemId],
    );
    const unitCost = unitCostByItem?.get(line.itemId) ?? item?.avg_cost ?? 0;
    const lineTotal = mulQty(line.qty, line.unitPrice);
    cogs += mulQty(line.qty, unitCost);
    await tx.execute(
      `INSERT INTO sale_items (id, sale_id, item_id, name, qty, unit_price, unit_cost, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid(), saleId, line.itemId, line.name, line.qty, line.unitPrice, unitCost, lineTotal],
    );
    await applySaleToItem(tx, line.itemId, line.qty);
  }
  return cogs;
}

async function postSaleEntry(
  tx: Tx,
  saleId: string,
  invoiceNo: string,
  input: SaleInput,
  total: number,
  cogs: number,
) {
  await postEntry(tx, {
    date: input.date,
    memo: `Sale ${invoiceNo}`,
    sourceType: 'sale',
    sourceId: saleId,
    lines: [
      { accountId: ACC.AR, amount: total, partyId: input.partyId },
      { accountId: ACC.SALES, amount: -total },
      ...(cogs > 0
        ? [
            { accountId: ACC.COGS, amount: cogs },
            { accountId: ACC.INVENTORY, amount: -cogs },
          ]
        : []),
    ],
  });
}

async function createReceiptPayments(tx: Tx, saleId: string, input: SaleInput) {
  for (const p of input.payments.filter((p) => p.amount > 0)) {
    const paymentId = uuid();
    const now = new Date().toISOString();
    await tx.execute(
      `INSERT INTO payments (id, direction, party_id, date, amount, account_id, method, note, created_at)
       VALUES (?, 'in', ?, ?, ?, ?, ?, ?, ?)`,
      [paymentId, input.partyId, input.date, p.amount, p.accountId, p.method, null, now],
    );
    await tx.execute(
      `INSERT INTO payment_allocations (id, payment_id, sale_id, purchase_id, amount)
       VALUES (?, ?, ?, NULL, ?)`,
      [uuid(), paymentId, saleId, p.amount],
    );
    await postEntry(tx, {
      date: input.date,
      memo: `Payment received`,
      sourceType: 'payment',
      sourceId: paymentId,
      lines: [
        { accountId: p.accountId, amount: p.amount },
        { accountId: ACC.AR, amount: -p.amount, partyId: input.partyId },
      ],
    });
  }
}

export async function createSale(db: AbstractPowerSyncDatabase, input: SaleInput): Promise<string> {
  const prefix = await getSetting(db, 'invoice_prefix');
  const saleId = uuid();
  await db.writeTransaction(async (tx) => {
    const { subtotal, total } = computeTotals(input);
    const { seq, docNo: autoNo } = await nextDocNumber(tx, 'sales', prefix || 'INV');
    const docNo = input.docNo?.trim() || autoNo;
    if (input.docNo?.trim()) await assertDocNumberAvailable(tx, 'sales', docNo);
    const now = new Date().toISOString();
    await tx.execute(
      `INSERT INTO sales (id, invoice_no, seq, party_id, date, status, subtotal, discount_amount,
                          discount_pct, total, paid_amount, cogs_total, profit, note, created_at)
       VALUES (?, ?, ?, ?, ?, 'credit', ?, ?, ?, ?, 0, 0, 0, ?, ?)`,
      [
        saleId,
        docNo,
        seq,
        input.partyId,
        input.date,
        subtotal,
        input.discountAmount,
        input.discountPct,
        total,
        input.note || null,
        now,
      ],
    );
    const cogs = await insertSaleLines(tx, saleId, input);
    await tx.execute(`UPDATE sales SET cogs_total = ?, profit = ? WHERE id = ?`, [
      cogs,
      total - cogs,
      saleId,
    ]);
    await postSaleEntry(tx, saleId, docNo, input, total, cogs);
    await createReceiptPayments(tx, saleId, input);
    await recalcSalePaid(tx, saleId);
  });
  return saleId;
}

async function syncSalePaymentParties(tx: Tx, saleId: string, partyId: string) {
  const paymentIds = await tx.getAll<{ payment_id: string }>(
    `SELECT DISTINCT payment_id FROM payment_allocations WHERE sale_id = ?`,
    [saleId],
  );
  for (const { payment_id } of paymentIds) {
    await tx.execute(`UPDATE payments SET party_id = ? WHERE id = ?`, [partyId, payment_id]);
    await tx.execute(
      `UPDATE journal_lines SET party_id = ?
       WHERE entry_id IN (SELECT id FROM journal_entries WHERE source_type = 'payment' AND source_id = ?)
         AND account_id = ?`,
      [partyId, payment_id, ACC.AR],
    );
  }
}

export async function updateSale(
  db: AbstractPowerSyncDatabase,
  saleId: string,
  input: SaleInput,
): Promise<void> {
  await db.writeTransaction(async (tx) => {
    const sale = await tx.get<{ invoice_no: string }>(
      `SELECT invoice_no FROM sales WHERE id = ?`,
      [saleId],
    );
    const oldLines = await tx.getAll<{ item_id: string; qty: number; unit_cost: number }>(
      `SELECT item_id, qty, unit_cost FROM sale_items WHERE sale_id = ?`,
      [saleId],
    );
    const oldCostByItem = new Map<string, number>();
    for (const l of oldLines) {
      if (l.item_id) oldCostByItem.set(l.item_id, l.unit_cost);
    }
    const oldByItem = new Map<string, number>();
    for (const l of oldLines) {
      if (l.item_id) oldByItem.set(l.item_id, (oldByItem.get(l.item_id) ?? 0) + l.qty);
    }

    await assertSaleStock(tx, input.lines, oldByItem);
    await unpostSource(tx, 'sale', saleId);
    await tx.execute(`DELETE FROM sale_items WHERE sale_id = ?`, [saleId]);

    const { subtotal, total } = computeTotals(input);
    await tx.execute(
      `UPDATE sales SET party_id = ?, date = ?, subtotal = ?, discount_amount = ?, discount_pct = ?,
                        total = ?, note = ? WHERE id = ?`,
      [input.partyId, input.date, subtotal, input.discountAmount, input.discountPct, total, input.note || null, saleId],
    );

    // Insert new lines without the incremental qty updates (replay fixes them below)
    let cogs = 0;
    for (const line of input.lines) {
      const item = await tx.getOptional<{ avg_cost: number }>(
        `SELECT avg_cost FROM items WHERE id = ?`,
        [line.itemId],
      );
      const unitCost = oldCostByItem.get(line.itemId) ?? item?.avg_cost ?? 0;
      cogs += mulQty(line.qty, unitCost);
      await tx.execute(
        `INSERT INTO sale_items (id, sale_id, item_id, name, qty, unit_price, unit_cost, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuid(), saleId, line.itemId, line.name, line.qty, line.unitPrice, unitCost, mulQty(line.qty, line.unitPrice)],
      );
    }
    await tx.execute(`UPDATE sales SET cogs_total = ?, profit = ? WHERE id = ?`, [
      cogs,
      total - cogs,
      saleId,
    ]);
    await postSaleEntry(tx, saleId, sale.invoice_no, input, total, cogs);
    await syncSalePaymentParties(tx, saleId, input.partyId);
    await recalcSalePaid(tx, saleId);

    for (const itemId of new Set([...oldByItem.keys(), ...input.lines.map((l) => l.itemId)])) {
      const delta =
        input.lines.filter((l) => l.itemId === itemId).reduce((s, l) => s + l.qty, 0) -
        (oldByItem.get(itemId) ?? 0);
      if (delta > 0) await applySaleToItem(tx, itemId, delta);
      else if (delta < 0) await restoreSaleToItem(tx, itemId, -delta);
    }
  });
}

export async function deleteSale(db: AbstractPowerSyncDatabase, saleId: string): Promise<void> {
  await db.writeTransaction(async (tx) => {
    const saleLines = await tx.getAll<{ item_id: string; qty: number }>(
      `SELECT item_id, qty FROM sale_items WHERE sale_id = ?`,
      [saleId],
    );
    await unpostSource(tx, 'sale', saleId);

    const paymentIds = await tx.getAll<{ payment_id: string }>(
      `SELECT DISTINCT payment_id FROM payment_allocations WHERE sale_id = ?`,
      [saleId],
    );
    await tx.execute(`DELETE FROM payment_allocations WHERE sale_id = ?`, [saleId]);
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

    for (const { item_id, qty } of saleLines) {
      if (item_id) await restoreSaleToItem(tx, item_id, qty);
    }
    await tx.execute(`DELETE FROM sale_items WHERE sale_id = ?`, [saleId]);
    await tx.execute(`DELETE FROM sales WHERE id = ?`, [saleId]);
  });
}
