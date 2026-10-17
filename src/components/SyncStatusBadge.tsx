import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SyncStatus } from '../models';
import { colors, borderRadius } from '../utils/theme';

export interface SyncStatusBadgeProps {
  status: SyncStatus;
  retryCount?: number;
  onRetry?: () => void;
}

/**
 * Custom-built reusable badge representing synchronization state:
 * - PENDING: Stored offline, queued for cloud sync
 * - SYNCING: Currently uploading evidence and Firestore report
 * - SYNCED: Successfully synchronized with cloud
 * - FAILED: Sync failed, exposes manual retry action
 */
export function SyncStatusBadge({
  status,
  retryCount = 0,
  onRetry,
}: SyncStatusBadgeProps) {
  switch (status) {
    case 'SYNCED':
      return (
        <View style={[styles.badge, styles.syncedBadge]}>
          <Ionicons name="checkmark-circle" size={13} color={colors.forest700} />
          <Text style={[styles.badgeText, styles.syncedText]}>SYNCED</Text>
        </View>
      );

    case 'SYNCING':
      return (
        <View style={[styles.badge, styles.syncingBadge]}>
          <ActivityIndicator size={11} color={colors.sky700} style={styles.spinner} />
          <Text style={[styles.badgeText, styles.syncingText]}>SYNCING...</Text>
        </View>
      );

    case 'FAILED':
      return (
        <View style={styles.failedRow}>
          <View style={[styles.badge, styles.failedBadge]}>
            <Ionicons name="alert-circle" size={13} color={colors.rose700} />
            <Text style={[styles.badgeText, styles.failedText]}>
              FAILED {retryCount > 0 ? `(${retryCount})` : ''}
            </Text>
          </View>

          {onRetry && (
            <TouchableOpacity
              style={styles.retryButton}
              activeOpacity={0.7}
              onPress={(e) => {
                e.stopPropagation();
                onRetry();
              }}
              accessibilityRole="button"
              accessibilityLabel="Retry report synchronization"
            >
              <Ionicons name="refresh" size={12} color="#FFFFFF" />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      );

    case 'PENDING':
    default:
      return (
        <View style={[styles.badge, styles.pendingBadge]}>
          <Ionicons name="time-outline" size={13} color={colors.amber800} />
          <Text style={[styles.badgeText, styles.pendingText]}>
            PENDING {retryCount > 0 ? `(${retryCount})` : ''}
          </Text>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: borderRadius.round,
    gap: 4,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  syncedBadge: {
    backgroundColor: colors.forest100,
    borderWidth: 1,
    borderColor: colors.forest200,
  },
  syncedText: {
    color: colors.forest800,
  },
  syncingBadge: {
    backgroundColor: colors.sky100,
    borderWidth: 1,
    borderColor: colors.sky200,
  },
  syncingText: {
    color: colors.sky700,
  },
  pendingBadge: {
    backgroundColor: colors.amber100,
    borderWidth: 1,
    borderColor: colors.amber200,
  },
  pendingText: {
    color: colors.amber800,
  },
  failedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  failedBadge: {
    backgroundColor: colors.rose50,
    borderWidth: 1,
    borderColor: colors.rose100,
  },
  failedText: {
    color: colors.rose700,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.rose700,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: borderRadius.round,
  },
  retryButtonText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  spinner: {
    marginRight: 2,
  },
});
