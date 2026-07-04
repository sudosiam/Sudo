import type { AbstractPowerSyncDatabase } from '@powersync/web';
import { uuid } from '../lib/utils';

export const SETTING_DEFAULTS: Record<string, string> = {
  business_name: 'My Business',
  invoice_prefix: 'INV',
  purchase_prefix: 'PUR',
  haptics: '1',
  auto_backup_enabled: '0',
  auto_backup_last_date: '',
};

export async function getSetting(db: AbstractPowerSyncDatabase, key: string): Promise<string> {
  const row = await db.getOptional<{ value: string }>(
    `SELECT value FROM app_settings WHERE key = ? LIMIT 1`,
    [key],
  );
  return row?.value ?? SETTING_DEFAULTS[key] ?? '';
}

export async function setSetting(db: AbstractPowerSyncDatabase, key: string, value: string) {
  const existing = await db.getOptional<{ id: string }>(
    `SELECT id FROM app_settings WHERE key = ? LIMIT 1`,
    [key],
  );
  if (existing) {
    await db.execute(`UPDATE app_settings SET value = ? WHERE id = ?`, [value, existing.id]);
  } else {
    await db.execute(`INSERT INTO app_settings (id, key, value) VALUES (?, ?, ?)`, [
      uuid(),
      key,
      value,
    ]);
  }
}
