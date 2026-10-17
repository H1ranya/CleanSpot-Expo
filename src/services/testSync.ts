import { localReportRepository } from '../data/local';
import { IRemoteReportRepository } from '../data/remote';
import { SyncService } from './SyncService';
import { NetworkService } from './NetworkService';
import type { Report, RemoteReport } from '../models';

/**
 * Automated test suite verifying SyncService guarantees:
 * 1. Offline report stays PENDING
 * 2. Successful synchronization becomes SYNCED
 * 3. Stepwise resumption (photo saved locally, not re-uploaded on Firestore retry)
 * 4. Duplicate synchronization is idempotent (document ID = UUID)
 * 5. Three automatic failures produce FAILED status
 * 6. Local data is never lost or deleted on sync failure
 */
export async function testSyncService(): Promise<{ success: boolean; message: string }> {
  console.log('[SyncService Test] Starting automated synchronization verification suite...');

  // Mock NetworkService (always online for tests)
  const mockNetwork = {
    isOnline: () => true,
    checkConnectivity: async () => true,
    subscribe: () => () => {},
    getNetworkState: () => ({ isConnected: true, isInternetReachable: true, isOnline: true, connectionType: 'wifi' }),
    destroy: () => {},
  } as unknown as NetworkService;

  // In-memory Firestore & Storage mocks
  const uploadedFiles: Record<string, string> = {};
  const firestoreDocs: Record<string, RemoteReport> = {};
  let uploadCallCount = 0;
  let saveReportCallCount = 0;
  let shouldFailFirestore = false;
  let shouldFailUpload = false;

  const mockRemoteRepo: IRemoteReportRepository = {
    async uploadPhoto(reportId: string, localPhotoUri: string): Promise<string> {
      uploadCallCount++;
      if (shouldFailUpload) {
        throw new Error('Simulated Storage network timeout');
      }
      const remoteUrl = `https://storage.googleapis.com/test-bucket/reports/${reportId}/evidence.jpg`;
      uploadedFiles[reportId] = remoteUrl;
      return remoteUrl;
    },

    async saveReport(report: Report, remotePhotoUrl: string): Promise<void> {
      saveReportCallCount++;
      if (shouldFailFirestore) {
        throw new Error('Simulated Firestore write failure');
      }
      firestoreDocs[report.id] = {
        id: report.id,
        userId: report.userId,
        category: report.category,
        severity: report.severity,
        note: report.note ?? null,
        photoRemoteUrl: remotePhotoUrl,
        latitude: report.latitude,
        longitude: report.longitude,
        locationAccuracy: report.locationAccuracy ?? null,
        createdAt: report.createdAt,
        updatedAt: Date.now(),
      };
    },

    async getReport(reportId: string): Promise<RemoteReport | null> {
      return firestoreDocs[reportId] || null;
    },

    async fetchSharedReports(): Promise<RemoteReport[]> {
      return Object.values(firestoreDocs);
    },
  };

  const testSyncServiceInstance = new SyncService(
    localReportRepository,
    mockRemoteRepo,
    mockNetwork
  );

  const testReportId = `test_sync_${Date.now()}`;
  const now = Date.now();

  const testReport: Report = {
    id: testReportId,
    userId: 'test_user_uid',
    category: 'plastic',
    severity: 'Medium',
    note: 'Automated test report for SyncService',
    photoLocalUri: 'file:///mock/storage/sync_evidence.jpg',
    photoRemoteUrl: null,
    latitude: 12.9716,
    longitude: 77.5946,
    locationAccuracy: 5.0,
    location: {
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 5.0,
      altitude: null,
      timestamp: now,
      isManualPin: false,
    },
    createdAt: now,
    updatedAt: now,
    isOwn: true,
    syncStatus: 'PENDING',
    retryCount: 0,
    lastSyncAttempt: null,
    syncError: null,
  };

  try {
    // 1. Insert report into local SQLite
    await localReportRepository.insertReport(testReport);
    const initialReport = await localReportRepository.getReportById(testReportId);
    if (initialReport?.syncStatus !== 'PENDING') {
      throw new Error(`Initial report status expected PENDING, got ${initialReport?.syncStatus}`);
    }
    console.log('[SyncService Test] 1. Offline report initial state is PENDING: PASS');

    // 2. Test Stepwise Resumption: Storage succeeds, Firestore fails
    shouldFailFirestore = true;
    shouldFailUpload = false;
    const failSummary1 = await testSyncServiceInstance.syncSingleReport(initialReport, { force: true });
    
    const afterFail1 = await localReportRepository.getReportById(testReportId);
    if (!afterFail1?.photoRemoteUrl) {
      throw new Error('Photo remote URL was not cached in SQLite after storage upload succeeded');
    }
    if (afterFail1.retryCount !== 1) {
      throw new Error(`Expected retryCount 1, got ${afterFail1.retryCount}`);
    }
    if (afterFail1.syncStatus !== 'PENDING') {
      throw new Error(`Expected status PENDING after first failure, got ${afterFail1.syncStatus}`);
    }
    console.log('[SyncService Test] 2. Storage uploaded & cached despite Firestore failure (retryCount=1): PASS');

    // 3. Test that retry reuses cached photoRemoteUrl without re-uploading
    shouldFailFirestore = false;
    const initialUploadCount = uploadCallCount;
    await testSyncServiceInstance.syncSingleReport(afterFail1, { force: true });

    if (uploadCallCount !== initialUploadCount) {
      throw new Error('Storage re-uploaded the photo instead of reusing the cached remotePhotoUrl!');
    }

    const syncedReport = await localReportRepository.getReportById(testReportId);
    if (syncedReport?.syncStatus !== 'SYNCED') {
      throw new Error(`Expected status SYNCED, got ${syncedReport?.syncStatus}`);
    }
    if (!firestoreDocs[testReportId]) {
      throw new Error('Firestore document was not created');
    }
    console.log('[SyncService Test] 3. Successful synchronization becomes SYNCED without photo re-upload: PASS');

    // 4. Test Idempotency: Synchronizing again should update rather than duplicate
    const initialDocCount = Object.keys(firestoreDocs).length;
    await testSyncServiceInstance.syncSingleReport(syncedReport, { force: true });
    const finalDocCount = Object.keys(firestoreDocs).length;
    if (initialDocCount !== finalDocCount) {
      throw new Error('Duplicate sync created multiple records in Firestore');
    }
    console.log('[SyncService Test] 4. Duplicate synchronization is strictly idempotent: PASS');

    // 5. Test Retry Limit (3 failures produce FAILED)
    const failReportId = `test_fail_${Date.now()}`;
    const failReport: Report = {
      ...testReport,
      id: failReportId,
      photoRemoteUrl: null,
      syncStatus: 'PENDING',
      retryCount: 0,
    };
    await localReportRepository.insertReport(failReport);

    shouldFailUpload = true; // Cause failures
    // Failure 1
    const r1 = await localReportRepository.getReportById(failReportId);
    await testSyncServiceInstance.syncSingleReport(r1!, { force: true });
    const reportFail1 = await localReportRepository.getReportById(failReportId);
    if (reportFail1?.retryCount !== 1 || reportFail1?.syncStatus !== 'PENDING') {
      throw new Error(`Attempt 1 expected retryCount=1, status=PENDING; got ${reportFail1?.retryCount}, ${reportFail1?.syncStatus}`);
    }

    // Failure 2
    await testSyncServiceInstance.syncSingleReport(reportFail1!, { force: true });
    const reportFail2 = await localReportRepository.getReportById(failReportId);
    if (reportFail2?.retryCount !== 2 || reportFail2?.syncStatus !== 'PENDING') {
      throw new Error(`Attempt 2 expected retryCount=2, status=PENDING; got ${reportFail2?.retryCount}, ${reportFail2?.syncStatus}`);
    }

    // Failure 3 -> should become FAILED
    await testSyncServiceInstance.syncSingleReport(reportFail2!, { force: true });
    const reportFail3 = await localReportRepository.getReportById(failReportId);
    if (reportFail3?.retryCount !== 3 || reportFail3?.syncStatus !== 'FAILED') {
      throw new Error(`Attempt 3 expected retryCount=3, status=FAILED; got ${reportFail3?.retryCount}, ${reportFail3?.syncStatus}`);
    }
    if (!reportFail3?.syncError) {
      throw new Error('syncError is empty on FAILED report');
    }
    console.log('[SyncService Test] 5. Three automatic failures produce FAILED with syncError: PASS');

    // 6. Test manual retry resets status to PENDING and succeeds when network recovers
    shouldFailUpload = false;
    const retrySuccess = await testSyncServiceInstance.retryReport(failReportId);
    if (!retrySuccess) {
      throw new Error('Manual retry failed to synchronize');
    }
    const recoveredReport = await localReportRepository.getReportById(failReportId);
    if (recoveredReport?.syncStatus !== 'SYNCED') {
      throw new Error(`Recovered report expected SYNCED, got ${recoveredReport?.syncStatus}`);
    }
    console.log('[SyncService Test] 6. Manual retry on FAILED report succeeds: PASS');

    // Clean up test reports
    await localReportRepository.deleteReport(testReportId);
    await localReportRepository.deleteReport(failReportId);

    console.log('[SyncService Test] ALL SYNCSERVICE TESTS PASSED SUCCESSFULLY! ✅');
    return {
      success: true,
      message: 'All SyncService offline-first synchronization tests passed.',
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[SyncService Test] FAILED ❌:', errorMsg);
    return {
      success: false,
      message: errorMsg,
    };
  } finally {
    testSyncServiceInstance.destroy();
  }
}
