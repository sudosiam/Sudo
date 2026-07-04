# Sudo — Business Finance

Offline-first business finance & accounting PWA for a solo business owner.
Local SQLite in the browser (PowerSync) synced in real time to Supabase Postgres,
with a proper double-entry ledger underneath every transaction.

**Current version:** 0.2.2 · [Changelog](./CHANGELOG.md)

## Highlights

- **Offline-first**: reads and writes go to a local SQLite database (wa-sqlite / OPFS).
  Works with zero network; changes queue and sync when back online.
- **Real-time multi-device sync** via PowerSync + Supabase (see `SETUP.md`).
- **Double-entry core**: every sale, purchase, payment, expense, income and asset
  posts balanced journal lines — so General Ledger, Trial Balance and Balance Sheet
  are always consistent, with no report-time recalculation.
- **Paise integers**: all money is stored as integer paise; a single `Money` util
  handles parsing/formatting. No floating point drift.
- **Weighted average cost** inventory with per-sale COGS snapshots → real profit per invoice.
- **Global month filter** shared across lists, KPIs and reports.
- **PWA**: installable, offline shell, **auto-updating** service worker, background upload queue.
  Haptic feedback on actions.
- Light / dark / system theme.

## Modules

Dashboard (KPIs, shortcuts, recent activity) · Sales · Purchases ·
Parties (customer/vendor, ledger statement w/ PDF) · Payables/Receivables · Inventory ·
Banking (accounts, transfers, exclude from liquid total, transaction drill-down) ·
General Ledger · Expenses (custom categories, **recurring expenses**, detail pages) ·
Other Income · Fixed Assets · Payments in/out (split + allocation) ·
Reports (COA, Trial Balance, Balance Sheet, **Profit & Loss**, sales/purchase/expense/inventory) ·
Growth (12-month net worth, surplus, profit, revenue-vs-expense charts) · Settings.

## Getting started

```bash
npm install
npm run dev
```

The app runs fully local out of the box (no login). To enable login + cloud sync,
follow **`SETUP.md`** (Supabase + PowerSync free tiers), then create `.env.local`
from `.env.example`.

## Build & deploy

```bash
npm run build && npm run preview
```

Installed PWAs pick up new builds automatically (service worker auto-update on next visit).

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v4 · PowerSync Web SDK ·
Supabase (Auth + Postgres) · TanStack Query · Recharts · jsPDF · vite-plugin-pwa

## Repository

https://github.com/sudosiam/Sudo
