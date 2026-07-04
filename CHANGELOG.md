# Changelog

All notable changes to **Sudo — Business Finance** are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.3.0] — 2026-07-04

### Added

- **Local data wipe on sign-out** — clears SQLite, upload queue, TanStack cache, and sync-failure log to prevent cross-user data leaks on shared devices.
- **Fatal upload error surfacing** — discarded ops logged, toasted, and shown in header + Settings.
- **Forgot-password flow** — email reset link, friendlier auth errors, password visibility toggle.
- **Dashboard charts** — 6-month revenue vs expenses bar chart and net-profit trend.
- **Skeleton loaders** — KPI and list skeletons on Dashboard and primary list routes.
- **Empty-state CTAs** — Banking, Dues, Other Income, Fixed Assets, GL, Payments.
- **List pagination** — load-more on Dues, Parties, Inventory, Other Income, GL, and standardized across Sales/Purchases/Payments.
- **Doc-number collision guards** — local retry loop, peek collision check, Supabase unique indexes.
- **Sync diagnostics** — `useSyncFailures` hook, cloud factory-reset RPC, token diagnostics module.

### Fixed

- **`paid_amount` capped at document total** on recalc after edits.
- **Zero-COGS sales** skip erroneous inventory credit journal lines.
- **Mobile table scroll** — horizontal overflow wrapper fix.
- **GL debit/credit colors** — consistent signed-amount styling.

### Cloud sync (v0.3.0)

If you use Supabase + PowerSync, run `supabase/migrations/20260704_v0_2_3_doc_number_uniqueness.sql` in the SQL Editor (if not already applied).

## [0.2.4] — 2026-07-04

### Added

- **Oversell protection** — sales blocked when qty exceeds on-hand stock (create and edit).
- **Insufficient balance checks** — transfers and withdrawals rejected when the account cannot cover the amount.
- **Reverse banking entries** — undo deposits, withdrawals, and transfers from the bank account page.
- **Fixed asset edit** — update name, cost, date, and paid-from account with ledger repost.
- **Recurring expense delete** — remove template from edit dialog (posted expenses kept).
- **Vitest** — inventory replay and banking reversal unit tests (`npm test`).

### Fixed

- **Sale edit COGS** — preserves original unit-cost snapshot per item instead of recalculating from current WAC.
- **Party delete** — also blocked when the party appears on ledger lines.

## [0.2.3] — 2026-07-04

### Fixed

- **Delete inventory item** — removes the opening-stock journal entry (inventory was overstated in the ledger).
- **Delete purchase** — inventory/WAC recomputed before row deletion (same class of bug as sale delete).
- **Edit sale/purchase customer** — linked payment records and AR/AP journal lines follow the new party.

## [0.2.2] — 2026-07-04

### Fixed

- **Sale delete/edit not restoring inventory** — stock is now incrementally restored when a sale is deleted or lines change (mirrors the reduce-on-create path).
- **Inventory replay ignored opening stock** — `recomputeItemState` (used for purchase delete/edit) now starts from frozen `opening_qty` / `opening_unit_cost` baselines; existing items are backfilled on app load.

### Cloud sync (v0.2.2)

If you use Supabase + PowerSync, run `supabase/migrations/20260704_v0_2_2_inventory_opening.sql` in the SQL Editor.

## [0.2.1] — 2026-07-04

### Added

- **Daily auto-backup** — save a JSON backup to a chosen folder once per day (Chrome / Edge File System Access API).
- **Backup domain module** (`src/domain/backup.ts`) — shared export, import, and factory-reset logic.
- **Page transitions** and mobile UX polish (touch scrolling, reduced-motion support, dialog body scroll lock fix).
- **PWA icons** — PNG favicon, apple-touch-icon, and install icons generated from SVG sources.
- **CI workflow** — lint + build on push/PR to `main`.

### Changed

- Settings redesigned with grouped sections, toggle rows, and factory-reset confirmation phrase.
- Dialog overlay restores previous `body` overflow instead of clearing it unconditionally.

### Fixed

- Missing PWA / favicon PNG assets referenced by manifest and `index.html`.

## [0.2.0] — 2026-07-04

### Added

- **Profit & Loss report** with revenue, COGS, gross profit, other income, expense breakdown, and net profit (respects month filter).
- **Recurring expenses** — templates, due-this-month list, one-tap record to ledger.
- **Expense detail** subpage with edit and delete.
- **Bank account detail** subpage with balance, transactions, deposit/withdraw.
- **Bank accounts excluded from total liquid** — per-account toggle; optional “All accounts” list filter on Banking.
- **Editable invoice / bill numbers** on new sales and purchases.
- **Compact KPI pills** on list pages (Sales, Purchases, Expenses, Banking, etc.).
- **Account picker** on General Ledger (searchable dialog, grouped by type); default view is all accounts.
- Shared **P&L calculation** (`src/domain/pl.ts`) used by Dashboard and P&L report.
- PWA **auto-update** registration on app load (`registerType: 'autoUpdate'`).

### Changed

- **Dashboard Net Profit** uses the same formula as the P&L report and links to `/reports/profit-loss`.
- **Banking** — compact list, quick deposit/withdraw/transfer row, FAB for new account.
- **Expenses** — flat compact list linking to detail; recurring section at top.
- **Subpage navigation** — back arrow navigates to parent route instead of opening the sidebar.
- Settings export includes `recurring_expenses` table.
- App version shown in Settings footer (from `package.json`).

### Fixed

- Sale/purchase form route `id=new` no longer treated as an edit.

### Cloud sync (v0.2.0)

If you use Supabase + PowerSync, run `supabase/migrations/20260704_v0_2_0.sql` in the SQL Editor and update sync rules (see `SETUP.md`).

## [0.1.0] — 2026-07-03

### Added

- Initial release: offline-first PWA with PowerSync + Supabase sync.
- Sales, purchases, parties, inventory, banking, payments, expenses, other income, fixed assets.
- Double-entry ledger, General Ledger, Trial Balance, Balance Sheet, and operational reports.
- Dashboard KPIs, Growth charts, global month filter, light/dark theme, JSON export.

[0.3.0]: https://github.com/sudosiam/Sudo/compare/v0.2.4...v0.3.0
[0.2.4]: https://github.com/sudosiam/Sudo/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/sudosiam/Sudo/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/sudosiam/Sudo/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/sudosiam/Sudo/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/sudosiam/Sudo/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/sudosiam/Sudo/releases/tag/v0.1.0
