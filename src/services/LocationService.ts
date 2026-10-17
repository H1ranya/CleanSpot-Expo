import * as Location from 'expo-location';
import type { ReportLocation } from '../models';

export type LocationAcquisitionStatus =
  | 'ACQUIRED_CURRENT'
  | 'ACQUIRED_LAST_KNOWN'
  | 'MANUAL_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'SERVICES_DISABLED'
  | 'ERROR';

export interface LocationResult {
  status: LocationAcquisitionStatus;
  location: ReportLocation | null;
  source?: 'current' | 'last_known' | 'manual';
  message: string;
}

/**
 * Service responsible for single-fix GPS acquisition for user reports.
 * 
 * Enforces:
 * 1. Single location fix per report (no continuous tracking or background watchers).
 * 2. Strict timeout on current GPS acquisition (default 7 seconds).
 * 3. Graceful fallback to recent last-known position if GPS acquisition times out.
 * 4. Fallback to manual selection state if no last-known location is available.
 * 5. Safe permission handling and device service verification.
 */
export class LocationService {
  private static readonly GPS_TIMEOUT_MS = 7000;
  private static readonly MAX_LAST_KNOWN_AGE_MS = 1000 * 60 * 30; // 30 minutes

  /**
   * Checks current foreground location permission without prompting.
   */
  async hasPermission(): Promise<boolean> {
    try {
      const response = await Location.getForegroundPermissionsAsync();
      return response.granted;
    } catch (error) {
      console.warn('[LocationService] Failed to check permissions:', error);
      return false;
    }
  }

  /**
   * Requests foreground location permission from the user.
   */
  async requestPermission(): Promise<boolean> {
    try {
      const response = await Location.requestForegroundPermissionsAsync();
      return response.granted;
    } catch (error) {
      console.error('[LocationService] Error requesting permissions:', error);
      return false;
    }
  }

  /**
   * Checks whether device location provider/services are toggled on.
   */
  async isLocationServicesEnabled(): Promise<boolean> {
    try {
      return await Location.hasServicesEnabledAsync();
    } catch (error) {
      console.warn('[LocationService] Failed to check location services status:', error);
      return false;
    }
  }

  /**
   * Acquires a single location fix for a report.
   * Execution pipeline:
   * 1. Check & request permission.
   * 2. Verify device location services are enabled.
   * 3. Attempt current GPS fix with a strict timeout.
   * 4. If current GPS times out or fails, attempt last-known position.
   * 5. If no last-known position is available, return MANUAL_REQUIRED state.
   */
  async acquireLocationForReport(options?: {
    timeoutMs?: number;
    maxLastKnownAgeMs?: number;
  }): Promise<LocationResult> {
    const timeoutMs = options?.timeoutMs ?? LocationService.GPS_TIMEOUT_MS;
    const maxAgeMs = options?.maxLastKnownAgeMs ?? LocationService.MAX_LAST_KNOWN_AGE_MS;

    // 1. Permission check & request
    let granted = await this.hasPermission();
    if (!granted) {
      granted = await this.requestPermission();
    }

    if (!granted) {
      return {
        status: 'PERMISSION_DENIED',
        location: null,
        message: 'Location permission was denied. Please enable location access or select a location manually.',
      };
    }

    // 2. Check if location services are enabled on the device
    const servicesEnabled = await this.isLocationServicesEnabled();
    if (!servicesEnabled) {
      // Fallback check to last known location in case GPS hardware was just switched off
      const fallbackLastKnown = await this.tryGetLastKnownLocation(maxAgeMs);
      if (fallbackLastKnown) {
        return {
          status: 'ACQUIRED_LAST_KNOWN',
          location: fallbackLastKnown,
          source: 'last_known',
          message: 'Device location services are off. Used recent last-known location.',
        };
      }

      return {
        status: 'SERVICES_DISABLED',
        location: null,
        message: 'Device location services are disabled. Please turn on GPS or select location manually.',
      };
    }

    // 3. Attempt single-fix current GPS location with timeout
    try {
      const currentPos = await this.getCurrentPositionWithTimeout(timeoutMs);

      const location: ReportLocation = {
        latitude: currentPos.coords.latitude,
        longitude: currentPos.coords.longitude,
        accuracy: currentPos.coords.accuracy ?? null,
        altitude: currentPos.coords.altitude ?? null,
        timestamp: currentPos.timestamp,
        isManualPin: false,
      };

      return {
        status: 'ACQUIRED_CURRENT',
        location,
        source: 'current',
        message: 'Current GPS location acquired successfully.',
      };
    } catch (gpsError) {
      console.warn(
        `[LocationService] Current GPS acquisition failed or timed out after ${timeoutMs}ms. Attempting last-known position fallback:`,
        gpsError
      );

      // 4. Fallback to last-known position
      const lastKnown = await this.tryGetLastKnownLocation(maxAgeMs);
      if (lastKnown) {
        return {
          status: 'ACQUIRED_LAST_KNOWN',
          location: lastKnown,
          source: 'last_known',
          message: 'GPS acquisition timed out. Used recent last-known location.',
        };
      }

      // 5. If no usable last-known location exists, signal manual selection required
      return {
        status: 'MANUAL_REQUIRED',
        location: null,
        message: 'Could not acquire GPS position. Please select the report location manually on the map.',
      };
    }
  }

  /**
   * Internal helper to fetch current position bounded by a strict timeout Promise.
   */
  private async getCurrentPositionWithTimeout(
    timeoutMs: number
  ): Promise<Location.LocationObject> {
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => {
        reject(new Error(`GPS acquisition timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const locationPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    try {
      return await Promise.race([locationPromise, timeoutPromise]);
    } finally {
      if (timerId !== null) {
        clearTimeout(timerId);
      }
    }
  }

  /**
   * Internal helper to query last-known position and validate against maxAge.
   */
  private async tryGetLastKnownLocation(
    maxAgeMs: number
  ): Promise<ReportLocation | null> {
    try {
      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: maxAgeMs,
      });

      if (!lastKnown) {
        return null;
      }

      // Ensure position is within acceptable age threshold
      const ageMs = Date.now() - lastKnown.timestamp;
      if (ageMs > maxAgeMs) {
        console.warn(`[LocationService] Last-known position is too old (${Math.round(ageMs / 1000)}s old).`);
        return null;
      }

      return {
        latitude: lastKnown.coords.latitude,
        longitude: lastKnown.coords.longitude,
        accuracy: lastKnown.coords.accuracy ?? null,
        altitude: lastKnown.coords.altitude ?? null,
        timestamp: lastKnown.timestamp,
        isManualPin: false,
      };
    } catch (error) {
      console.warn('[LocationService] Failed to get last-known position:', error);
      return null;
    }
  }

  /**
   * Creates a manual location object when the user picks coordinates on a map.
   */
  createManualLocation(coords: {
    latitude: number;
    longitude: number;
  }): ReportLocation {
    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: null,
      altitude: null,
      timestamp: Date.now(),
      isManualPin: true,
    };
  }
}

export const locationService = new LocationService();
