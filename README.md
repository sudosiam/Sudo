# Sudo — Business Finance

**Offline-first accounting and inventory for a solo business owner.**

Sudo is a installable PWA that runs entirely in the browser: local SQLite (PowerSync) for instant reads and writes, optional real-time sync to Supabase Postgres, and a proper double-entry ledger underneath every sale, purchase, payment, expense, and asset.

**Current version:** 0.3.0 · [Changelog](./CHANGELOG.md)

## Goal

One person, one business — track sales and purchases, stock and profit, cash and bank, payables and receivables, and produce accountant-ready reports without spreadsheets or a monthly subscription.

| Capability | Status |
|------------|--------|
| Double-entry ledger (GL, Trial Balance, Balance Sheet, P&L) | ✓ |
| Sales & purchases with line items, discounts, payments | ✓ |
| Weighted-average inventory + per-sale COGS → real profit | ✓ |
| Parties (customers/vendors), dues, party statements (PDF) | ✓ |
| Banking (accounts, transfers, deposits, withdrawals) | ✓ |
| Expenses, recurring expenses, other income, fixed assets | ✓ |
| Payments in/out with allocation to invoices/bills | ✓ |
| Dashboard KPIs + Growth charts | ✓ |
| Offline-first PWA (works with no network) | ✓ |
| Optional cloud sync (single owner, multi-device) | ✓ |
| GST / tax, depreciation, bank reconciliation | Not in scope |

## Highlights

- **Offline-first** — reads and writes go to local SQLite (wa-sqlite / OPFS). Works with zero network; changes queue and sync when back online.
- **Real-time multi-device sync** via PowerSync + Supabase (optional — see `SETUP.md`).
- **Double-entry core** — every transaction posts balanced journal lines. Reports are always consistent; nothing is recalculated at report time.
- **Paise integers** — all money stored as integer paise. No floating-point drift.
- **Weighted average cost** inventory with per-sale COGS snapshots → real profit per invoice.
- **Global month filter** shared across lists, KPIs, and reports.
- **Secure solo use** — sign-out wipes local data and query cache so a shared device never leaks business data between accounts.
- **Sync visibility** — upload queue, fatal error toasts, and a durable discarded-upload log in Settings.
- **PWA** — installable, auto-updating service worker, background upload queue, haptic feedback.
- Light / dark / system theme.

## Modules

Dashboard (KPIs, charts, recent activity) · Sales · Purchases ·
Parties (customer/vendor, ledger statement w/ PDF) · Payables/Receivables · Inventory ·
Banking (accounts, transfers, exclude from liquid total, transaction drill-down) ·
General Ledger · Expenses (custom categories, recurring expenses, detail pages) ·
Other Income · Fixed Assets · Payments in/out (split + allocation) ·
Reports (COA, Trial Balance, Balance Sheet, Profit & Loss, sales/purchase/expense/inventory) ·
Growth (12-month net worth, surplus, profit, revenue-vs-expense charts) · Settings.

## Getting started

```bash
npm install
npm run dev
```

The app runs fully local out of the box (no login). To enable login + cloud sync,
follow **`SETUP.md`** (Supabase + PowerSync free tiers), then create `.env.local`
from `.env.example`.

## Build, test & deploy

```bash
npm test          # unit tests
npm run build     # production build
npm run preview   # preview dist/
```

Installed PWAs pick up new builds automatically (service worker auto-update on next visit).

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v4 · PowerSync Web SDK ·
Supabase (Auth + Postgres) · TanStack Query · Recharts · jsPDF · vite-plugin-pwa

## Repository

https://github.com/sudosiam/Sudo
