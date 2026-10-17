import { ref, getDownloadURL, FirebaseStorage } from "firebase/storage";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Firestore,
} from "firebase/firestore";
import * as FileSystem from "expo-file-system/legacy";
import {
  getFirebaseStorage,
  getFirebaseFirestore,
  firebaseConfig,
} from "./firebaseConfig";
import type { Report, RemoteReport } from "../../models";

export interface IRemoteReportRepository {
  uploadPhoto(reportId: string, localPhotoUri: string): Promise<string>;
  saveReport(report: Report, remotePhotoUrl: string): Promise<void>;
  getReport(reportId: string): Promise<RemoteReport | null>;
  fetchSharedReports(sinceTimestamp?: number, limitCount?: number): Promise<RemoteReport[]>;
}

/**
 * Repository isolating all Firebase Storage & Cloud Firestore interactions for reports.
 * Ensures:
 * - Direct network and Firebase SDK calls are encapsulated away from services and UI.
 * - Idempotency through client-side UUID document IDs and setDoc(..., { merge: true }).
 */
export class RemoteReportRepository implements IRemoteReportRepository {
  private storageInstance?: FirebaseStorage;
  private firestoreInstance?: Firestore;

  constructor(storage?: FirebaseStorage, firestore?: Firestore) {
    this.storageInstance = storage;
    this.firestoreInstance = firestore;
  }

  private getStorage(): FirebaseStorage {
    if (!this.storageInstance) {
      this.storageInstance = getFirebaseStorage();
    }
    return this.storageInstance;
  }

  private getFirestore(): Firestore {
    if (!this.firestoreInstance) {
      this.firestoreInstance = getFirebaseFirestore();
    }
    return this.firestoreInstance;
  }

  /**
   * Uploads the local evidence photo to Firebase Cloud Storage.
   * Path: reports/{reportId}/evidence.jpg
   * Returns the remote public/signed download URL.
   *
   * Uses FileSystem.uploadAsync (native streaming binary upload) directly to the Firebase
   * Storage REST endpoint. This bypasses React Native's JS Blob/ArrayBuffer polyfill bugs
   * and provides optimal native performance on both Android and iOS.
   */
  async uploadPhoto(reportId: string, localPhotoUri: string): Promise<string> {
    if (!localPhotoUri) {
      throw new Error("Local photo URI is required for upload.");
    }

    const storagePath = `reports/${reportId}/evidence.jpg`;
    const bucket = firebaseConfig.storageBucket;
    const baseUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o`;
    const uploadUrl = `${baseUrl}?uploadType=media&name=${encodeURIComponent(storagePath)}`;

    try {
      console.log(`[RemoteReportRepository] Uploading photo to Firebase Cloud: ${uploadUrl}`);
      const result = await FileSystem.uploadAsync(uploadUrl, localPhotoUri, {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          "Content-Type": "image/jpeg",
        },
      });

      if (result.status < 200 || result.status >= 300) {
        throw new Error(
          `Firebase Storage upload failed with status ${result.status}: ${result.body}`,
        );
      }

      // Try SDK getDownloadURL first, fallback to tokenized REST URL
      try {
        const storage = this.getStorage();
        const storageRef = ref(storage, storagePath);
        return await getDownloadURL(storageRef);
      } catch {
        const parsed =
          typeof result.body === "string"
            ? JSON.parse(result.body)
            : result.body;
        const token = parsed?.downloadTokens || "";
        return `${baseUrl}/${encodeURIComponent(storagePath)}?alt=media${token ? `&token=${token}` : ""}`;
      }
    } catch (error: any) {
      console.error(
        `[RemoteReportRepository] Failed to upload photo for report ${reportId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Persists report document to Firestore under collection 'reports'.
   * Uses report.id (UUID) as document ID to guarantee idempotency.
   */
  async saveReport(report: Report, remotePhotoUrl: string): Promise<void> {
    try {
      const firestore = this.getFirestore();
      const docRef = doc(firestore, "reports", report.id);

      const remotePayload: RemoteReport = {
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

      // Idempotent upsert
      await setDoc(docRef, remotePayload, { merge: true });
    } catch (error) {
      console.error(
        `[RemoteReportRepository] Failed to save Firestore document for ${report.id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Queries existing remote report document by UUID.
   */
  async getReport(reportId: string): Promise<RemoteReport | null> {
    try {
      const firestore = this.getFirestore();
      const docRef = doc(firestore, "reports", reportId);
      const snapshot = await getDoc(docRef);

      if (!snapshot.exists()) {
        return null;
      }

      return snapshot.data() as RemoteReport;
    } catch (error) {
      console.error(
        `[RemoteReportRepository] Failed to fetch remote report ${reportId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Fetches shared community waste reports from Firebase Cloud Firestore.
   * Supports incremental synchronization via sinceTimestamp (high-water mark).
   * Avoids querying all documents repeatedly.
   */
  async fetchSharedReports(
    sinceTimestamp: number = 0,
    limitCount: number = 50
  ): Promise<RemoteReport[]> {
    try {
      const firestore = this.getFirestore();
      const reportsCol = collection(firestore, "reports");

      let q;
      if (sinceTimestamp > 0) {
        // Incremental delta sync: only fetch documents updated since last sync cursor
        q = query(
          reportsCol,
          where("updatedAt", ">", sinceTimestamp),
          orderBy("updatedAt", "asc"),
          limit(limitCount)
        );
      } else {
        // Initial sync: fetch latest community reports
        q = query(
          reportsCol,
          orderBy("createdAt", "desc"),
          limit(limitCount)
        );
      }

      const snapshot = await getDocs(q);
      const remoteReports: RemoteReport[] = [];
      snapshot.forEach((docSnap) => {
        if (docSnap.exists()) {
          remoteReports.push(docSnap.data() as RemoteReport);
        }
      });

      return remoteReports;
    } catch (error) {
      console.warn(
        "[RemoteReportRepository] Error fetching shared reports from Firestore:",
        error,
      );
      return [];
    }
  }
}

export const remoteReportRepository = new RemoteReportRepository();
