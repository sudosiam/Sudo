import type { AbstractPowerSyncDatabase } from '@powersync/web';
import { uuid } from '../lib/utils';
import { mulQty } from '../lib/money';
import { toISODate } from '../lib/dates';
import { ACC } from './accounts';
import { postEntry } from './ledger';
import { applyPurchaseToItem, applySaleToItem } from './inventory';
import { payStatus } from './types';
import { factoryReset } from './backup';
import { ensureSeeded } from './seed';

type Tx = Parameters<Parameters<AbstractPowerSyncDatabase['writeTransaction']>[0]>[0];

export type MockDataScale = 'small' | 'medium' | 'large';

export interface MockDataCounts {
  parties: number;
  items: number;
  sales: number;
  purchases: number;
  expenses: number;
  payments: number;
  monthsBack: number;
}

export const MOCK_DATA_PRESETS: Record<MockDataScale, MockDataCounts> = {
  small: { parties: 25, items: 20, sales: 150, purchases: 75, expenses: 50, payments: 60, monthsBack: 6 },
  medium: { parties: 60, items: 40, sales: 800, purchases: 400, expenses: 200, payments: 250, monthsBack: 12 },
  large: { parties: 120, items: 80, sales: 2500, purchases: 1200, expenses: 600, payments: 700, monthsBack: 18 },
};

export interface MockDataProgress {
  phase: string;
  done: number;
  total: number;
}

export interface MockDataResult extends MockDataCounts {
  elapsedMs: number;
}

const EXPENSE_CATEGORIES = [
  'acc-exp-rent',
  'acc-exp-salaries',
  'acc-exp-electricity',
  'acc-exp-transport',
  'acc-exp-misc',
];

const BATCH = 40;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomDate(monthsBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - randInt(0, monthsBack * 30));
  return toISODate(d);
}

function emitProgress(
  onProgress: ((p: MockDataProgress) => void) | undefined,
  phase: string,
  done: number,
  total: number,
) {
  onProgress?.({ phase, done, total });
}

async function insertParties(tx: Tx, count: number): Promise<{ customers: string[]; vendors: string[] }> {
  const customers: string[] = [];
  const vendors: string[] = [];
  const now = new Date().toISOString();
  for (let i = 0; i < count; i++) {
    const id = uuid();
    const roll = i % 10;
    const type = roll < 4 ? 'vendor' : roll === 4 ? 'both' : 'customer';
    const name =
      type === 'vendor'
        ? `Vendor ${String(i + 1).padStart(3, '0')}`
        : type === 'customer'
          ? `Customer ${String(i + 1).padStart(3, '0')}`
          : `Trade Partner ${String(i + 1).padStart(3, '0')}`;
    await tx.execute(
      `INSERT INTO parties (id, name, type, phone, address, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, type, `9${String(1000000000 + i).slice(-10)}`, null, null, now],
    );
    if (type === 'customer' || type === 'both') customers.push(id);
    if (type === 'vendor' || type === 'both') vendors.push(id);
  }
  return { customers, vendors };
}

async function insertItems(tx: Tx, count: number): Promise<string[]> {
  const ids: string[] = [];
  const catId = uuid();
  await tx.execute(`INSERT INTO item_categories (id, name) VALUES (?, ?)`, [catId, 'General']);
  const now = new Date().toISOString();
  for (let i = 0; i < count; i++) {
    const id = uuid();
    const openingQty = randInt(500, 2000);
    const openingCost = randInt(2000, 25000); // ₹20–250 in paise units... 2000 paise = ₹20
    await tx.execute(
      `INSERT INTO items (id, name, category_id, unit, selling_price, qty, avg_cost, opening_qty, opening_unit_cost, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        `Product ${String(i + 1).padStart(3, '0')}`,
        catId,
        pick(['pcs', 'kg', 'box', 'ltr']),
        openingCost + randInt(500, 15000),
        openingQty,
        openingCost,
        openingQty,
        openingCost,
        now,
      ],
    );
    ids.push(id);
  }
  return ids;
}

async function insertPurchases(
  db: AbstractPowerSyncDatabase,
  count: number,
  vendorIds: string[],
  itemIds: string[],
  monthsBack: number,
  onProgress?: (p: MockDataProgress) => void,
) {
  let seq = await db.getOptional<{ max_seq: number | null }>(`SELECT MAX(seq) AS max_seq FROM purchases`);
  let nextPurchaseSeq = (seq?.max_seq ?? 0) + 1;

  for (let batch = 0; batch < count; batch += BATCH) {
    const limit = Math.min(BATCH, count - batch);
    await db.writeTransaction(async (tx) => {
      for (let i = 0; i < limit; i++) {
        const purchaseId = uuid();
        const partyId = pick(vendorIds);
        const date = randomDate(monthsBack);
        const lineCount = randInt(1, 3);
        let subtotal = 0;
        const now = new Date().toISOString();
        const docNo = `PUR-${String(nextPurchaseSeq).padStart(4, '0')}`;
        nextPurchaseSeq++;

        for (let l = 0; l < lineCount; l++) {
          const itemId = pick(itemIds);
          const qty = randInt(5, 40);
          const unitPrice = randInt(3000, 45000);
          const lineTotal = mulQty(qty, unitPrice);
          subtotal += lineTotal;
          await tx.execute(
            `INSERT INTO purchase_items (id, purchase_id, item_id, name, qty, unit_price, line_total)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [uuid(), purchaseId, itemId, `Product`, qty, unitPrice, lineTotal],
          );
          await applyPurchaseToItem(tx, itemId, qty, unitPrice);
        }

        await tx.execute(
          `INSERT INTO purchases (id, bill_no, seq, party_id, date, status, subtotal, discount_amount,
                                  discount_pct, total, paid_amount, note, created_at)
           VALUES (?, ?, ?, ?, ?, 'credit', ?, 0, 0, ?, 0, ?, ?)`,
          [purchaseId, docNo, nextPurchaseSeq - 1, partyId, date, subtotal, subtotal, null, now],
        );
        await postEntry(tx, {
          date,
          memo: `Purchase ${docNo}`,
          sourceType: 'purchase',
          sourceId: purchaseId,
          lines: [
            { accountId: ACC.INVENTORY, amount: subtotal },
            { accountId: ACC.AP, amount: -subtotal, partyId },
          ],
        });
      }
    });
    emitProgress(onProgress, 'Purchases', batch + limit, count);
  }
}

async function insertSales(
  db: AbstractPowerSyncDatabase,
  count: number,
  customerIds: string[],
  itemIds: string[],
  monthsBack: number,
  onProgress?: (p: MockDataProgress) => void,
) {
  let seqRow = await db.getOptional<{ max_seq: number | null }>(`SELECT MAX(seq) AS max_seq FROM sales`);
  let nextSaleSeq = (seqRow?.max_seq ?? 0) + 1;

  for (let batch = 0; batch < count; batch += BATCH) {
    const limit = Math.min(BATCH, count - batch);
    await db.writeTransaction(async (tx) => {
      for (let i = 0; i < limit; i++) {
        const saleId = uuid();
        const partyId = pick(customerIds);
        const date = randomDate(monthsBack);
        const lineCount = randInt(1, 3);
        let subtotal = 0;
        let cogs = 0;
        const now = new Date().toISOString();
        const docNo = `INV-${String(nextSaleSeq).padStart(4, '0')}`;
        nextSaleSeq++;

        for (let l = 0; l < lineCount; l++) {
          const itemId = pick(itemIds);
          const item = await tx.getOptional<{ avg_cost: number; qty: number; name: string }>(
            `SELECT avg_cost, qty, name FROM items WHERE id = ?`,
            [itemId],
          );
          if (!item || item.qty <= 0) continue;
          const qty = Math.min(randInt(1, 8), item.qty);
          const unitPrice = (item.avg_cost ?? 0) + randInt(1000, 20000);
          const unitCost = item.avg_cost ?? 0;
          const lineTotal = mulQty(qty, unitPrice);
          subtotal += lineTotal;
          cogs += mulQty(qty, unitCost);
          await tx.execute(
            `INSERT INTO sale_items (id, sale_id, item_id, name, qty, unit_price, unit_cost, line_total)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [uuid(), saleId, itemId, item.name, qty, unitPrice, unitCost, lineTotal],
          );
          await applySaleToItem(tx, itemId, qty);
        }

        if (subtotal === 0) continue;

        const paid = Math.random() < 0.35 ? randInt(Math.floor(subtotal * 0.3), subtotal) : 0;
        await tx.execute(
          `INSERT INTO sales (id, invoice_no, seq, party_id, date, status, subtotal, discount_amount,
                              discount_pct, total, paid_amount, cogs_total, profit, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)`,
          [
            saleId,
            docNo,
            nextSaleSeq - 1,
            partyId,
            date,
            payStatus(subtotal, paid),
            subtotal,
            subtotal,
            paid,
            cogs,
            subtotal - cogs,
            null,
            now,
          ],
        );
        await postEntry(tx, {
          date,
          memo: `Sale ${docNo}`,
          sourceType: 'sale',
          sourceId: saleId,
          lines: [
            { accountId: ACC.AR, amount: subtotal, partyId },
            { accountId: ACC.SALES, amount: -subtotal },
            ...(cogs > 0
              ? [
                  { accountId: ACC.COGS, amount: cogs },
                  { accountId: ACC.INVENTORY, amount: -cogs },
                ]
              : []),
          ],
        });

        if (paid > 0) {
          const paymentId = uuid();
          await tx.execute(
            `INSERT INTO payments (id, direction, party_id, date, amount, account_id, method, note, created_at)
             VALUES (?, 'in', ?, ?, ?, ?, 'cash', ?, ?)`,
            [paymentId, partyId, date, paid, ACC.CASH, null, now],
          );
          await tx.execute(
            `INSERT INTO payment_allocations (id, payment_id, sale_id, purchase_id, amount)
             VALUES (?, ?, ?, NULL, ?)`,
            [uuid(), paymentId, saleId, paid],
          );
          await postEntry(tx, {
            date,
            memo: 'Payment received',
            sourceType: 'payment',
            sourceId: paymentId,
            lines: [
              { accountId: ACC.CASH, amount: paid },
              { accountId: ACC.AR, amount: -paid, partyId },
            ],
          });
        }
      }
    });
    emitProgress(onProgress, 'Sales', batch + limit, count);
  }
}

async function insertExpenses(
  db: AbstractPowerSyncDatabase,
  count: number,
  monthsBack: number,
  onProgress?: (p: MockDataProgress) => void,
) {
  for (let batch = 0; batch < count; batch += BATCH) {
    const limit = Math.min(BATCH, count - batch);
    await db.writeTransaction(async (tx) => {
      for (let i = 0; i < limit; i++) {
        const id = uuid();
        const date = randomDate(monthsBack);
        const amount = randInt(50000, 800000);
        const categoryId = pick(EXPENSE_CATEGORIES);
        const now = new Date().toISOString();
        await tx.execute(
          `INSERT INTO expenses (id, category_id, date, amount, account_id, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, categoryId, date, amount, ACC.CASH, `Mock expense ${batch + i + 1}`, now],
        );
        await postEntry(tx, {
          date,
          memo: 'Expense',
          sourceType: 'expense',
          sourceId: id,
          lines: [
            { accountId: categoryId, amount },
            { accountId: ACC.CASH, amount: -amount },
          ],
        });
      }
    });
    emitProgress(onProgress, 'Expenses', batch + limit, count);
  }
}

async function insertStandalonePayments(
  db: AbstractPowerSyncDatabase,
  count: number,
  customerIds: string[],
  vendorIds: string[],
  monthsBack: number,
  onProgress?: (p: MockDataProgress) => void,
) {
  for (let batch = 0; batch < count; batch += BATCH) {
    const limit = Math.min(BATCH, count - batch);
    await db.writeTransaction(async (tx) => {
      for (let i = 0; i < limit; i++) {
        const inbound = Math.random() < 0.5;
        const partyId = pick(inbound ? customerIds : vendorIds);
        const date = randomDate(monthsBack);
        const amount = randInt(10000, 500000);
        const paymentId = uuid();
        const now = new Date().toISOString();
        await tx.execute(
          `INSERT INTO payments (id, direction, party_id, date, amount, account_id, method, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'bank', ?, ?)`,
          [paymentId, inbound ? 'in' : 'out', partyId, date, amount, ACC.CASH, null, now],
        );
        if (inbound) {
          await postEntry(tx, {
            date,
            memo: 'Payment received',
            sourceType: 'payment',
            sourceId: paymentId,
            lines: [
              { accountId: ACC.CASH, amount },
              { accountId: ACC.AR, amount: -amount, partyId },
            ],
          });
        } else {
          await postEntry(tx, {
            date,
            memo: 'Payment made',
            sourceType: 'payment',
            sourceId: paymentId,
            lines: [
              { accountId: ACC.AP, amount, partyId },
              { accountId: ACC.CASH, amount: -amount },
            ],
          });
        }
      }
    });
    emitProgress(onProgress, 'Payments', batch + limit, count);
  }
}

/** Generate a large mock dataset for UI and performance testing. */
export async function generateMockData(
  db: AbstractPowerSyncDatabase,
  scale: MockDataScale = 'large',
  opts?: {
    resetFirst?: boolean;
    onProgress?: (p: MockDataProgress) => void;
  },
): Promise<MockDataResult> {
  if (!import.meta.env.DEV) {
    throw new Error('Mock data generation is only available in development.');
  }

  const counts = MOCK_DATA_PRESETS[scale];
  const started = performance.now();
  const onProgress = opts?.onProgress;

  if (opts?.resetFirst) {
    emitProgress(onProgress, 'Resetting…', 0, 1);
    await factoryReset(db);
    await ensureSeeded(db);
    emitProgress(onProgress, 'Resetting…', 1, 1);
  }

  let customerIds: string[] = [];
  let vendorIds: string[] = [];
  let itemIds: string[] = [];

  emitProgress(onProgress, 'Parties & items', 0, counts.parties + counts.items);
  await db.writeTransaction(async (tx) => {
    const parties = await insertParties(tx, counts.parties);
    customerIds = parties.customers;
    vendorIds = parties.vendors;
    itemIds = await insertItems(tx, counts.items);
  });
  emitProgress(onProgress, 'Parties & items', counts.parties + counts.items, counts.parties + counts.items);

  if (customerIds.length === 0) customerIds = vendorIds;
  if (vendorIds.length === 0) vendorIds = customerIds;

  // Purchases before sales to ensure plenty of stock (items also start with opening qty).
  await insertPurchases(db, counts.purchases, vendorIds, itemIds, counts.monthsBack, onProgress);
  await insertSales(db, counts.sales, customerIds, itemIds, counts.monthsBack, onProgress);
  await insertExpenses(db, counts.expenses, counts.monthsBack, onProgress);
  await insertStandalonePayments(db, counts.payments, customerIds, vendorIds, counts.monthsBack, onProgress);

  emitProgress(onProgress, 'Done', 1, 1);

  return { ...counts, elapsedMs: Math.round(performance.now() - started) };
}
