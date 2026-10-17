import {
  ILocalReportRepository,
  localReportRepository,
} from '../data/local';
import {
  IRemoteReportRepository,
  remoteReportRepository,
} from '../data/remote';
import { networkService, NetworkService } from './NetworkService';
import { authService, AuthService } from './AuthService';
import { settingsService, SettingsService } from './SettingsService';
import { NetInfoStateType } from '@react-native-community/netinfo';
import type { Report, SyncStatus } from '../models';

export interface SyncSummary {
  total: number;
  synced: number;
  failed: number;
  skipped: number;
  downloaded: number;
  timestamp: number;
  message?: string;
}

export type SyncStateListener = (isSyncing: boolean) => void;

/**
 * Service orchestrating offline-first report synchronization.
 * 
 * Guarantees:
 * 1. Reads PENDING/FAILED reports from SQLite in FIFO creation order.
 * 2. Idempotent upload: document ID matches client-side UUID.
 * 3. Stepwise resumption: caches uploaded photoRemoteUrl in SQLite to prevent re-upload on Firestore retry.
 * 4. Exponential backoff (base 3s) for automatic retries up to 3 attempts.
 * 5. Marks reports FAILED after 3 attempts with actionable error logs; exposes manual retry.
 * 6. SQLite remains local source of truth; never deletes local reports upon synchronization.
 * 7. Automatically triggers synchronization when network connectivity restores.
 * 8. Two-way sync: uploads local reports AND downloads community reports from Firestore.
 * 9. Incremental delta sync: uses high-water mark timestamp cursor to avoid re-downloading unchanged records.
 * 10. Respects user's "Sync on Wi-Fi only" preference to save cellular data.
 */
export class SyncService {
  private static readonly MAX_RETRIES = 3;
  private static readonly BASE_BACKOFF_MS = 3000; // 3s, 6s, 12s
  private static readonly SYNC_CURSOR_KEY = 'last_shared_reports_sync_timestamp';

  private isSyncingInProgress = false;
  private listeners: Set<SyncStateListener> = new Set();
  private networkUnsubscribe?: () => void;

  constructor(
    private localRepo: ILocalReportRepository = localReportRepository,
    private remoteRepo: IRemoteReportRepository = remoteReportRepository,
    private network: NetworkService = networkService,
    private auth: AuthService = authService,
    private settings: SettingsService = settingsService
  ) {
    this.initAutoSync();
  }

  /**
   * Subscribes to network connectivity transitions to trigger sync on reconnect.
   * Debounces notifications to prevent multiple rapid NetInfo interface events from triggering duplicate runs.
   */
  private initAutoSync(): void {
    let wasOnline = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    this.networkUnsubscribe = this.network.subscribe((isOnline, state) => {
      if (!isOnline) {
        wasOnline = false;
        return;
      }

      // Only trigger if transitioning from offline to online (or first online detection)
      if (!wasOnline) {
        wasOnline = true;
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(async () => {
          // Verify Wi-Fi only restriction
          const wifiOnly = await this.settings.getSyncWifiOnly();
          if (wifiOnly && state.connectionType !== NetInfoStateType.wifi) {
            console.log(
              `[SyncService] Device connected via ${state.connectionType}, but 'Sync on Wi-Fi only' is enabled. Deferring background auto-sync.`
            );
            return;
          }

          console.log('[SyncService] Device is online. Initiating background sync...');
          this.syncPendingReports({ downloadShared: true }).catch((err) => {
            console.warn('[SyncService] Background sync error:', err);
          });
        }, 800);
      }
    });
  }

  /**
   * Destroys network listener if service is torn down.
   */
  destroy(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = undefined;
    }
    this.listeners.clear();
  }

  /**
   * Returns whether a synchronization cycle is actively executing.
   */
  isSyncing(): boolean {
    return this.isSyncingInProgress;
  }

  /**
   * Subscribes to sync state changes (start / finish).
   */
  subscribe(listener: SyncStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.isSyncingInProgress);
      } catch (err) {
        console.warn('[SyncService] Error in sync state listener:', err);
      }
    });
  }

  /**
   * Downloads and synchronizes shared community reports from Firebase Cloud Firestore
   * using an incremental delta synchronization strategy (high-water mark).
   * 
   * Avoids querying all documents repeatedly.
   * Preserves ownership distinction so community reports and user-created reports remain separated.
   */
  async downloadSharedReports(limitCount: number = 50): Promise<number> {
    const isOnline = await this.network.checkConnectivity();
    if (!isOnline) {
      return 0;
    }

    try {
      const storedCursor = await this.localRepo.getSyncMetadata(SyncService.SYNC_CURSOR_KEY);
      const sinceTimestamp = storedCursor ? parseInt(storedCursor, 10) : 0;
      const currentUserId = this.auth.getCurrentUserId();

      const remoteReports = await this.remoteRepo.fetchSharedReports(sinceTimestamp, limitCount);
      if (remoteReports.length === 0) {
        return 0;
      }

      let count = 0;
      let maxTimestamp = sinceTimestamp;

      for (const remote of remoteReports) {
        const isOwn = Boolean(currentUserId && remote.userId === currentUserId);
        const action = await this.localRepo.upsertRemoteReport(remote, isOwn);
        if (action === 'inserted' || action === 'updated') {
          count++;
        }
        if (remote.updatedAt && remote.updatedAt > maxTimestamp) {
          maxTimestamp = remote.updatedAt;
        }
      }

      // Update cursor for next incremental sync
      if (maxTimestamp > sinceTimestamp) {
        await this.localRepo.setSyncMetadata(SyncService.SYNC_CURSOR_KEY, maxTimestamp.toString());
      }

      if (count > 0) {
        console.log(`[SyncService] Incremental sync: cached ${count} shared report(s) into local SQLite.`);
      }
      return count;
    } catch (err) {
      console.warn('[SyncService] Failed to download shared reports:', err);
      return 0;
    }
  }

  /**
   * Synchronizes all queued reports (PENDING and eligible FAILED items) in FIFO order.
   * Also downloads shared community reports from Firebase Cloud.
   * 
   * Respects "Sync on Wi-Fi only" setting unless ignoreWifiOnly or force is true.
   */
  async syncPendingReports(options?: {
    force?: boolean;
    downloadShared?: boolean;
    ignoreWifiOnly?: boolean;
  }): Promise<SyncSummary> {
    if (this.isSyncingInProgress) {
      console.log('[SyncService] Sync already in progress. Skipping duplicate call.');
      return { total: 0, synced: 0, failed: 0, skipped: 0, downloaded: 0, timestamp: Date.now() };
    }

    // Check connectivity before starting
    const isOnline = await this.network.checkConnectivity();
    if (!isOnline && !options?.force) {
      console.log('[SyncService] Device is offline. Deferring sync.');
      return {
        total: 0,
        synced: 0,
        failed: 0,
        skipped: 0,
        downloaded: 0,
        timestamp: Date.now(),
        message: 'Device is offline. Reports stored locally in SQLite.',
      };
    }

    // Check Wi-Fi only restriction unless explicitly overridden (e.g. manual sync)
    if (!options?.ignoreWifiOnly && !options?.force) {
      const wifiOnly = await this.settings.getSyncWifiOnly();
      if (wifiOnly) {
        const netState = this.network.getNetworkState();
        if (netState.connectionType !== NetInfoStateType.wifi) {
          console.log(`[SyncService] 'Sync on Wi-Fi only' enabled. Skipping sync on connection '${netState.connectionType}'.`);
          return {
            total: 0,
            synced: 0,
            failed: 0,
            skipped: 0,
            downloaded: 0,
            timestamp: Date.now(),
            message: 'Sync postponed: "Sync on Wi-Fi only" is enabled and device is on cellular data.',
          };
        }
      }
    }

    try {
      this.isSyncingInProgress = true;
      this.notifyListeners();

      // Automatically reset any reports stuck in 'SYNCING' from an interrupted session back to 'PENDING'
      await this.localRepo.recoverInterruptedSyncs();

      const pendingReports = await this.localRepo.getPendingReports();
      console.log(`[SyncService] Found ${pendingReports.length} pending report(s) in queue.`);

      const summary: SyncSummary = {
        total: pendingReports.length,
        synced: 0,
        failed: 0,
        skipped: 0,
        downloaded: 0,
        timestamp: Date.now(),
      };

      for (const report of pendingReports) {
        const result = await this.syncSingleReport(report, options);
        if (result === 'SYNCED') {
          summary.synced++;
        } else if (result === 'FAILED') {
          summary.failed++;
        } else {
          summary.skipped++;
        }
      }

      // Download shared community reports (enabled by default on manual sync and reconnect)
      if (options?.downloadShared ?? true) {
        summary.downloaded = await this.downloadSharedReports();
      }

      return summary;
    } finally {
      this.isSyncingInProgress = false;
      this.notifyListeners();
    }
  }

  /**
   * Manually retries a specific report, bypassing backoff delays and resetting status to PENDING.
   */
  async retryReport(reportId: string): Promise<boolean> {
    const report = await this.localRepo.getReportById(reportId);
    if (!report) {
      console.warn(`[SyncService] Cannot retry report ${reportId}: not found in SQLite.`);
      return false;
    }

    // Reset status to PENDING and clear error for immediate retry
    await this.localRepo.updateSyncMetadata(reportId, {
      syncStatus: 'PENDING',
      syncError: null,
    });

    const refreshedReport = await this.localRepo.getReportById(reportId);
    if (!refreshedReport) return false;

    const result = await this.syncSingleReport(refreshedReport, { force: true });
    return result === 'SYNCED';
  }

  /**
   * Synchronizes an individual report.
   */
  async syncSingleReport(
    report: Report,
    options?: { force?: boolean }
  ): Promise<'SYNCED' | 'FAILED' | 'SKIPPED'> {
    // 1. Backoff and retry limit evaluation
    if (!options?.force) {
      // If max retries reached and status is FAILED, require explicit manual retry
      if (report.retryCount >= SyncService.MAX_RETRIES && report.syncStatus === 'FAILED') {
        return 'SKIPPED';
      }

      // Check exponential backoff window
      if (report.lastSyncAttempt) {
        const backoffMs =
          SyncService.BASE_BACKOFF_MS * Math.pow(2, Math.min(report.retryCount, 5));
        const elapsed = Date.now() - report.lastSyncAttempt;
        if (elapsed < backoffMs) {
          // Inside backoff window, skip for now
          return 'SKIPPED';
        }
      }
    }

    try {
      console.log(`[SyncService] Starting sync for report ${report.id} (${report.category}, retries: ${report.retryCount})...`);

      // 2. Mark local status as SYNCING
      await this.localRepo.updateSyncStatus(report.id, 'SYNCING');

      // 3. Step A: Upload photo to Firebase Storage (with stepwise resumption)
      let finalPhotoUrl = report.photoRemoteUrl;
      if (!finalPhotoUrl) {
        finalPhotoUrl = await this.remoteRepo.uploadPhoto(
          report.id,
          report.photoLocalUri
        );

        // Immediately persist remotePhotoUrl to SQLite so that if Firestore write fails,
        // subsequent retry does not re-upload the photo.
        await this.localRepo.updateSyncMetadata(report.id, {
          photoRemoteUrl: finalPhotoUrl,
        });
      }

      // 4. Step B: Create / update Firestore report document (idempotent with doc ID = UUID)
      await this.remoteRepo.saveReport(report, finalPhotoUrl);

      // 5. Step C: Mark report as SYNCED in local SQLite
      const now = Date.now();
      await this.localRepo.updateSyncMetadata(report.id, {
        syncStatus: 'SYNCED',
        lastSyncAttempt: now,
        syncError: null,
      });

      console.log(`[SyncService] Report ${report.id} successfully synchronized (SYNCED).`);
      return 'SYNCED';
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const newRetryCount = report.retryCount + 1;
      const nextStatus: SyncStatus =
        newRetryCount >= SyncService.MAX_RETRIES ? 'FAILED' : 'PENDING';

      console.warn(
        `[SyncService] Report ${report.id} sync failed (attempt ${newRetryCount}/${SyncService.MAX_RETRIES}). Next status: ${nextStatus}. Error:`,
        errorMessage
      );

      // 6. Update failure metadata without losing any local report data
      await this.localRepo.updateSyncMetadata(report.id, {
        syncStatus: nextStatus,
        retryCount: newRetryCount,
        lastSyncAttempt: Date.now(),
        syncError: errorMessage,
      });

      return nextStatus === 'FAILED' ? 'FAILED' : 'SKIPPED';
    }
  }
}

export const syncService = new SyncService();
