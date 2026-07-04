/**
 * Tracks upload operations that PowerSync's connector permanently discarded
 * (schema mismatch, constraint violation, permission denied, etc). These are
 * silent from PowerSync's point of view — the queue looks "clean" — but the
 * change never reached the cloud, so we keep a small durable log and surface
 * it in the UI instead of only logging to the console.
 */

import { useToast } from '../stores/toast';
import { SEED_ACCOUNT_IDS } from '../domain/accounts';

export interface DiscardedUpload {
  id: string;
  table: string;
  op: string;
  message: string;
  at: string;
}

const STORAGE_KEY = 'sudo:discarded-uploads';
const MAX_ITEMS = 50;

type Listener = (items: DiscardedUpload[]) => void;
const listeners = new Set<Listener>();

function load(): DiscardedUpload[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(items: DiscardedUpload[]) {
  const trimmed = items.slice(-MAX_ITEMS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage unavailable (private mode / quota) — in-memory notify still works.
  }
  listeners.forEach((l) => l(trimmed));
}

export function recordDiscardedUpload(entry: Omit<DiscardedUpload, 'at'>) {
  save([...load(), { ...entry, at: new Date().toISOString() }]);
  useToast
    .getState()
    .push(
      `A change could not sync to the cloud (${entry.table}). Open Settings → Cloud sync for details.`,
      'error',
    );
}

export function getDiscardedUploads(): DiscardedUpload[] {
  return load();
}

export function clearDiscardedUploads() {
  save([]);
}

/** Built-in chart rows that we no longer upload — safe to drop once the queue is clear. */
export function isObsoleteSeedAccountSyncError(entry: DiscardedUpload): boolean {
  if (entry.table !== 'accounts' || !String(entry.op).includes('PUT')) return false;
  if (SEED_ACCOUNT_IDS.has(entry.id)) return true;
  return entry.message.includes('row-level security policy');
}

/** Remove stale seed-account RLS log entries when nothing is left to upload. */
export function clearObsoleteSyncErrorsIfQueueEmpty(queueCount: number): boolean {
  if (queueCount > 0) return false;
  const items = load();
  if (items.length === 0) return false;
  if (!items.every(isObsoleteSeedAccountSyncError)) return false;
  clearDiscardedUploads();
  return true;
}

export function subscribeDiscardedUploads(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
