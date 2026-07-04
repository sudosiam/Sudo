import * as React from 'react';
import type { AbstractPowerSyncDatabase } from '@powersync/web';
import {
  backupFilename,
  buildBackup,
  serializeBackup,
} from '../domain/backup';
import { getSetting, setSetting } from '../domain/settings';
import { writeBackupToFolder } from '../lib/backupFolder';

async function runDailyBackupIfDue(db: AbstractPowerSyncDatabase) {
  const enabled = await getSetting(db, 'auto_backup_enabled');
  if (enabled !== '1') return;

  const today = new Date().toISOString().slice(0, 10);
  const last = await getSetting(db, 'auto_backup_last_date');
  if (last === today) return;

  const payload = await buildBackup(db);
  const json = serializeBackup(payload);
  const filename = backupFilename();

  const folderOk = await writeBackupToFolder(json, filename);
  if (!folderOk) return;

  await setSetting(db, 'auto_backup_last_date', today);
}

/** Runs a daily backup when auto-backup is enabled (on load and when tab becomes visible). */
export function useAutoBackup(db: AbstractPowerSyncDatabase) {
  const runningRef = React.useRef(false);

  const tryRun = React.useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      await runDailyBackupIfDue(db);
    } catch (e) {
      console.error('Auto-backup failed', e);
    } finally {
      runningRef.current = false;
    }
  }, [db]);

  React.useEffect(() => {
    void tryRun();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void tryRun();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [tryRun]);
}
