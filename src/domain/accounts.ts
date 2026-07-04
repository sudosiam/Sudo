/**
 * System Chart of Accounts. IDs are deterministic so posting code can
 * reference them directly and seeding is idempotent across devices.
 */

export const ACC = {
  CASH: 'acc-cash',
  AR: 'acc-ar',
  INVENTORY: 'acc-inventory',
  FIXED_ASSETS: 'acc-fixed-assets',
  AP: 'acc-ap',
  EQUITY: 'acc-equity',
  SALES: 'acc-sales',
  OTHER_INCOME: 'acc-other-income',
  COGS: 'acc-cogs',
} as const;

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export interface SeedAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: string;
  is_system: number;
}

export const SEED_ACCOUNTS: SeedAccount[] = [
  { id: ACC.CASH, code: '1000', name: 'Cash', type: 'asset', subtype: 'cash', is_system: 1 },
  { id: ACC.AR, code: '1100', name: 'Accounts Receivable', type: 'asset', subtype: 'ar', is_system: 1 },
  { id: ACC.INVENTORY, code: '1200', name: 'Inventory', type: 'asset', subtype: 'inventory', is_system: 1 },
  { id: ACC.FIXED_ASSETS, code: '1500', name: 'Fixed Assets', type: 'asset', subtype: 'fixed_asset', is_system: 1 },
  { id: ACC.AP, code: '2000', name: 'Accounts Payable', type: 'liability', subtype: 'ap', is_system: 1 },
  { id: ACC.EQUITY, code: '3000', name: "Owner's Equity", type: 'equity', subtype: 'equity', is_system: 1 },
  { id: ACC.SALES, code: '4000', name: 'Sales Revenue', type: 'income', subtype: 'sales', is_system: 1 },
  { id: ACC.OTHER_INCOME, code: '4900', name: 'Other Income', type: 'income', subtype: 'other_income', is_system: 1 },
  { id: ACC.COGS, code: '5000', name: 'Cost of Goods Sold', type: 'expense', subtype: 'cogs', is_system: 1 },
  // Starter expense categories — user can add custom ones from the Expenses module
  { id: 'acc-exp-rent', code: '6000', name: 'Rent', type: 'expense', subtype: 'opex', is_system: 1 },
  { id: 'acc-exp-salaries', code: '6010', name: 'Salaries & Wages', type: 'expense', subtype: 'opex', is_system: 1 },
  { id: 'acc-exp-electricity', code: '6020', name: 'Electricity & Utilities', type: 'expense', subtype: 'opex', is_system: 1 },
  { id: 'acc-exp-transport', code: '6030', name: 'Transport & Fuel', type: 'expense', subtype: 'opex', is_system: 1 },
  { id: 'acc-exp-misc', code: '6900', name: 'Miscellaneous', type: 'expense', subtype: 'opex', is_system: 1 },
];

/** IDs of built-in accounts — local-only; must not upsert to shared Postgres (global PK). */
export const SEED_ACCOUNT_IDS = new Set(SEED_ACCOUNTS.map((a) => a.id));

/**
 * Normal balance sign per account type: debit-normal types show positive
 * balances when SUM(amount) > 0 (amount is +debit / -credit).
 */
export function isDebitNormal(type: string): boolean {
  return type === 'asset' || type === 'expense';
}

/** Display balance with the account's natural sign */
export function naturalBalance(type: string, rawSum: number): number {
  return isDebitNormal(type) ? rawSum : -rawSum;
}
