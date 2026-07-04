import { invalidateQueries } from './queryBus';
import { cloudConfigured } from './supabase';

let schedulePushFn: (() => void) | null = null;
let refreshPendingFn: (() => Promise<number>) | null = null;

export function registerCloudPushHandlers(
  schedule: () => void,
  refresh: () => Promise<number>,
) {
  schedulePushFn = schedule;
  refreshPendingFn = refresh;
}

export function onLocalMutation() {
  invalidateQueries();
  if (!cloudConfigured) return;
  schedulePushFn?.();
  void refreshPendingFn?.();
}
