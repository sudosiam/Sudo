import * as React from 'react';
import type { AbstractPowerSyncDatabase } from '@powersync/web';
import { peekUploadQueue, type UploadQueueItem } from '../lib/syncQueue';

type UploadQueueStats = { count: number; size: number };

export function useUploadQueue(
  db: AbstractPowerSyncDatabase,
  options?: { enabled?: boolean; pollMs?: number; previewLimit?: number },
) {
  const enabled = options?.enabled ?? true;
  const pollMs = options?.pollMs ?? 2000;
  const previewLimit = options?.previewLimit ?? 15;

  const [stats, setStats] = React.useState<UploadQueueStats>({ count: 0, size: 0 });
  const [items, setItems] = React.useState<UploadQueueItem[]>([]);

  const refresh = React.useCallback(async () => {
    try {
      const queueStats = await db.getUploadQueueStats(true);
      setStats({ count: queueStats.count, size: queueStats.size ?? 0 });
      const preview = queueStats.count > 0 ? await peekUploadQueue(db, previewLimit) : [];
      setItems(preview);
    } catch {
      /* ignore — db may not be ready yet */
    }
  }, [db, previewLimit]);

  React.useEffect(() => {
    if (!enabled) {
      setStats({ count: 0, size: 0 });
      setItems([]);
      return;
    }
    void refresh();
    const id = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(id);
  }, [enabled, pollMs, refresh]);

  return { stats, items, refresh };
}
