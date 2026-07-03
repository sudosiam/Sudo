# Changelog

All notable changes to **Sudo — Business Finance** are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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

## [0.1.0] — 2026-07-03

### Added

- Initial release: offline-first PWA with PowerSync + Supabase sync.
- Sales, purchases, parties, inventory, banking, payments, expenses, other income, fixed assets.
- Double-entry ledger, General Ledger, Trial Balance, Balance Sheet, and operational reports.
- Dashboard KPIs, Growth charts, global month filter, light/dark theme, JSON export.

[0.2.0]: https://github.com/sudosiam/Sudo/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/sudosiam/Sudo/releases/tag/v0.1.0
