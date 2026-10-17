import type { Severity } from './Severity';
import type { SyncStatus } from './SyncStatus';
import type { ReportLocation } from './ReportLocation';

/**
 * Local-only synchronization metadata.
 * Kept conceptually distinct from remote report payload.
 */
export interface SyncMetadata {
  syncStatus: SyncStatus;
  retryCount: number;
  lastSyncAttempt: number | null;
  syncError: string | null;
}

/**
 * Remote report representation synchronized with Firestore.
 * Document ID matches the client-generated UUID.
 */
export interface RemoteReport {
  id: string; // Client-generated UUID
  userId: string; // Anonymous user Firebase UID
  category: string; // WasteCategoryId
  severity: Severity;
  note: string | null;
  photoRemoteUrl: string | null;
  latitude: number;
  longitude: number;
  locationAccuracy: number | null;
  createdAt: number; // Unix timestamp in ms
  updatedAt: number; // Unix timestamp in ms
}

/**
 * CleanSpot Report domain model.
 * The primary entity used across the application UI, local SQLite database, and sync queue.
 */
export interface Report {
  // Core Identity
  id: string; // UUID (idempotency key & document ID)
  userId: string; // Anonymous authenticated user ID

  // Content
  category: string; // WasteCategory id
  severity: Severity;
  note?: string | null;

  // Evidence
  photoLocalUri: string; // Local device image file URI
  photoRemoteUrl?: string | null; // Remote Firebase Storage download URL

  // Location
  location: ReportLocation;
  latitude: number;
  longitude: number;
  locationAccuracy?: number | null;

  // Timestamps
  createdAt: number;
  updatedAt: number;

  // Origin & Ownership
  isOwn: boolean; // true if created by this device/user, false if downloaded community report

  // Synchronization Metadata
  syncStatus: SyncStatus;
  retryCount: number;
  lastSyncAttempt?: number | null;
  syncError?: string | null;
}

/**
 * Local data model prepared for map markers:
 * - report ID
 * - latitude
 * - longitude
 * - category
 * - severity
 * - createdAt
 * - photo reference if available
 * - owner/user ID
 * - isOwn distinction
 * 
 * Powered directly by local SQLite storage to guarantee offline map rendering.
 */
export interface MapMarkerReport {
  id: string;
  latitude: number;
  longitude: number;
  category: string;
  severity: Severity;
  createdAt: number;
  photoUrl: string | null;
  photoLocalUri: string | null;
  photoRemoteUrl: string | null;
  userId: string;
  isOwn: boolean;
  note: string | null;
}

/**
 * DTO for creating a new user report from the UI.
 */
export interface CreateReportInput {
  category: string;
  severity: Severity;
  photoLocalUri: string;
  location: ReportLocation;
  note?: string;
}
