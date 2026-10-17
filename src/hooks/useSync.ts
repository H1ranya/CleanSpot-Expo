import { useState, useEffect, useCallback } from 'react';
import { syncService, SyncSummary } from '../services';

export function useSync() {
  const [isSyncing, setIsSyncing] = useState(syncService.isSyncing());
  const [lastSummary, setLastSummary] = useState<SyncSummary | null>(null);

  useEffect(() => {
    return syncService.subscribe((syncing) => {
      setIsSyncing(syncing);
    });
  }, []);

  const syncNow = useCallback(
    async (options?: { force?: boolean; downloadShared?: boolean }): Promise<SyncSummary> => {
      const summary = await syncService.syncPendingReports({
        force: true,
        downloadShared: true,
        ...options,
      });
      setLastSummary(summary);
      return summary;
    },
    []
  );

  const retryReport = useCallback(async (reportId: string): Promise<boolean> => {
    return await syncService.retryReport(reportId);
  }, []);

  const downloadShared = useCallback(async (limitCount?: number): Promise<number> => {
    return await syncService.downloadSharedReports(limitCount);
  }, []);

  return {
    isSyncing,
    lastSummary,
    syncNow,
    retryReport,
    downloadShared,
  };
}
