import AsyncStorage from '@react-native-async-storage/async-storage';

export type SettingsChangeListener = (key: string, value: any) => void;

/**
 * Service managing user-configurable application preferences.
 * Persists settings locally via AsyncStorage so preferences survive app restarts.
 */
export class SettingsService {
  private static readonly KEY_SYNC_WIFI_ONLY = '@cleanspot_setting_wifi_only';
  private syncWifiOnlyCache: boolean | null = null;
  private listeners: Set<SettingsChangeListener> = new Set();

  /**
   * Retrieves the "Sync on Wi-Fi Only" preference.
   * Defaults to false (sync allowed on both cellular and Wi-Fi).
   */
  async getSyncWifiOnly(): Promise<boolean> {
    if (this.syncWifiOnlyCache !== null) {
      return this.syncWifiOnlyCache;
    }
    try {
      const val = await AsyncStorage.getItem(SettingsService.KEY_SYNC_WIFI_ONLY);
      this.syncWifiOnlyCache = val === 'true';
      return this.syncWifiOnlyCache;
    } catch (e) {
      console.warn('[SettingsService] Failed to read syncWifiOnly setting:', e);
      return false;
    }
  }

  /**
   * Updates and persists the "Sync on Wi-Fi Only" preference.
   */
  async setSyncWifiOnly(enabled: boolean): Promise<void> {
    this.syncWifiOnlyCache = enabled;
    try {
      await AsyncStorage.setItem(
        SettingsService.KEY_SYNC_WIFI_ONLY,
        enabled ? 'true' : 'false'
      );
      this.notify('syncWifiOnly', enabled);
    } catch (e) {
      console.warn('[SettingsService] Failed to persist syncWifiOnly setting:', e);
    }
  }

  /**
   * Subscribes to preference changes.
   */
  subscribe(listener: SettingsChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(key: string, value: any): void {
    this.listeners.forEach((l) => {
      try {
        l(key, value);
      } catch (err) {
        console.warn('[SettingsService] Error in settings listener:', err);
      }
    });
  }
}

export const settingsService = new SettingsService();
