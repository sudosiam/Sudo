import { QueryClient } from '@tanstack/react-query';
import { db } from '../system/db';
import { ensureSeeded } from '../domain/seed';
import { clearDiscardedUploads } from './syncFailures';
import { stopCloudSync } from '../system/cloudSync';

/** Wipe local SQLite + re-seed defaults, and drop cached queries. */
export async function clearLocalUserData(queryClient: QueryClient) {
  stopCloudSync();
  await db.disconnectAndClear();
  await ensureSeeded(db);
  clearDiscardedUploads();
  queryClient.clear();
}
