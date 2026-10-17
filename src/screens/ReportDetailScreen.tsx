import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackScreenProps } from '../navigation/types';
import { reportService } from '../services';
import { SyncStatusBadge } from '../components';
import { useSync } from '../hooks';
import {
  getWasteCategoryById,
  formatCoordinates,
  Report,
} from '../models';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';

export function ReportDetailScreen({
  route,
  navigation,
}: RootStackScreenProps<'ReportDetail'>) {
  const { reportId } = route.params;
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const { retryReport } = useSync();

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const data = await reportService.getReportById(reportId);
      setReport(data);
    } catch (error) {
      console.error('[ReportDetailScreen] Error fetching report:', error);
      Alert.alert('Error', 'Failed to load report from local database.');
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.forest700} />
        <Text style={styles.loadingText}>Loading report details...</Text>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.slate400} />
        <Text style={styles.errorTitle}>Report Not Found</Text>
        <Text style={styles.errorSubtitle}>
          The requested report could not be found in local SQLite storage.
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const category = getWasteCategoryById(report.category);
  const createdDate = new Date(report.createdAt).toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Evidence Photo Card */}
      <View style={styles.photoContainer}>
        {report.photoLocalUri || report.photoRemoteUrl ? (
          <Image
            source={{ uri: report.photoLocalUri || report.photoRemoteUrl || '' }}
            style={styles.photo}
          />
        ) : (
          <View style={styles.noPhotoBox}>
            <Ionicons name="image-outline" size={48} color={colors.slate400} />
            <Text style={styles.noPhotoText}>No photo evidence available</Text>
          </View>
        )}

        <View style={styles.photoBadgeOverlay}>
          <SyncStatusBadge
            status={report.syncStatus}
            retryCount={report.retryCount}
            onRetry={async () => {
              try {
                await retryReport(report.id);
              } finally {
                fetchReport();
              }
            }}
          />
        </View>
      </View>

      {/* Primary Category & Severity Card */}
      <View style={styles.sectionCard}>
        <View style={styles.categoryHeaderRow}>
          <View
            style={[
              styles.categoryIconCircle,
              { backgroundColor: category?.backgroundColor || colors.forest50 },
            ]}
          >
            <Ionicons
              name={(category?.iconName as any) || 'trash-outline'}
              size={24}
              color={category?.color || colors.forest700}
            />
          </View>

          <View style={styles.categoryInfo}>
            <Text style={styles.categoryName}>
              {category?.name || report.category}
            </Text>
            <Text style={styles.categorySub}>
              {category?.description || 'User waste report'}
            </Text>
          </View>

          <View style={styles.severityBadge}>
            <Text style={styles.severityBadgeText}>{report.severity}</Text>
          </View>
        </View>

        {category?.disposalInfo && (
          <View style={styles.disposalBox}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={colors.forest700}
              style={{ marginTop: 1 }}
            />
            <Text style={styles.disposalText}>{category.disposalInfo}</Text>
          </View>
        )}
      </View>

      {/* Note Section if present */}
      {report.note ? (
        <View style={styles.sectionCard}>
          <Text style={styles.cardHeaderTitle}>User Description</Text>
          <Text style={styles.noteBody}>{report.note}</Text>
        </View>
      ) : null}

      {/* Incident Location Card */}
      <View style={styles.sectionCard}>
        <Text style={styles.cardHeaderTitle}>Location Coordinates</Text>

        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={18} color={colors.forest700} />
          <View style={styles.detailTextCol}>
            <Text style={styles.detailPrimary}>
              {formatCoordinates(report.latitude, report.longitude)}
            </Text>
            <Text style={styles.detailSecondary}>
              Lat: {report.latitude.toFixed(6)} • Lng: {report.longitude.toFixed(6)}
            </Text>
          </View>
        </View>

        <View style={styles.subMetaGrid}>
          <View style={styles.subMetaItem}>
            <Text style={styles.subMetaLabel}>Accuracy</Text>
            <Text style={styles.subMetaVal}>
              {report.locationAccuracy ? `±${Math.round(report.locationAccuracy)}m` : 'N/A'}
            </Text>
          </View>

          <View style={styles.subMetaItem}>
            <Text style={styles.subMetaLabel}>Altitude</Text>
            <Text style={styles.subMetaVal}>
              {report.location.altitude ? `${Math.round(report.location.altitude)}m` : 'N/A'}
            </Text>
          </View>

          <View style={styles.subMetaItem}>
            <Text style={styles.subMetaLabel}>Pin Source</Text>
            <Text style={styles.subMetaVal}>
              {report.location.isManualPin ? 'Manual Pin' : 'GPS Device Fix'}
            </Text>
          </View>
        </View>
      </View>

      {/* Synchronization & Metadata Card */}
      <View style={styles.sectionCard}>
        <Text style={styles.cardHeaderTitle}>Offline Storage & Sync Status</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Sync State</Text>
          <Text style={styles.metaValue}>{report.syncStatus}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Retry Count</Text>
          <Text style={styles.metaValue}>{report.retryCount} attempts</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Recorded At</Text>
          <Text style={styles.metaValue}>{createdDate}</Text>
        </View>

        {report.lastSyncAttempt ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Last Sync Attempt</Text>
            <Text style={styles.metaValue}>
              {new Date(report.lastSyncAttempt).toLocaleTimeString()}
            </Text>
          </View>
        ) : null}

        {report.syncError ? (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={16} color={colors.rose700} />
            <Text style={styles.errorBoxText}>{report.syncError}</Text>
          </View>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Report UUID</Text>
          <Text style={styles.metaCode} numberOfLines={1} ellipsizeMode="middle">
            {report.id}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>User UID</Text>
          <Text style={styles.metaCode} numberOfLines={1} ellipsizeMode="middle">
            {report.userId}
          </Text>
        </View>
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
    padding: spacing.md + 4,
    paddingBottom: spacing.xxl + 20,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: colors.slate600,
    fontWeight: '600',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.slate900,
  },
  errorSubtitle: {
    fontSize: 13,
    color: colors.slate500,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  backButton: {
    backgroundColor: colors.forest700,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  photoContainer: {
    width: '100%',
    height: 240,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: colors.slate100,
    marginBottom: spacing.md,
    position: 'relative',
    ...shadows.card,
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  noPhotoBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  noPhotoText: {
    fontSize: 12,
    color: colors.slate400,
  },
  photoBadgeOverlay: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: spacing.md + 2,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    ...shadows.card,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.slate900,
  },
  categorySub: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 2,
  },
  severityBadge: {
    backgroundColor: colors.slate100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  severityBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.slate700,
  },
  disposalBox: {
    flexDirection: 'row',
    backgroundColor: colors.forest50,
    borderWidth: 1,
    borderColor: colors.forest200,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 4,
    gap: 8,
    marginTop: spacing.md,
  },
  disposalText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.forest900,
  },
  cardHeaderTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.slate900,
    marginBottom: spacing.sm + 2,
  },
  noteBody: {
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.slate700,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.sm + 4,
  },
  detailTextCol: {
    flex: 1,
  },
  detailPrimary: {
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.slate900,
  },
  detailSecondary: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 2,
  },
  subMetaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.slate50,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 2,
  },
  subMetaItem: {
    alignItems: 'center',
  },
  subMetaLabel: {
    fontSize: 10.5,
    color: colors.slate500,
    fontWeight: '600',
    marginBottom: 2,
  },
  subMetaVal: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate800,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  metaLabel: {
    fontSize: 12.5,
    color: colors.slate500,
    fontWeight: '600',
  },
  metaValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.slate800,
  },
  metaCode: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.slate600,
    maxWidth: 200,
  },
  divider: {
    height: 1,
    backgroundColor: colors.slate100,
    marginVertical: spacing.sm,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.rose50,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  errorBoxText: {
    fontSize: 11.5,
    color: colors.rose700,
    flex: 1,
  },
});
