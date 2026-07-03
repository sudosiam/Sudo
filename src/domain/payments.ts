import type { AbstractPowerSyncDatabase } from '@powersync/web';
import { uuid } from '../lib/utils';
import { ACC } from './accounts';
import { postEntry, unpostSource } from './ledger';
import { recalcSalePaid } from './sales';
import { recalcPurchasePaid } from './purchases';
import type { Paise } from '../lib/money';

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
