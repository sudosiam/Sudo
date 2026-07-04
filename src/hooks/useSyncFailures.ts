import * as React from 'react';
import {
  clearDiscardedUploads,
  getDiscardedUploads,
  subscribeDiscardedUploads,
  type DiscardedUpload,
} from '../lib/syncFailures';

/** Live view of permanently-discarded upload operations (see syncFailures.ts). */
export function useSyncFailures() {
  const [items, setItems] = React.useState<DiscardedUpload[]>(() => getDiscardedUploads());

  React.useEffect(() => subscribeDiscardedUploads(setItems), []);

  return { items, clear: clearDiscardedUploads };
}
