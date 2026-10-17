import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackScreenProps } from '../navigation/types';
import { useReports, useSync, useNetwork } from '../hooks';
import { SyncStatusBadge } from '../components';
import { getWasteCategoryById, formatCoordinates, Report } from '../models';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';

interface SyncFeedback {
  type: 'success' | 'info' | 'error';
  message: string;
}

export function MyReportsScreen({ navigation }: RootStackScreenProps<'MyReports'>) {
  const { reports, loading, refresh } = useReports();
  const { isSyncing, syncNow, retryReport } = useSync();
  const { isOnline } = useNetwork();

  const [feedback, setFeedback] = useState<SyncFeedback | null>(null);

  // Refresh reports from local SQLite whenever this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Clear feedback after 5 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const handleRetryItem = async (reportId: string) => {
    try {
      const success = await retryReport(reportId);
      if (success) {
        setFeedback({
          type: 'success',
          message: 'Report synchronized successfully with Firebase Cloud.',
        });
      } else {
        setFeedback({
          type: 'error',
          message: 'Retry attempt failed. Check storage credentials or network.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Sync failed: ${err?.message || 'Network error'}`,
      });
    } finally {
      refresh();
    }
  };

  const handleManualSync = async () => {
    try {
      const summary = await syncNow({ force: true, downloadShared: true });
      if (summary.message) {
        setFeedback({ type: 'info', message: summary.message });
      } else if (summary.synced > 0 || summary.downloaded > 0) {
        setFeedback({
          type: 'success',
          message: `Sync complete: ${summary.synced} uploaded, ${summary.downloaded} shared downloaded.`,
        });
      } else if (summary.failed > 0) {
        setFeedback({
          type: 'error',
          message: `${summary.failed} report(s) could not sync. Check connection or retry individual items.`,
        });
      } else {
        setFeedback({
          type: 'info',
          message: 'All local and shared reports are up to date.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Sync error: ${err?.message || 'Check network connection'}`,
      });
    } finally {
      refresh();
    }
  };

  const pendingCount = reports.filter(
    (r) => r.syncStatus === 'PENDING' || r.syncStatus === 'FAILED'
  ).length;

  const renderReportItem = ({ item }: { item: Report }) => {
    const category = getWasteCategoryById(item.category);
    const dateFormatted = new Date(item.createdAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const imageUri = item.photoLocalUri || item.photoRemoteUrl;

    return (
      <TouchableOpacity
        style={styles.reportCard}
        activeOpacity={0.88}
        onPress={() => navigation.navigate('ReportDetail', { reportId: item.id })}
      >
        {/* Photo evidence thumbnail */}
        <View style={styles.thumbnailContainer}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.thumbnail} />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Ionicons name="image-outline" size={24} color={colors.slate400} />
            </View>
          )}

          {/* Sync Status Badge */}
          <View style={styles.badgeOverlay}>
            <SyncStatusBadge
              status={item.syncStatus}
              retryCount={item.retryCount}
              onRetry={() => handleRetryItem(item.id)}
            />
          </View>
        </View>

        {/* Report details */}
        <View style={styles.detailsContainer}>
          <View style={styles.categoryRow}>
            <View
              style={[
                styles.categoryDot,
                { backgroundColor: category?.color || colors.forest700 },
              ]}
            />
            <Text style={styles.categoryTitle}>{category?.name || item.category}</Text>
            <View style={styles.severityChip}>
              <Text style={styles.severityChipText}>{item.severity}</Text>
            </View>
          </View>

          {item.note && (
            <Text style={styles.noteText} numberOfLines={2}>
              {item.note}
            </Text>
          )}

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={13} color={colors.slate400} />
              <Text style={styles.metaText}>
                {formatCoordinates(item.latitude, item.longitude)}
              </Text>
            </View>

            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={13} color={colors.slate400} />
              <Text style={styles.metaText}>{dateFormatted}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="document-text-outline" size={38} color={colors.amber600} />
      </View>
      <Text style={styles.emptyTitle}>No Local Reports Yet</Text>
      <Text style={styles.emptyDescription}>
        Reports captured offline or online are immediately preserved in local SQLite
        storage.
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('NewReport')}
      >
        <Ionicons name="add-circle" size={18} color="#FFFFFF" />
        <Text style={styles.emptyButtonText}>Create New Report</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Top Synchronization Action & Status Bar */}
      <View style={styles.syncQueueBar}>
        <View style={styles.syncQueueTextCol}>
          <View style={styles.networkStatusRow}>
            <View
              style={[
                styles.networkDot,
                { backgroundColor: isOnline ? colors.forest700 : colors.amber600 },
              ]}
            />
            <Text style={styles.syncQueueTitle}>
              {isOnline ? 'Online (Cloud)' : 'Offline (Local)'}
            </Text>
          </View>
          <Text style={styles.syncQueueSub}>
            {pendingCount > 0
              ? `${pendingCount} report${pendingCount > 1 ? 's' : ''} queued for upload`
              : 'All local reports synchronized'}
          </Text>
        </View>

        {/* Manual Sync Now Button */}
        <TouchableOpacity
          style={[styles.syncNowButton, isSyncing && styles.syncNowButtonDisabled]}
          activeOpacity={0.8}
          onPress={handleManualSync}
          disabled={isSyncing}
          accessibilityRole="button"
          accessibilityLabel="Sync now"
        >
          {isSyncing ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.syncNowButtonText}>Syncing...</Text>
            </>
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={15} color="#FFFFFF" />
              <Text style={styles.syncNowButtonText}>Sync Now</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Synchronization Feedback Banner */}
      {feedback && (
        <View
          style={[
            styles.feedbackBanner,
            feedback.type === 'success' && styles.feedbackSuccess,
            feedback.type === 'error' && styles.feedbackError,
            feedback.type === 'info' && styles.feedbackInfo,
          ]}
        >
          <Ionicons
            name={
              feedback.type === 'success'
                ? 'checkmark-circle'
                : feedback.type === 'error'
                  ? 'alert-circle'
                  : 'information-circle'
            }
            size={18}
            color={
              feedback.type === 'success'
                ? colors.forest700
                : feedback.type === 'error'
                  ? colors.rose700
                  : colors.sky700
            }
          />
          <Text
            style={[
              styles.feedbackText,
              feedback.type === 'success' && styles.feedbackTextSuccess,
              feedback.type === 'error' && styles.feedbackTextError,
              feedback.type === 'info' && styles.feedbackTextInfo,
            ]}
          >
            {feedback.message}
          </Text>
          <TouchableOpacity
            onPress={() => setFeedback(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={16} color={colors.slate500} />
          </TouchableOpacity>
        </View>
      )}

      {loading && reports.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.forest700} />
          <Text style={styles.loadingText}>Loading offline database...</Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={renderReportItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={loading || isSyncing}
              onRefresh={handleManualSync}
              colors={[colors.forest700]}
              tintColor={colors.forest700}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: colors.slate500,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.md + 4,
    paddingBottom: spacing.xxl,
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.slate200,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  thumbnailContainer: {
    width: '100%',
    height: 160,
    backgroundColor: colors.slate100,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  detailsContainer: {
    padding: spacing.md,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.slate900,
    flex: 1,
  },
  severityChip: {
    backgroundColor: colors.slate100,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  severityChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate600,
  },
  noteText: {
    fontSize: 13,
    color: colors.slate600,
    lineHeight: 18,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11.5,
    color: colors.slate400,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl + 20,
    paddingHorizontal: spacing.lg,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.amber100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.slate900,
    marginBottom: 6,
  },
  emptyDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.slate500,
    textAlign: 'center',
    maxWidth: 290,
    marginBottom: spacing.xl,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.forest700,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: borderRadius.lg,
    ...shadows.card,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  syncQueueBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    paddingHorizontal: spacing.md + 4,
    paddingVertical: spacing.sm + 4,
  },
  syncQueueTextCol: {
    flex: 1,
  },
  networkStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  networkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  syncQueueTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.slate900,
  },
  syncQueueSub: {
    fontSize: 11,
    color: colors.slate500,
    marginTop: 2,
  },
  syncNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.forest700,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
  },
  syncNowButtonDisabled: {
    opacity: 0.65,
  },
  syncNowButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    gap: 8,
  },
  feedbackSuccess: {
    backgroundColor: colors.forest50,
    borderBottomColor: colors.forest200,
  },
  feedbackError: {
    backgroundColor: colors.rose50,
    borderBottomColor: colors.rose100,
  },
  feedbackInfo: {
    backgroundColor: colors.sky50,
    borderBottomColor: colors.sky100,
  },
  feedbackText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  feedbackTextSuccess: {
    color: colors.forest900,
  },
  feedbackTextError: {
    color: colors.rose700,
  },
  feedbackTextInfo: {
    color: colors.sky700,
  },
});
