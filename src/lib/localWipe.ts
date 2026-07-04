import { QueryClient } from '@tanstack/react-query';
import { db } from '../system/db';
import { ensureSeeded } from '../domain/seed';
import { clearDiscardedUploads } from './syncFailures';
import { disconnectSync } from '../system/syncLifecycle';

/** Wipe local SQLite + upload queue, re-seed defaults, and drop cached queries. */
export async function clearLocalUserData(queryClient: QueryClient) {
  await disconnectSync();
  await db.disconnectAndClear();
  await ensureSeeded(db);
  clearDiscardedUploads();
  queryClient.clear();
}
