import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { generateUUID } from '../utils';

export interface ProcessedPhotoResult {
  uri: string;
  width: number;
  height: number;
  sizeBytes?: number;
}

export class ImageServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageServiceError';
  }
}

/**
 * Service responsible for offline image processing and persistent local storage.
 * Enforces:
 * - Resizing to ~1024px
 * - JPEG compression to 65% (60–70% target)
 * - Persistent offline storage in document directory
 * - Camera-only workflow (no gallery integration)
 */
export class ImageService {
  private static readonly TARGET_WIDTH = 1024;
  private static readonly JPEG_COMPRESSION = 0.65;
  private static readonly STORAGE_DIR_NAME = 'reports';

  /**
   * Returns the permanent local storage directory for report photos.
   */
  private getStorageDirectory(): string {
    const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
    if (!baseDir) {
      throw new ImageServiceError('Local storage directory is unavailable.');
    }
    return `${baseDir}${ImageService.STORAGE_DIR_NAME}/`;
  }

  /**
   * Ensures the reports directory exists on the local device.
   */
  async ensureDirectoryExists(): Promise<string> {
    const dir = this.getStorageDirectory();
    try {
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
      return dir;
    } catch (error) {
      console.error('[ImageService] Failed to create storage directory:', error);
      throw new ImageServiceError('Failed to initialize local photo storage directory.');
    }
  }

  /**
   * Takes a raw photo URI captured by Expo Camera, resizes to ~1024px,
   * compresses to 65% JPEG, copies it to the permanent document directory,
   * and returns the final offline file URI suitable for SQLite persistence.
   */
  async processAndStorePhoto(sourceUri: string): Promise<ProcessedPhotoResult> {
    if (!sourceUri || typeof sourceUri !== 'string') {
      throw new ImageServiceError('A valid image source URI must be provided.');
    }

    try {
      // 1. Process image: resize to 1024px width and compress to 65% JPEG
      const manipulated = await manipulateAsync(
        sourceUri,
        [{ resize: { width: ImageService.TARGET_WIDTH } }],
        {
          compress: ImageService.JPEG_COMPRESSION,
          format: SaveFormat.JPEG,
        }
      );

      // 2. Ensure permanent directory exists
      const targetDir = await this.ensureDirectoryExists();

      // 3. Move/copy to a unique permanent filename
      const filename = `evidence_${Date.now()}_${generateUUID().substring(0, 8)}.jpg`;
      const permanentUri = `${targetDir}${filename}`;

      await FileSystem.copyAsync({
        from: manipulated.uri,
        to: permanentUri,
      });

      // 4. Determine file size
      let sizeBytes: number | undefined;
      try {
        const fileInfo = await FileSystem.getInfoAsync(permanentUri);
        if (fileInfo.exists && !fileInfo.isDirectory) {
          sizeBytes = fileInfo.size;
        }
      } catch {
        // Non-critical, ignore size measurement error
      }

      // 5. Clean up temporary cache file if distinct from permanentUri
      try {
        if (manipulated.uri !== permanentUri) {
          await FileSystem.deleteAsync(manipulated.uri, { idempotent: true });
        }
      } catch {
        // Non-fatal cache cleanup
      }

      return {
        uri: permanentUri,
        width: manipulated.width,
        height: manipulated.height,
        sizeBytes,
      };
    } catch (error) {
      console.error('[ImageService] Error processing photo:', error);
      throw new ImageServiceError(
        `Image optimization failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Deletes a stored local photo (e.g. if the user cancels or retakes a report photo).
   */
  async deleteLocalPhoto(uri: string): Promise<void> {
    if (!uri) return;
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch (error) {
      console.warn('[ImageService] Failed to delete local photo:', error);
    }
  }
}

export const imageService = new ImageService();
