import { localReportRepository } from "./LocalReportRepository";
import type { Report } from "../../models";

/**
 * Self-verification test for SQLite database creation, schema validation, and CRUD operations.
 */
export async function testLocalDatabase(): Promise<{
  success: boolean;
  message: string;
}> {
  const testId = `test_uuid_${Date.now()}`;
  console.log(`[SQLite Test] Starting CRUD verification for ID: ${testId}`);

  try {
    const testReport: Report = {
      id: testId,
      userId: "test_user_uid",
      category: "plastic",
      severity: "Medium",
      note: "Verification test for local SQLite persistence",
      photoLocalUri: "file:///mock/storage/test_evidence.jpg",
      photoRemoteUrl: null,
      latitude: 12.9716,
      longitude: 77.5946,
      locationAccuracy: 4.5,
      location: {
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 4.5,
        altitude: 920.0,
        isManualPin: false,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isOwn: true,
      syncStatus: "PENDING",
      retryCount: 0,
      lastSyncAttempt: null,
      syncError: null,
    };

    // 1. Test Insert
    await localReportRepository.insertReport(testReport);
    console.log("[SQLite Test] 1. Insert: SUCCESS");

    // 2. Test Get by ID
    const retrieved = await localReportRepository.getReportById(testId);
    if (!retrieved || retrieved.id !== testId) {
      throw new Error(
        `Retrieved report mismatch. Expected ${testId}, got ${retrieved?.id}`,
      );
    }
    if (retrieved.category !== "plastic" || retrieved.severity !== "Medium") {
      throw new Error("Retrieved fields do not match inserted values");
    }
    console.log("[SQLite Test] 2. GetById: SUCCESS");

    // 3. Test Update Sync Status
    await localReportRepository.updateSyncStatus(testId, "SYNCING");
    const syncingReport = await localReportRepository.getReportById(testId);
    if (syncingReport?.syncStatus !== "SYNCING") {
      throw new Error(
        `Expected status SYNCING, got ${syncingReport?.syncStatus}`,
      );
    }
    console.log("[SQLite Test] 3. UpdateSyncStatus: SUCCESS");

    // 4. Test Update Sync Metadata
    await localReportRepository.updateSyncMetadata(testId, {
      syncStatus: "SYNCED",
      retryCount: 1,
      lastSyncAttempt: Date.now(),
      photoRemoteUrl: "https://storage.googleapis.com/test_evidence.jpg",
    });
    const syncedReport = await localReportRepository.getReportById(testId);
    if (
      syncedReport?.syncStatus !== "SYNCED" ||
      syncedReport?.retryCount !== 1 ||
      !syncedReport?.photoRemoteUrl
    ) {
      throw new Error("UpdateSyncMetadata failed to update fields correctly");
    }
    console.log("[SQLite Test] 4. UpdateSyncMetadata: SUCCESS");

    // 5. Test Query All & Counts
    const allReports = await localReportRepository.getAllReports();
    const countByStatus = await localReportRepository.getReportsCountByStatus();
    if (allReports.length === 0 || (countByStatus.SYNCED ?? 0) < 1) {
      throw new Error("Query all reports or count by status failed");
    }
    console.log(
      `[SQLite Test] 5. QueryAll & Counts: SUCCESS (${allReports.length} total)`,
    );

    // 6. Test Delete
    await localReportRepository.deleteReport(testId);
    const deletedReport = await localReportRepository.getReportById(testId);
    if (deletedReport !== null) {
      throw new Error("Delete report failed, record still exists");
    }
    console.log("[SQLite Test] 6. Delete: SUCCESS");

    console.log("[SQLite Test] ALL SQLite CRUD TESTS PASSED ✅");
    return {
      success: true,
      message: "All SQLite operations passed successfully.",
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[SQLite Test] FAILED ❌:", errorMsg);
    return {
      success: false,
      message: errorMsg,
    };
  }
}
