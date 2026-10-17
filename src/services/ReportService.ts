import {
  ILocalReportRepository,
  localReportRepository,
} from '../data/local';
import { authService, AuthService } from './AuthService';
import type {
  Report,
  MapMarkerReport,
  CreateReportInput,
  SyncStatus,
  Severity,
} from '../models';
import { generateUUID } from '../utils';

export class ReportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportValidationError';
  }
}

export class ReportService {
  constructor(
    private localRepo: ILocalReportRepository = localReportRepository,
    private auth: AuthService = authService
  ) {}

  /**
   * Validates required input fields before constructing and persisting a Report.
   */
  private validateReportInput(input: CreateReportInput): void {
    if (!input) {
      throw new ReportValidationError('Report input cannot be null or undefined.');
    }

    if (!input.photoLocalUri || typeof input.photoLocalUri !== 'string' || input.photoLocalUri.trim().length === 0) {
      throw new ReportValidationError('Photo evidence is required for every report.');
    }

    if (!input.category || typeof input.category !== 'string' || input.category.trim().length === 0) {
      throw new ReportValidationError('A valid waste category must be selected.');
    }

    const validSeverities: Severity[] = ['Low', 'Medium', 'High'];
    if (!input.severity || !validSeverities.includes(input.severity)) {
      throw new ReportValidationError(
        `Invalid severity level. Must be one of: ${validSeverities.join(', ')}.`
      );
    }

    if (!input.location) {
      throw new ReportValidationError('Location data is required for every report.');
    }

    const { latitude, longitude } = input.location;
    if (typeof latitude !== 'number' || isNaN(latitude) || latitude < -90 || latitude > 90) {
      throw new ReportValidationError('Invalid latitude coordinate.');
    }

    if (typeof longitude !== 'number' || isNaN(longitude) || longitude < -180 || longitude > 180) {
      throw new ReportValidationError('Invalid longitude coordinate.');
    }

    if (input.note && typeof input.note === 'string' && input.note.length > 2000) {
      throw new ReportValidationError('Note must not exceed 2,000 characters.');
    }
  }

  /**
   * Creates a new user report:
   * 1. Validates inputs
   * 2. Generates a client-side UUID (idempotency key)
   * 3. Constructs the Report model with syncStatus = PENDING, retryCount = 0, isOwn = true
   * 4. Persists the report to the local SQLite database
   * 5. Returns the created Report
   */
  async create(input: CreateReportInput): Promise<Report> {
    this.validateReportInput(input);

    const id = generateUUID();
    const userId = this.auth.getCurrentUserId() || 'anonymous_user';
    const now = Date.now();

    const report: Report = {
      id,
      userId,
      category: input.category.trim(),
      severity: input.severity,
      note: input.note ? input.note.trim() : null,
      photoLocalUri: input.photoLocalUri.trim(),
      photoRemoteUrl: null,
      location: {
        latitude: input.location.latitude,
        longitude: input.location.longitude,
        accuracy: input.location.accuracy ?? null,
        altitude: input.location.altitude ?? null,
        timestamp: input.location.timestamp ?? now,
        isManualPin: input.location.isManualPin ?? false,
      },
      latitude: input.location.latitude,
      longitude: input.location.longitude,
      locationAccuracy: input.location.accuracy ?? null,
      createdAt: now,
      updatedAt: now,
      isOwn: true,
      syncStatus: 'PENDING',
      retryCount: 0,
      lastSyncAttempt: null,
      syncError: null,
    };

    await this.localRepo.insertReport(report);
    return report;
  }

  /**
   * Retrieves all reports stored locally (newest first).
   * SQLite is the local source of truth for application UI.
   */
  async getReports(): Promise<Report[]> {
    return this.localRepo.getAllReports();
  }

  /**
   * Retrieves reports created specifically by this user on this device.
   */
  async getMyReports(): Promise<Report[]> {
    return this.localRepo.getMyReports();
  }

  /**
   * Retrieves shared community reports downloaded from Firebase Cloud.
   */
  async getSharedReports(): Promise<Report[]> {
    return this.localRepo.getSharedReports();
  }

  /**
   * Retrieves all map markers prepared for plotting on the shared map.
   * Completely served from local SQLite storage so the map works offline.
   */
  async getMapMarkers(): Promise<MapMarkerReport[]> {
    return this.localRepo.getMapMarkers();
  }

  /**
   * Retrieves a single report by its UUID.
   */
  async getReportById(id: string): Promise<Report | null> {
    if (!id || typeof id !== 'string') {
      return null;
    }
    return this.localRepo.getReportById(id);
  }

  /**
   * Retrieves all reports queued for synchronization (PENDING / FAILED) in FIFO order.
   */
  async getPendingReports(): Promise<Report[]> {
    return this.localRepo.getPendingReports();
  }

  /**
   * Deletes a local report by UUID.
   */
  async deleteReport(id: string): Promise<void> {
    if (!id || typeof id !== 'string') {
      return;
    }
    await this.localRepo.deleteReport(id);
  }

  /**
   * Returns counts of reports by their synchronization status.
   */
  async getSyncCounts(): Promise<Record<SyncStatus, number>> {
    return this.localRepo.getReportsCountByStatus();
  }

  /**
   * Returns reports grouped by category for statistics.
   */
  async getCategoryCounts(): Promise<Record<string, number>> {
    return this.localRepo.getCategoryCounts();
  }

  /**
   * Returns total count of synchronized reports stored in local SQLite database.
   */
  async getTotalSyncedReports(): Promise<number> {
    return this.localRepo.getTotalSyncedReports();
  }
}

export const reportService = new ReportService();
