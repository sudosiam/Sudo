import type { AbstractPowerSyncDatabase } from '@powersync/web';
import { uuid } from '../lib/utils';
import { ACC } from './accounts';
import { postEntry, unpostSource } from './ledger';
import { recalcSalePaid } from './sales';
import { recalcPurchasePaid } from './purchases';
import { formatPaise, type Paise } from '../lib/money';

type Tx = Parameters<Parameters<AbstractPowerSyncDatabase['writeTransaction']>[0]>[0];

/** Guards against over-allocating a payment beyond its own amount or a document's remaining due. */
async function assertAllocationsValid(tx: Tx, input: PaymentInput) {
  const allocations = input.allocations.filter((a) => a.amount > 0);
  const allocatedTotal = allocations.reduce((s, a) => s + a.amount, 0);
  if (allocatedTotal > input.amount) {
    throw new Error(
      `Allocated amount (${formatPaise(allocatedTotal)}) exceeds the payment amount (${formatPaise(input.amount)}).`,
    );
  }
  for (const alloc of allocations) {
    if (alloc.saleId) {
      const sale = await tx.getOptional<{ total: number; paid_amount: number; party_id: string }>(
        `SELECT total, paid_amount, party_id FROM sales WHERE id = ?`,
        [alloc.saleId],
      );
      if (!sale) throw new Error('Sale not found for allocation.');
      if (sale.party_id !== input.partyId) {
        throw new Error('Allocation targets a sale that belongs to a different party.');
      }
      const due = sale.total - sale.paid_amount;
      if (alloc.amount > due) {
        throw new Error(`Allocation of ${formatPaise(alloc.amount)} exceeds the sale's remaining due (${formatPaise(due)}).`);
      }
    }
    if (alloc.purchaseId) {
      const purchase = await tx.getOptional<{ total: number; paid_amount: number; party_id: string }>(
        `SELECT total, paid_amount, party_id FROM purchases WHERE id = ?`,
        [alloc.purchaseId],
      );
      if (!purchase) throw new Error('Purchase not found for allocation.');
      if (purchase.party_id !== input.partyId) {
        throw new Error('Allocation targets a purchase that belongs to a different party.');
      }
      const due = purchase.total - purchase.paid_amount;
      if (alloc.amount > due) {
        throw new Error(`Allocation of ${formatPaise(alloc.amount)} exceeds the bill's remaining due (${formatPaise(due)}).`);
      }
    }
  }
}

export interface AllocationInput {
  saleId?: string;
  purchaseId?: string;
  amount: Paise;
}

export interface PaymentInput {
  direction: 'in' | 'out';
  partyId: string;
  date: string;
  amount: Paise;
  accountId: string;
  method: string;
  note: string;
  allocations: AllocationInput[];
}

export async function createPayment(
  db: AbstractPowerSyncDatabase,
  input: PaymentInput,
): Promise<string> {
  const paymentId = uuid();
  await db.writeTransaction(async (tx) => {
    await assertAllocationsValid(tx, input);
    const now = new Date().toISOString();
    await tx.execute(
      `INSERT INTO payments (id, direction, party_id, date, amount, account_id, method, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [paymentId, input.direction, input.partyId, input.date, input.amount, input.accountId, input.method, input.note || null, now],
    );
    for (const alloc of input.allocations.filter((a) => a.amount > 0)) {
      await tx.execute(
        `INSERT INTO payment_allocations (id, payment_id, sale_id, purchase_id, amount)
         VALUES (?, ?, ?, ?, ?)`,
        [uuid(), paymentId, alloc.saleId ?? null, alloc.purchaseId ?? null, alloc.amount],
      );
    }
    if (input.direction === 'in') {
      await postEntry(tx, {
        date: input.date,
        memo: 'Payment received',
        sourceType: 'payment',
        sourceId: paymentId,
        lines: [
          { accountId: input.accountId, amount: input.amount },
          { accountId: ACC.AR, amount: -input.amount, partyId: input.partyId },
        ],
      });
    } else {
      await postEntry(tx, {
        date: input.date,
        memo: 'Payment made',
        sourceType: 'payment',
        sourceId: paymentId,
        lines: [
          { accountId: ACC.AP, amount: input.amount, partyId: input.partyId },
          { accountId: input.accountId, amount: -input.amount },
        ],
      });
    }
    for (const alloc of input.allocations) {
      if (alloc.saleId) await recalcSalePaid(tx, alloc.saleId);
      if (alloc.purchaseId) await recalcPurchasePaid(tx, alloc.purchaseId);
    }
  });
  return paymentId;
}

export async function deletePayment(db: AbstractPowerSyncDatabase, paymentId: string) {
  await db.writeTransaction(async (tx) => {
    const allocations = await tx.getAll<{ sale_id: string | null; purchase_id: string | null }>(
      `SELECT sale_id, purchase_id FROM payment_allocations WHERE payment_id = ?`,
      [paymentId],
    );
    await unpostSource(tx, 'payment', paymentId);
    await tx.execute(`DELETE FROM payment_allocations WHERE payment_id = ?`, [paymentId]);
    await tx.execute(`DELETE FROM payments WHERE id = ?`, [paymentId]);
    for (const a of allocations) {
      if (a.sale_id) await recalcSalePaid(tx, a.sale_id);
      if (a.purchase_id) await recalcPurchasePaid(tx, a.purchase_id);
    }
  });
}
