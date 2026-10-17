import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackScreenProps } from '../navigation/types';
import { reportService, networkService, syncService } from '../services';
import { WASTE_CATEGORIES, getWasteCategoryById } from '../models';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';

export function StatisticsScreen({ navigation }: RootStackScreenProps<'Statistics'>) {
  const [totalSynced, setTotalSynced] = useState<number>(0);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(networkService.isOnline());

  // Load statistics from local SQLite repository (source of truth)
  const fetchStatistics = useCallback(async () => {
    try {
      setError(null);
      const [syncedCount, catCounts] = await Promise.all([
        reportService.getTotalSyncedReports(),
        reportService.getCategoryCounts(),
      ]);

      setTotalSynced(syncedCount);
      setCategoryCounts(catCounts);
    } catch (err) {
      console.warn('[StatisticsScreen] Failed to fetch statistics:', err);
      setError('Unable to load report statistics from local storage.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Refresh on screen focus
  useFocusEffect(
    useCallback(() => {
      fetchStatistics();
    }, [fetchStatistics])
  );

  // Subscribe to network transitions for offline indicator
  useEffect(() => {
    const unsubNet = networkService.subscribe((online) => {
      setIsOnline(online);
    });

    const unsubSync = syncService.subscribe((syncing) => {
      if (!syncing) {
        // Sync just completed; update metrics from SQLite
        fetchStatistics();
      }
    });

    return () => {
      unsubNet();
      unsubSync();
    };
  }, [fetchStatistics]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchStatistics();
  };

  // Calculate sum of category reports
  const totalCategoryReports = Object.values(categoryCounts).reduce(
    (sum, count) => sum + count,
    0
  );

  // Grouped category data with name, icon, color, and percentage
  const categoryData = WASTE_CATEGORIES.map((cat) => {
    const count = categoryCounts[cat.id] || 0;
    const percentage =
      totalCategoryReports > 0 ? Math.round((count / totalCategoryReports) * 100) : 0;
    return {
      ...cat,
      count,
      percentage,
    };
  }).sort((a, b) => b.count - a.count);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading report statistics...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    >
      {/* Offline Indicator Banner */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color={colors.amber800} />
          <Text style={styles.offlineBannerText}>
            Offline Mode • Displaying statistics cached in local SQLite
          </Text>
        </View>
      )}

      {/* Error state */}
      {error && (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={24} color={colors.rose700} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchStatistics}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 1. Total Synced Reports Hero Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <Text style={styles.heroMetricNumber}>{totalSynced}</Text>
          <View style={styles.heroIconBox}>
            <Ionicons name="cloud-done" size={28} color={colors.forest700} />
          </View>
        </View>

        <Text style={styles.heroTitle}>Total Synced Reports</Text>
        <Text style={styles.heroSubtitle}>
          Civic waste reports successfully uploaded or synchronized from the cloud
          community.
        </Text>
      </View>

      {/* 2. Reports Grouped by Waste Category */}
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>Reports by Waste Category</Text>
          <Text style={styles.sectionSubtitle}>
            Distribution across registered waste types
          </Text>
        </View>
        <Text style={styles.totalBadge}>{totalCategoryReports} Total</Text>
      </View>

      {/* Empty State */}
      {totalCategoryReports === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="folder-open-outline" size={36} color={colors.slate400} />
          </View>
          <Text style={styles.emptyTitle}>No Waste Reports Found</Text>
          <Text style={styles.emptyDescription}>
            Submit your first civic report or synchronize with the community to populate
            category metrics.
          </Text>
          <TouchableOpacity
            style={styles.createReportButton}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('NewReport')}
          >
            <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
            <Text style={styles.createReportButtonText}>Create New Report</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.categoryListCard}>
          {categoryData.map((item, index) => {
            const isLast = index === categoryData.length - 1;
            return (
              <View
                key={item.id}
                style={[styles.categoryRow, !isLast && styles.categoryRowBorder]}
              >
                <View style={styles.categoryMainRow}>
                  {/* Category Icon & Name */}
                  <View style={styles.categoryLeft}>
                    <View
                      style={[
                        styles.categoryIconCircle,
                        { backgroundColor: item.backgroundColor },
                      ]}
                    >
                      <Ionicons
                        name={item.iconName as any}
                        size={18}
                        color={item.color}
                      />
                    </View>
                    <Text style={styles.categoryName}>{item.name}</Text>
                  </View>

                  {/* Count & Percentage Badge */}
                  <View style={styles.categoryRight}>
                    <Text style={styles.categoryCount}>
                      {item.count} {item.count === 1 ? 'report' : 'reports'}
                    </Text>
                    <View
                      style={[
                        styles.percentageBadge,
                        { backgroundColor: item.backgroundColor },
                      ]}
                    >
                      <Text style={[styles.percentageText, { color: item.color }]}>
                        {item.percentage}%
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Visual Progress Bar */}
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        backgroundColor: item.color,
                        width: `${Math.max(item.percentage, item.count > 0 ? 4 : 0)}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}
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
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.slate600,
    fontWeight: '500',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.amber50,
    borderWidth: 1,
    borderColor: colors.amber200,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  offlineBannerText: {
    fontSize: 12,
    color: colors.amber800,
    fontWeight: '600',
    flex: 1,
  },
  errorCard: {
    backgroundColor: colors.rose50,
    borderWidth: 1,
    borderColor: colors.rose100,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: 13,
    color: colors.rose700,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.rose700,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    marginTop: 4,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.slate200,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  heroIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.forest50,
    borderWidth: 1,
    borderColor: colors.forest200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.forest50,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.forest200,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.forest600,
  },
  heroStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.forest800,
  },
  heroMetricNumber: {
    fontSize: 44,
    fontWeight: '900',
    color: colors.slate900,
    letterSpacing: -1,
    marginVertical: 4,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.slate900,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.slate500,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.sm + 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.slate900,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 2,
  },
  totalBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate600,
    backgroundColor: colors.slate100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.slate200,
    alignItems: 'center',
    ...shadows.card,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.slate800,
    marginBottom: 6,
  },
  emptyDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.slate500,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  createReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.forest700,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    gap: 8,
    ...shadows.card,
  },
  createReportButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  categoryListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    ...shadows.card,
  },
  categoryRow: {
    paddingVertical: spacing.md,
  },
  categoryRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  categoryMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate800,
  },
  categoryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate600,
  },
  percentageBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  percentageText: {
    fontSize: 11,
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.slate100,
    overflow: 'hidden',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
