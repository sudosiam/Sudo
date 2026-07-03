import type { Paise } from '../lib/money';

export interface DocLineInput {
  itemId: string;
  name: string;
  qty: number;
  unitPrice: Paise;
}

export interface PaymentSplitInput {
  accountId: string; // bank/cash account
  amount: Paise;
  method: string; // 'cash' | 'bank' | 'upi' | 'card' | 'other'
}

export interface SaleInput {
  partyId: string;
  date: string;
  lines: DocLineInput[];
  discountPct: number;
  discountAmount: Paise;
  note: string;
  /** money received now — split across accounts */
  payments: PaymentSplitInput[];
  /** Override auto-generated invoice / bill number on create */
  docNo?: string;
}

export type PurchaseInput = SaleInput;

export type PayStatus = 'paid' | 'partial' | 'credit';

export function payStatus(total: Paise, paid: Paise): PayStatus {
  if (total > 0 && paid >= total) return 'paid';
  if (paid > 0) return 'partial';
  return total === 0 ? 'paid' : 'credit';
}
