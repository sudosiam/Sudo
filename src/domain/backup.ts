import type { AbstractPowerSyncDatabase } from '@powersync/web';
import { ensureSeeded } from './seed';
import { APP_VERSION } from '../lib/version';

export const BACKUP_VERSION = 1;

/** Tables included in export / import / factory reset. */
export const BACKUP_TABLES = [
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
  'drafts',
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

/** Child tables first — safe delete order. */
const DELETE_ORDER: BackupTable[] = [
  'payment_allocations',
  'sale_items',
  'purchase_items',
  'journal_lines',
  'payments',
  'sales',
  'purchases',
  'expenses',
  'recurring_expenses',
  'other_incomes',
  'fixed_assets',
  'journal_entries',
  'items',
  'parties',
  'item_categories',
  'accounts',
  'app_settings',
  'drafts',
];

/** Parent tables first — safe insert order. */
const INSERT_ORDER: BackupTable[] = [
  'parties',
  'item_categories',
  'accounts',
  'items',
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
  'drafts',
];

export const FACTORY_RESET_PHRASE = 'DELETE ALL DATA';

export interface BackupPayload {
  version: number;
  exported_at: string;
  app_version: string;
  tables: Record<string, unknown[]>;
}

export function backupFilename(date = new Date()) {
  return `sudo-backup-${date.toISOString().slice(0, 10)}.json`;
}

export function preResetBackupFilename(date = new Date()) {
  return `sudo-backup-before-reset-${date.toISOString().slice(0, 10)}.json`;
}

export async function buildBackup(db: AbstractPowerSyncDatabase): Promise<BackupPayload> {
  const tables: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) {
    tables[t] = await db.getAll(`SELECT * FROM ${t}`);
  }
  return {
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    app_version: APP_VERSION,
    tables,
  };
}

export function serializeBackup(payload: BackupPayload): string {
  return JSON.stringify(payload, null, 2);
}

export function downloadBackup(json: string, filename = backupFilename()) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportAndDownload(db: AbstractPowerSyncDatabase, filename = backupFilename()) {
  const payload = await buildBackup(db);
  const json = serializeBackup(payload);
  downloadBackup(json, filename);
  return { json, filename };
}

function parseBackupTables(raw: unknown): Record<string, unknown[]> {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid backup file — expected JSON object.');
  }
  const obj = raw as Record<string, unknown>;

  if (obj.tables && typeof obj.tables === 'object' && !Array.isArray(obj.tables)) {
    return obj.tables as Record<string, unknown[]>;
  }

  const legacy: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) {
    if (Array.isArray(obj[t])) legacy[t] = obj[t] as unknown[];
  }
  if (Object.keys(legacy).length === 0) {
    throw new Error('No recognized tables found in backup file.');
  }
  return legacy;
}

async function insertRows(
  tx: Parameters<Parameters<AbstractPowerSyncDatabase['writeTransaction']>[0]>[0],
  table: string,
  rows: unknown[],
) {
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const cols = Object.keys(record);
    if (cols.length === 0) continue;
    const placeholders = cols.map(() => '?').join(', ');
    await tx.execute(
      `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
      cols.map((c) => record[c]),
    );
  }
}

async function clearAllTables(db: AbstractPowerSyncDatabase) {
  await db.writeTransaction(async (tx) => {
    for (const t of DELETE_ORDER) {
      await tx.execute(`DELETE FROM ${t}`);
    }
  });
}

/** Replace all local data with the contents of a backup file. */
export async function importBackup(db: AbstractPowerSyncDatabase, raw: unknown) {
  const tables = parseBackupTables(raw);

  await clearAllTables(db);

  await db.writeTransaction(async (tx) => {
    for (const t of INSERT_ORDER) {
      const rows = tables[t];
      if (Array.isArray(rows) && rows.length > 0) {
        await insertRows(tx, t, rows);
      }
    }
  });

  await ensureSeeded(db);
}

/** Wipe all business data and restore the default chart of accounts. */
export async function factoryReset(db: AbstractPowerSyncDatabase) {
  await clearAllTables(db);
  await ensureSeeded(db);
}
