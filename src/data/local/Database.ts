import * as SQLite from "expo-sqlite";

export const DATABASE_NAME = "cleanspot.db";

let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let isInitialized = false;

/**
 * Initializes and executes schema migrations for the CleanSpot SQLite database.
 * Uses WAL (Write-Ahead Logging) mode and creates indexes for synchronization queries.
 * Employs a mutex promise to prevent concurrent openDatabaseAsync race conditions on Android.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance && isInitialized) {
    try {
      await dbInstance.execAsync("PRAGMA user_version;");
      return dbInstance;
    } catch {
      dbInstance = null;
      isInitialized = false;
    }
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = (async () => {
    try {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS reports (
          id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT NOT NULL,
          category TEXT NOT NULL,
          severity TEXT NOT NULL,
          note TEXT,
          photo_local_uri TEXT NOT NULL,
          photo_remote_url TEXT,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          location_accuracy REAL,
          altitude REAL,
          is_manual_pin INTEGER NOT NULL DEFAULT 0,
          is_own INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'PENDING',
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_sync_attempt INTEGER,
          sync_error TEXT
        );

        -- Key-value metadata table for incremental delta sync timestamps
        CREATE TABLE IF NOT EXISTS sync_metadata (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);

      // Safe schema migration for pre-existing tables before index creation
      const tableInfo = await db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(reports);",
      );
      const columnNames = tableInfo.map((col) => col.name);

      if (tableInfo.length > 0) {
        if (!columnNames.includes("is_own")) {
          await db.execAsync(
            "ALTER TABLE reports ADD COLUMN is_own INTEGER NOT NULL DEFAULT 1;",
          );
        }
        if (!columnNames.includes("is_manual_pin")) {
          await db.execAsync(
            "ALTER TABLE reports ADD COLUMN is_manual_pin INTEGER NOT NULL DEFAULT 0;",
          );
        }
      }

      // Now create all indexes safely (columns guaranteed to exist)
      await db.execAsync(`
        -- Index for fast FIFO sync queue processing
        CREATE INDEX IF NOT EXISTS idx_reports_sync_queue ON reports(sync_status, created_at ASC);

        -- Index for distinguishing own vs shared community reports
        CREATE INDEX IF NOT EXISTS idx_reports_is_own ON reports(is_own, created_at DESC);

        -- Index for map coordinate queries
        CREATE INDEX IF NOT EXISTS idx_reports_map ON reports(latitude, longitude);

        -- Index for general chronological listings
        CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

        -- Index for category-based metrics & filtering
        CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);
      `);

      dbInstance = db;
      isInitialized = true;
      return db;
    } finally {
      dbPromise = null;
    }
  })();

  return dbPromise;
}

/**
 * Reset database instance (useful for unit/integration testing).
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
    isInitialized = false;
  }
}
