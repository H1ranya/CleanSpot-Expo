import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackScreenProps } from '../navigation/types';
import { useAuth } from '../hooks/useAuth';
import {
  settingsService,
  syncService,
  networkService,
  reportService,
} from '../services';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';

export function SettingsScreen({}: RootStackScreenProps<'Settings'>) {
  const { userId, isAuthenticated, isLoading: authLoading, isConfigured } = useAuth();

  // Settings states
  const [wifiOnly, setWifiOnly] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(syncService.isSyncing());
  const [isOnline, setIsOnline] = useState<boolean>(networkService.isOnline());
  const [connectionType, setConnectionType] = useState<string>(
    networkService.getNetworkState().connectionType
  );
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [totalReports, setTotalReports] = useState<number>(0);
  const [isPerformingManualSync, setIsPerformingManualSync] = useState<boolean>(false);

  // Load current preferences and stats
  const loadPreferencesAndData = useCallback(async () => {
    try {
      const isWifiPref = await settingsService.getSyncWifiOnly();
      setWifiOnly(isWifiPref);

      const pending = await reportService.getPendingReports();
      setPendingCount(pending.length);

      const all = await reportService.getMyReports();
      setTotalReports(all.length);
    } catch (err) {
      console.warn('[SettingsScreen] Failed to load settings data:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPreferencesAndData();
    }, [loadPreferencesAndData])
  );

  // Network & Sync listeners
  useEffect(() => {
    const unsubNet = networkService.subscribe((online, state) => {
      setIsOnline(online);
      setConnectionType(state.connectionType);
    });

    const unsubSync = syncService.subscribe((syncing) => {
      setIsSyncing(syncing);
      if (!syncing) {
        loadPreferencesAndData();
      }
    });

    return () => {
      unsubNet();
      unsubSync();
    };
  }, [loadPreferencesAndData]);

  // Handle Wi-Fi Only toggle
  const handleToggleWifiOnly = async (val: boolean) => {
    setWifiOnly(val);
    await settingsService.setSyncWifiOnly(val);
  };

  // Perform manual sync with informative feedback
  const executeSync = async () => {
    try {
      setIsPerformingManualSync(true);
      const summary = await syncService.syncPendingReports({
        force: true,
        downloadShared: true,
        ignoreWifiOnly: true,
      });

      let message = 'Synchronization complete.';
      if (summary.total > 0 || summary.downloaded > 0) {
        message = `Uploaded ${summary.synced} report(s). Downloaded ${summary.downloaded} shared community report(s).`;
      } else {
        message = 'Everything is up to date with Firebase Cloud.';
      }

      Alert.alert('Sync Finished', message);
    } catch (err) {
      Alert.alert(
        'Sync Error',
        err instanceof Error ? err.message : 'Failed to synchronize with cloud.'
      );
    } finally {
      setIsPerformingManualSync(false);
      loadPreferencesAndData();
    }
  };

  const handleManualSyncPress = () => {
    if (!isOnline) {
      Alert.alert(
        'Device Offline',
        'Cannot synchronize while offline. Your reports are safely queued in local SQLite and will sync once internet connectivity is restored.'
      );
      return;
    }

    // If Wi-Fi only is active and user is on cellular, ask for confirmation
    if (wifiOnly && connectionType === 'cellular') {
      Alert.alert(
        'Cellular Data Connection',
        '"Sync on Wi-Fi Only" is enabled to save data. Would you like to proceed with synchronization on cellular data now?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sync Anyway', onPress: executeSync },
        ]
      );
      return;
    }

    executeSync();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. SYNCHRONIZATION SETTINGS */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Synchronization</Text>
        <Text style={styles.sectionSubtitle}>Data transfer & queue behavior</Text>
      </View>

      <View style={styles.card}>
        {/* Toggle: Sync on Wi-Fi Only */}
        <View style={styles.settingRow}>
          <View style={styles.settingIconBox}>
            <Ionicons name="wifi" size={20} color={colors.forest700} />
          </View>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingTitle}>Sync on Wi-Fi Only</Text>
            <Text style={styles.settingSubtitle}>
              Restrict background synchronization to Wi-Fi networks to conserve cellular
              data.
            </Text>
          </View>
          <Switch
            value={wifiOnly}
            onValueChange={handleToggleWifiOnly}
            trackColor={{ false: colors.slate300, true: colors.forest500 }}
            thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
          />
        </View>

        {/* Current Network & Status */}
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Current Network</Text>
          <View style={styles.networkBadge}>
            <Ionicons
              name={
                !isOnline
                  ? 'cloud-offline'
                  : connectionType === 'wifi'
                    ? 'wifi'
                    : 'cellular'
              }
              size={14}
              color={!isOnline ? colors.amber700 : colors.forest700}
            />
            <Text
              style={[styles.networkBadgeText, !isOnline && { color: colors.amber700 }]}
            >
              {!isOnline
                ? 'Offline'
                : connectionType === 'wifi'
                  ? 'Wi-Fi Network'
                  : 'Cellular Data'}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Queued for Upload</Text>
          <Text
            style={[
              styles.infoValue,
              pendingCount > 0 && { color: colors.amber700, fontWeight: '800' },
            ]}
          >
            {pendingCount} pending report{pendingCount === 1 ? '' : 's'}
          </Text>
        </View>

        {/* Manual Sync Button */}
        <TouchableOpacity
          style={[
            styles.syncNowButton,
            (isSyncing || isPerformingManualSync) && styles.syncNowButtonDisabled,
          ]}
          activeOpacity={0.85}
          onPress={handleManualSyncPress}
          disabled={isSyncing || isPerformingManualSync}
        >
          {isSyncing || isPerformingManualSync ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.syncNowButtonText}>Synchronizing with Cloud...</Text>
            </>
          ) : (
            <>
              <Ionicons name="sync" size={18} color="#FFFFFF" />
              <Text style={styles.syncNowButtonText}>Sync Now</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* 2. USER IDENTITY & AUTHENTICATION */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>User Identity</Text>
        <Text style={styles.sectionSubtitle}>Anonymous authentication</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconCircleForest}>
            <Ionicons name="shield-checkmark" size={22} color={colors.forest700} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.cardTitle}>Anonymous Authentication</Text>
            <Text style={styles.cardSubtitle}>Zero personal details</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Auth State</Text>
          <View style={styles.statusBadge}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: isAuthenticated
                    ? colors.forest500
                    : isConfigured
                      ? colors.amber600
                      : colors.slate400,
                },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                {
                  color: isAuthenticated
                    ? colors.forest700
                    : isConfigured
                      ? colors.amber700
                      : colors.slate600,
                },
              ]}
            >
              {authLoading
                ? 'Initializing...'
                : isAuthenticated
                  ? 'Connected (Anonymous)'
                  : isConfigured
                    ? 'Offline Cached'
                    : 'Pending Configuration'}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>User UID</Text>
          <Text style={styles.uidText} numberOfLines={1} ellipsizeMode="middle">
            {userId || (isConfigured ? 'Generating...' : 'Local anonymous key')}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Local Database</Text>
          <Text style={styles.infoValue}>
            SQLite ({totalReports} report{totalReports === 1 ? '' : 's'} stored)
          </Text>
        </View>
      </View>

      {/* 3. APPLICATION INFORMATION */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Application Information</Text>
        <Text style={styles.sectionSubtitle}>Specifications & system stack</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Application</Text>
          <Text style={styles.infoValue}>CleanSpot Mobile</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Release Version</Text>
          <Text style={styles.infoValue}>1.0.0 (Expo SDK 57)</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Local Source of Truth</Text>
          <Text style={styles.infoValue}>SQLite (Offline-First)</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Map Platform</Text>
          <Text style={styles.infoValue}>OpenStreetMap & Leaflet (Free)</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Cloud Storage & DB</Text>
          <Text style={styles.infoValue}>Firebase Cloud Firestore & Storage</Text>
        </View>
      </View>

      {/* Informational Guidance Notice */}
      <View style={styles.noticeCard}>
        <Ionicons
          name="information-circle-outline"
          size={20}
          color={colors.forest700}
        />
        <Text style={styles.noticeText}>
          CleanSpot stores all reports locally in SQLite first. When online, two-way
          synchronization uploads your pending reports and downloads shared reports from
          the community.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md + 2,
    paddingBottom: spacing.xxl,
  },
  sectionHeader: {
    marginBottom: spacing.xs + 2,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.slate900,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.md + 2,
    borderWidth: 1,
    borderColor: colors.slate200,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.forest50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate900,
  },
  settingSubtitle: {
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.slate500,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.slate100,
    marginVertical: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 4,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.slate600,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    color: colors.slate900,
    fontWeight: '600',
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.forest50,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.round,
  },
  networkBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.forest800,
  },
  syncNowButton: {
    marginTop: spacing.md,
    backgroundColor: colors.forest700,
    height: 48,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    ...shadows.card,
  },
  syncNowButtonDisabled: {
    opacity: 0.7,
  },
  syncNowButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: 12,
  },
  iconCircleForest: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.forest50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.slate900,
  },
  cardSubtitle: {
    fontSize: 11.5,
    color: colors.slate500,
    marginTop: 1,
  },
  uidText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.forest800,
    fontWeight: '700',
    maxWidth: '55%',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  noticeCard: {
    flexDirection: 'row',
    backgroundColor: colors.forest50,
    borderWidth: 1,
    borderColor: 'rgba(187, 247, 208, 0.8)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: 10,
    marginTop: spacing.xs,
  },
  noticeText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.forest900,
  },
});
