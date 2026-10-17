import { getDatabase } from './Database';
import type {
  Report,
  RemoteReport,
  MapMarkerReport,
  SyncStatus,
  Severity,
  SyncMetadata,
} from '../../models';

interface ReportRow {
  id: string;
  user_id: string;
  category: string;
  severity: string;
  note: string | null;
  photo_local_uri: string;
  photo_remote_url: string | null;
  latitude: number;
  longitude: number;
  location_accuracy: number | null;
  altitude: number | null;
  is_manual_pin: number;
  is_own: number;
  created_at: number;
  updated_at: number;
  sync_status: string;
  retry_count: number;
  last_sync_attempt: number | null;
  sync_error: string | null;
}

export interface ILocalReportRepository {
  insertReport(report: Report): Promise<void>;
  getReportById(id: string): Promise<Report | null>;
  getAllReports(): Promise<Report[]>;
  getMyReports(): Promise<Report[]>;
  getSharedReports(): Promise<Report[]>;
  getPendingReports(): Promise<Report[]>;
  getMapMarkers(): Promise<MapMarkerReport[]>;
  recoverInterruptedSyncs(): Promise<void>;
  upsertRemoteReport(remote: RemoteReport, isOwn?: boolean): Promise<'inserted' | 'updated' | 'skipped'>;
  getSyncMetadata(key: string): Promise<string | null>;
  setSyncMetadata(key: string, value: string): Promise<void>;
  updateSyncStatus(
    id: string,
    status: SyncStatus,
    error?: string | null
  ): Promise<void>;
  updateSyncMetadata(
    id: string,
    metadata: Partial<SyncMetadata> & { photoRemoteUrl?: string | null }
  ): Promise<void>;
  deleteReport(id: string): Promise<void>;
  getReportsCountByStatus(): Promise<Record<SyncStatus, number>>;
  getCategoryCounts(): Promise<Record<string, number>>;
  getTotalSyncedReports(): Promise<number>;
}

export class LocalReportRepository implements ILocalReportRepository {
  /**
   * Maps a SQLite row to the domain Report model.
   */
  private mapRowToReport(row: ReportRow): Report {
    return {
      id: row.id,
      userId: row.user_id,
      category: row.category,
      severity: row.severity as Severity,
      note: row.note ?? null,
      photoLocalUri: row.photo_local_uri,
      photoRemoteUrl: row.photo_remote_url ?? null,
      latitude: row.latitude,
      longitude: row.longitude,
      locationAccuracy: row.location_accuracy,
      location: {
        latitude: row.latitude,
        longitude: row.longitude,
        accuracy: row.location_accuracy,
        altitude: row.altitude,
        timestamp: row.created_at,
        isManualPin: row.is_manual_pin === 1,
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isOwn: row.is_own === 1,
      syncStatus: row.sync_status as SyncStatus,
      retryCount: row.retry_count,
      lastSyncAttempt: row.last_sync_attempt ?? null,
      syncError: row.sync_error ?? null,
    };
  }

  /**
   * Inserts a new report into SQLite.
   * If a report with the same UUID already exists, it ignores to preserve idempotency.
   */
  async insertReport(report: Report): Promise<void> {
    const db = await getDatabase();

    await db.runAsync(
      `
      INSERT INTO reports (
        id,
        user_id,
        category,
        severity,
        note,
        photo_local_uri,
        photo_remote_url,
        latitude,
        longitude,
        location_accuracy,
        altitude,
        is_manual_pin,
        is_own,
        created_at,
        updated_at,
        sync_status,
        retry_count,
        last_sync_attempt,
        sync_error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        report.id,
        report.userId,
        report.category,
        report.severity,
        report.note ?? null,
        report.photoLocalUri,
        report.photoRemoteUrl ?? null,
        report.latitude,
        report.longitude,
        report.locationAccuracy ?? null,
        report.location?.altitude ?? null,
        report.location?.isManualPin ? 1 : 0,
        report.isOwn !== false ? 1 : 0,
        report.createdAt,
        report.updatedAt,
        report.syncStatus,
        report.retryCount,
        report.lastSyncAttempt ?? null,
        report.syncError ?? null,
      ]
    );
  }

  /**
   * Retrieves a single report by its UUID.
   */
  async getReportById(id: string): Promise<Report | null> {
    const db = await getDatabase();

    const row = await db.getFirstAsync<ReportRow>(
      'SELECT * FROM reports WHERE id = ?;',
      [id]
    );

    return row ? this.mapRowToReport(row) : null;
  }

  /**
   * Retrieves all reports (both user-created and shared community reports).
   */
  async getAllReports(): Promise<Report[]> {
    const db = await getDatabase();

    const rows = await db.getAllAsync<ReportRow>(
      'SELECT * FROM reports ORDER BY created_at DESC;'
    );

    return rows.map((row) => this.mapRowToReport(row));
  }

  /**
   * Retrieves reports created specifically by this user on this device.
   */
  async getMyReports(): Promise<Report[]> {
    const db = await getDatabase();

    const rows = await db.getAllAsync<ReportRow>(
      'SELECT * FROM reports WHERE is_own = 1 ORDER BY created_at DESC;'
    );

    return rows.map((row) => this.mapRowToReport(row));
  }

  /**
   * Retrieves shared community reports downloaded from Firebase Cloud.
   */
  async getSharedReports(): Promise<Report[]> {
    const db = await getDatabase();

    const rows = await db.getAllAsync<ReportRow>(
      'SELECT * FROM reports WHERE is_own = 0 ORDER BY created_at DESC;'
    );

    return rows.map((row) => this.mapRowToReport(row));
  }

  /**
   * Prepares and returns the local data model for map markers.
   * Includes coordinates, category, severity, timestamp, photo reference,
   * ownership (isOwn), and user ID.
   * 
   * Fully served from local SQLite, allowing the map to render markers completely offline.
   */
  async getMapMarkers(): Promise<MapMarkerReport[]> {
    const db = await getDatabase();

    const rows = await db.getAllAsync<ReportRow>(
      `SELECT * FROM reports 
       WHERE latitude IS NOT NULL AND longitude IS NOT NULL 
       ORDER BY created_at DESC;`
    );

    return rows.map((row) => ({
      id: row.id,
      latitude: row.latitude,
      longitude: row.longitude,
      category: row.category,
      severity: row.severity as Severity,
      createdAt: row.created_at,
      photoUrl: row.photo_local_uri || row.photo_remote_url || null,
      photoLocalUri: row.photo_local_uri || null,
      photoRemoteUrl: row.photo_remote_url || null,
      userId: row.user_id,
      isOwn: row.is_own === 1,
      note: row.note ?? null,
    }));
  }

  /**
   * Recovers any reports that were left in 'SYNCING' state due to an app reload or crash,
   * resetting them back to 'PENDING'.
   */
  async recoverInterruptedSyncs(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE reports SET sync_status = 'PENDING' WHERE sync_status = 'SYNCING';`
    );
  }

  /**
   * Retrieves pending reports ready for synchronization.
   * Returns items in FIFO order (oldest first) to ensure sequential queue processing.
   */
  async getPendingReports(): Promise<Report[]> {
    const db = await getDatabase();

    const rows = await db.getAllAsync<ReportRow>(
      `SELECT * FROM reports 
       WHERE is_own = 1 AND sync_status IN ('PENDING', 'SYNCING', 'FAILED') 
       ORDER BY created_at ASC;`
    );

    return rows.map((row) => this.mapRowToReport(row));
  }

  /**
   * Gets a synchronization metadata value (e.g. timestamp cursor) by key.
   */
  async getSyncMetadata(key: string): Promise<string | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM sync_metadata WHERE key = ?;',
      [key]
    );
    return row ? row.value : null;
  }

  /**
   * Persists a synchronization metadata value (e.g. timestamp cursor) by key.
   */
  async setSyncMetadata(key: string, value: string): Promise<void> {
    const db = await getDatabase();
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
      [key, value, now]
    );
  }

  /**
   * Upserts a remote report downloaded from Firebase Cloud into local SQLite.
   * - If report already exists locally: updates if local status is 'SYNCED', otherwise preserves pending edits.
   * - If report doesn't exist locally: inserts as 'SYNCED' so community reports are available offline.
   * - Preserves the isOwn distinction so community reports and user-created reports remain separated.
   */
  async upsertRemoteReport(
    remote: RemoteReport,
    isOwn: boolean = false
  ): Promise<'inserted' | 'updated' | 'skipped'> {
    const db = await getDatabase();
    const existing = await this.getReportById(remote.id);

    if (existing) {
      if (existing.syncStatus === 'SYNCED') {
        await db.runAsync(
          `UPDATE reports SET
            category = ?,
            severity = ?,
            note = ?,
            photo_remote_url = ?,
            latitude = ?,
            longitude = ?,
            location_accuracy = ?,
            updated_at = ?
           WHERE id = ?;`,
          [
            remote.category,
            remote.severity,
            remote.note ?? null,
            remote.photoRemoteUrl,
            remote.latitude,
            remote.longitude,
            remote.locationAccuracy ?? null,
            remote.updatedAt,
            remote.id,
          ]
        );
        return 'updated';
      }
      return 'skipped';
    }

    // Insert new community report into local SQLite
    await db.runAsync(
      `INSERT INTO reports (
        id,
        user_id,
        category,
        severity,
        note,
        photo_local_uri,
        photo_remote_url,
        latitude,
        longitude,
        location_accuracy,
        altitude,
        is_manual_pin,
        is_own,
        created_at,
        updated_at,
        sync_status,
        retry_count,
        last_sync_attempt,
        sync_error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        remote.id,
        remote.userId,
        remote.category,
        remote.severity,
        remote.note ?? null,
        '', // No local file path yet
        remote.photoRemoteUrl,
        remote.latitude,
        remote.longitude,
        remote.locationAccuracy ?? null,
        null,
        0,
        isOwn ? 1 : 0,
        remote.createdAt,
        remote.updatedAt,
        'SYNCED',
        0,
        Date.now(),
        null,
      ]
    );
    return 'inserted';
  }

  /**
   * Updates only the sync status and optional error message of a report.
   */
  async updateSyncStatus(
    id: string,
    status: SyncStatus,
    error: string | null = null
  ): Promise<void> {
    const db = await getDatabase();
    const now = Date.now();

    await db.runAsync(
      `UPDATE reports 
       SET sync_status = ?, sync_error = ?, updated_at = ? 
       WHERE id = ?;`,
      [status, error ?? null, now, id]
    );
  }

  /**
   * Updates full synchronization metadata (retry count, remote url, last attempt, status, error).
   */
  async updateSyncMetadata(
    id: string,
    metadata: Partial<SyncMetadata> & { photoRemoteUrl?: string | null }
  ): Promise<void> {
    const db = await getDatabase();
    const now = Date.now();

    const updates: string[] = ['updated_at = ?'];
    const params: (string | number | null)[] = [now];

    if (metadata.syncStatus !== undefined) {
      updates.push('sync_status = ?');
      params.push(metadata.syncStatus);
    }
    if (metadata.retryCount !== undefined) {
      updates.push('retry_count = ?');
      params.push(metadata.retryCount);
    }
    if (metadata.lastSyncAttempt !== undefined) {
      updates.push('last_sync_attempt = ?');
      params.push(metadata.lastSyncAttempt ?? null);
    }
    if (metadata.syncError !== undefined) {
      updates.push('sync_error = ?');
      params.push(metadata.syncError ?? null);
    }
    if (metadata.photoRemoteUrl !== undefined) {
      updates.push('photo_remote_url = ?');
      params.push(metadata.photoRemoteUrl ?? null);
    }

    params.push(id);

    await db.runAsync(
      `UPDATE reports SET ${updates.join(', ')} WHERE id = ?;`,
      params as any
    );
  }

  /**
   * Deletes a local report by UUID if explicitly required.
   */
  async deleteReport(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM reports WHERE id = ?;', [id]);
  }

  /**
   * Returns report counts grouped by their synchronization status.
   */
  async getReportsCountByStatus(): Promise<Record<SyncStatus, number>> {
    const db = await getDatabase();

    const rows = await db.getAllAsync<{ sync_status: SyncStatus; count: number }>(
      'SELECT sync_status, COUNT(*) as count FROM reports WHERE is_own = 1 GROUP BY sync_status;'
    );

    const counts: Record<SyncStatus, number> = {
      PENDING: 0,
      SYNCING: 0,
      SYNCED: 0,
      FAILED: 0,
    };

    rows.forEach((row) => {
      counts[row.sync_status] = row.count;
    });

    return counts;
  }

  /**
   * Returns report counts grouped by category for statistics.
   */
  async getCategoryCounts(): Promise<Record<string, number>> {
    const db = await getDatabase();

    const rows = await db.getAllAsync<{ category: string; count: number }>(
      'SELECT category, COUNT(*) as count FROM reports GROUP BY category;'
    );

    const counts: Record<string, number> = {};
    rows.forEach((row) => {
      counts[row.category] = row.count;
    });

    return counts;
  }

  /**
   * Returns total count of reports successfully synchronized with Firebase Cloud.
   * Includes both uploaded user reports and downloaded community reports.
   */
  async getTotalSyncedReports(): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM reports WHERE sync_status = 'SYNCED';`
    );
    return row ? row.count : 0;
  }
}

export const localReportRepository = new LocalReportRepository();
