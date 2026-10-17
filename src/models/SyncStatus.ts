export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

export const MAX_SYNC_RETRY_COUNT = 3;

export interface SyncStatusMetadata {
  status: SyncStatus;
  label: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
  iconName: string;
}

export const SYNC_STATUS_CONFIG: Record<SyncStatus, SyncStatusMetadata> = {
  PENDING: {
    status: 'PENDING',
    label: 'Pending Sync',
    color: '#D97706',
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    iconName: 'time-outline',
  },
  SYNCING: {
    status: 'SYNCING',
    label: 'Syncing...',
    color: '#0284C7',
    backgroundColor: '#E0F2FE',
    borderColor: '#BAE6FD',
    iconName: 'sync-outline',
  },
  SYNCED: {
    status: 'SYNCED',
    label: 'Synced',
    color: '#16A34A',
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
    iconName: 'checkmark-circle-outline',
  },
  FAILED: {
    status: 'FAILED',
    label: 'Sync Failed',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
    iconName: 'alert-circle-outline',
  },
};

export function getSyncStatusMetadata(status: SyncStatus): SyncStatusMetadata {
  return SYNC_STATUS_CONFIG[status] || SYNC_STATUS_CONFIG.PENDING;
}
