import { column, Schema, Table } from '@powersync/web';

/**
 * Local SQLite schema, mirrored in Supabase Postgres when cloud sync is enabled.
 * All money columns are integer paise. Quantities are REAL.
 * `owner_id` lives only in Postgres (default auth.uid()) — not needed locally.
 */

const parties = new Table(
  {
    name: column.text,
    type: column.text, // 'customer' | 'vendor' | 'both'
    phone: column.text,
    address: column.text,
    note: column.text,
    created_at: column.text,
  },
  { indexes: { type: ['type'], name: ['name'] } },
);

const item_categories = new Table({
  name: column.text,
});

const items = new Table(
  {
    name: column.text,
    category_id: column.text,
    unit: column.text,
    selling_price: column.integer, // paise, nullable (blank until set)
    qty: column.real, // current stock, maintained incrementally
    avg_cost: column.integer, // weighted average cost in paise, maintained incrementally
    opening_qty: column.real, // frozen opening on-hand qty (for replay after purchase edits)
    opening_unit_cost: column.integer, // frozen opening WAC in paise
    created_at: column.text,
  },
  { indexes: { category: ['category_id'], name: ['name'] } },
);

const accounts = new Table(
  {
    code: column.text,
    name: column.text,
    type: column.text, // 'asset' | 'liability' | 'equity' | 'income' | 'expense'
    subtype: column.text, // 'cash','bank','ar','ap','inventory','fixed_asset','sales','other_income','cogs','opex','equity','discount'
    is_system: column.integer, // 1 = seeded, cannot delete
    archived: column.integer,
    include_in_liquid: column.integer, // 1 = counts in total liquid KPI (bank accounts can opt out)
    created_at: column.text,
  },
  { indexes: { type: ['type'], subtype: ['subtype'] } },
);

const journal_entries = new Table(
  {
    date: column.text, // YYYY-MM-DD
    memo: column.text,
    source_type: column.text, // 'sale'|'purchase'|'payment'|'expense'|'other_income'|'fixed_asset'|'adjustment'|'opening'
    source_id: column.text,
    created_at: column.text,
  },
  { indexes: { date: ['date'], source: ['source_type', 'source_id'] } },
);

const journal_lines = new Table(
  {
    entry_id: column.text,
    account_id: column.text,
    amount: column.integer, // paise; positive = debit, negative = credit
    party_id: column.text,
    date: column.text, // denormalized from the entry for fast range scans
  },
  {
    indexes: {
      account_date: ['account_id', 'date'],
      entry: ['entry_id'],
      party: ['party_id'],
      date: ['date'],
    },
  },
);

const sales = new Table(
  {
    invoice_no: column.text, // "INV-001"
    seq: column.integer,
    party_id: column.text,
    date: column.text,
    status: column.text, // 'paid' | 'partial' | 'credit'
    subtotal: column.integer,
    discount_amount: column.integer,
    discount_pct: column.real,
    total: column.integer,
    paid_amount: column.integer, // maintained from payment allocations
    cogs_total: column.integer,
    profit: column.integer, // total - cogs_total
    note: column.text,
    created_at: column.text,
  },
  { indexes: { date: ['date'], party: ['party_id'], status: ['status'] } },
);

const sale_items = new Table(
  {
    sale_id: column.text,
    item_id: column.text,
    name: column.text, // snapshot
    qty: column.real,
    unit_price: column.integer,
    unit_cost: column.integer, // WAC snapshot at time of sale
    line_total: column.integer,
  },
  { indexes: { sale: ['sale_id'], item: ['item_id'] } },
);

const purchases = new Table(
  {
    bill_no: column.text, // "PUR-001"
    seq: column.integer,
    party_id: column.text,
    date: column.text,
    status: column.text,
    subtotal: column.integer,
    discount_amount: column.integer,
    discount_pct: column.real,
    total: column.integer,
    paid_amount: column.integer,
    note: column.text,
    created_at: column.text,
  },
  { indexes: { date: ['date'], party: ['party_id'], status: ['status'] } },
);

const purchase_items = new Table(
  {
    purchase_id: column.text,
    item_id: column.text,
    name: column.text,
    qty: column.real,
    unit_price: column.integer,
    line_total: column.integer,
  },
  { indexes: { purchase: ['purchase_id'], item: ['item_id'] } },
);

const payments = new Table(
  {
    direction: column.text, // 'in' | 'out'
    party_id: column.text,
    date: column.text,
    amount: column.integer,
    account_id: column.text, // bank/cash account money moved through
    method: column.text, // 'cash' | 'bank' | 'upi' | 'card' | 'other'
    note: column.text,
    created_at: column.text,
  },
  { indexes: { date: ['date'], party: ['party_id'], account: ['account_id'] } },
);

const payment_allocations = new Table(
  {
    payment_id: column.text,
    sale_id: column.text,
    purchase_id: column.text,
    amount: column.integer,
  },
  { indexes: { payment: ['payment_id'], sale: ['sale_id'], purchase: ['purchase_id'] } },
);

const expenses = new Table(
  {
    category_id: column.text, // references accounts.id (subtype 'opex')
    date: column.text,
    amount: column.integer,
    account_id: column.text, // paid from
    note: column.text,
    created_at: column.text,
  },
  { indexes: { date: ['date'], category: ['category_id'] } },
);

const recurring_expenses = new Table(
  {
    label: column.text,
    category_id: column.text,
    amount: column.integer,
    account_id: column.text,
    day_of_month: column.integer, // 1–28, expense date each month
    active: column.integer, // 1 = on, 0 = paused
    last_posted_month: column.text, // "YYYY-MM" when last recorded
    note: column.text,
    created_at: column.text,
  },
  { indexes: { active: ['active'] } },
);

const other_incomes = new Table(
  {
    source: column.text,
    date: column.text,
    amount: column.integer,
    account_id: column.text, // received into
    note: column.text,
    created_at: column.text,
  },
  { indexes: { date: ['date'] } },
);

const fixed_assets = new Table(
  {
    name: column.text,
    purchase_date: column.text,
    cost: column.integer,
    account_id: column.text, // paid from
    note: column.text,
    created_at: column.text,
  },
  { indexes: { date: ['purchase_date'] } },
);

const app_settings = new Table({
  key: column.text,
  value: column.text,
});

/** Auto-saved form drafts — never synced to the cloud */
const drafts = new Table(
  {
    kind: column.text, // 'sale' | 'purchase'
    data: column.text, // JSON payload
    updated_at: column.text,
  },
  { localOnly: true },
);

export const AppSchema = new Schema({
  parties,
  item_categories,
  items,
  accounts,
  journal_entries,
  journal_lines,
  sales,
  sale_items,
  purchases,
  purchase_items,
  payments,
  payment_allocations,
  expenses,
  recurring_expenses,
  other_incomes,
  fixed_assets,
  app_settings,
  drafts,
});

export type Database = (typeof AppSchema)['types'];
export type PartyRecord = Database['parties'];
export type ItemRecord = Database['items'];
export type AccountRecord = Database['accounts'];
export type SaleRecord = Database['sales'];
export type SaleItemRecord = Database['sale_items'];
export type PurchaseRecord = Database['purchases'];
export type PurchaseItemRecord = Database['purchase_items'];
export type PaymentRecord = Database['payments'];
export type ExpenseRecord = Database['expenses'];
export type RecurringExpenseRecord = Database['recurring_expenses'];
export type OtherIncomeRecord = Database['other_incomes'];
export type FixedAssetRecord = Database['fixed_assets'];
export type JournalLineRecord = Database['journal_lines'];

/** Synced table names — uploaded to Supabase and subscribed via Realtime */
export const SYNCED_TABLES = [
  'parties',
  'item_categories',
  'items',
  'accounts',
  'journal_entries',
  'journal_lines',
  'sales',
  'sale_items',
  'purchases',
  'purchase_items',
  'payments',
  'payment_allocations',
  'expenses',
  'recurring_expenses',
  'other_incomes',
  'fixed_assets',
  'app_settings',
] as const;
