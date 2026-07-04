import * as React from 'react';
import { subscribeCloudSyncStatus, type CloudSyncStatus, getCloudSyncStatus } from '../system/cloudSync';

export function useCloudSync() {
  const [syncStatus, setSyncStatus] = React.useState<CloudSyncStatus>(() => getCloudSyncStatus());

  React.useEffect(() => subscribeCloudSyncStatus(setSyncStatus), []);

  return syncStatus;
}
