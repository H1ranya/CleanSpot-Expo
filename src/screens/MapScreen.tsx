import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackScreenProps } from '../navigation/types';
import { CleanSpotMap, CleanSpotMapRef } from '../components/CleanSpotMap';
import {
  MapMarkerReport,
  formatCoordinates,
  WASTE_CATEGORIES,
  getWasteCategoryById,
  Severity,
} from '../models';
import { reportService, syncService, locationService } from '../services';
import { colors, spacing, shadows, borderRadius } from '../utils/theme';

type FilterType = 'ALL' | 'MINE' | 'COMMUNITY';

export function MapScreen({ navigation }: RootStackScreenProps<'Map'>) {
  const mapRef = useRef<CleanSpotMapRef>(null);

  const [markers, setMarkers] = useState<MapMarkerReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState<MapMarkerReport | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Load markers directly from local SQLite database (Requirements 4, 5)
  const loadMarkers = useCallback(async () => {
    try {
      const data = await reportService.getMapMarkers();
      setMarkers(data);
    } catch (error) {
      console.warn('[MapScreen] Failed to load markers from local SQLite:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Reload when screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadMarkers();
    }, [loadMarkers])
  );

  // Subscribe to SyncService: when sync finishes, update map (Requirement 7)
  useEffect(() => {
    let wasSyncing = false;
    const unsubscribe = syncService.subscribe((syncing) => {
      setIsSyncing(syncing);
      if (wasSyncing && !syncing) {
        // Sync just completed; new reports may have been downloaded from Firebase
        loadMarkers();
      }
      wasSyncing = syncing;
    });

    return () => {
      unsubscribe();
    };
  }, [loadMarkers]);

  // Filter markers based on Ownership and Category
  const filteredMarkers = useMemo(() => {
    return markers.filter((m) => {
      // 1. Ownership filter
      if (activeFilter === 'MINE' && !m.isOwn) return false;
      if (activeFilter === 'COMMUNITY' && m.isOwn) return false;

      // 2. Category filter
      if (selectedCategory !== 'ALL' && m.category !== selectedCategory) return false;

      return true;
    });
  }, [markers, activeFilter, selectedCategory]);

  // Counts
  const counts = useMemo(() => {
    const mine = markers.filter((m) => m.isOwn).length;
    const community = markers.filter((m) => !m.isOwn).length;
    return { all: markers.length, mine, community };
  }, [markers]);

  // Handle marker tap (Requirement 8)
  const handleMarkerPress = (marker: MapMarkerReport) => {
    setSelectedMarker(marker);
    mapRef.current?.centerOn(marker.latitude, marker.longitude, 16);
  };

  // Center on device current GPS position
  const handleLocateMe = async () => {
    try {
      setIsLocating(true);
      const res = await locationService.acquireLocationForReport({ timeoutMs: 5000 });
      if (res.location) {
        mapRef.current?.centerOn(res.location.latitude, res.location.longitude, 16);
      }
    } catch (err) {
      console.warn('[MapScreen] Locate Me failed:', err);
    } finally {
      setIsLocating(false);
    }
  };

  const handleFitAll = () => {
    mapRef.current?.fitAllMarkers();
  };

  const activeCategoryObj = selectedMarker
    ? getWasteCategoryById(selectedMarker.category)
    : undefined;

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })} at ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <View style={styles.container}>
      {/* 1. Full-screen Interactive Leaflet Map */}
      <CleanSpotMap
        ref={mapRef}
        markers={filteredMarkers}
        mode="view"
        onMarkerPress={handleMarkerPress}
        style={StyleSheet.absoluteFill}
      />

      {/* 2. Top Header Overlay: Filter Tabs & Sync Status */}
      <View style={styles.topOverlay}>
        <View style={styles.filterTabsRow}>
          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'ALL' && styles.filterTabActive]}
            activeOpacity={0.8}
            onPress={() => setActiveFilter('ALL')}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === 'ALL' && styles.filterTabTextActive,
              ]}
            >
              All ({counts.all})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'MINE' && styles.filterTabActive]}
            activeOpacity={0.8}
            onPress={() => setActiveFilter('MINE')}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === 'MINE' && styles.filterTabTextActive,
              ]}
            >
              My Reports ({counts.mine})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'COMMUNITY' && styles.filterTabActive,
            ]}
            activeOpacity={0.8}
            onPress={() => setActiveFilter('COMMUNITY')}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === 'COMMUNITY' && styles.filterTabTextActive,
              ]}
            >
              Community ({counts.community})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Category Horizontal Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          <TouchableOpacity
            style={[
              styles.categoryPill,
              selectedCategory === 'ALL' && styles.categoryPillActive,
            ]}
            onPress={() => setSelectedCategory('ALL')}
          >
            <Text
              style={[
                styles.categoryPillText,
                selectedCategory === 'ALL' && styles.categoryPillTextActive,
              ]}
            >
              All Types
            </Text>
          </TouchableOpacity>

          {WASTE_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryPill,
                  isSelected && {
                    backgroundColor: cat.color,
                    borderColor: cat.color,
                  },
                ]}
                onPress={() => setSelectedCategory(isSelected ? 'ALL' : cat.id)}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    isSelected && { color: '#FFFFFF', fontWeight: '700' },
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Syncing indicator badge */}
        {isSyncing && (
          <View style={styles.syncingBanner}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.syncingText}>Syncing shared reports with cloud...</Text>
          </View>
        )}
      </View>

      {/* 3. Floating Action Controls */}
      <View style={styles.floatingControls}>
        <TouchableOpacity
          style={styles.floatingButton}
          activeOpacity={0.85}
          onPress={handleLocateMe}
          disabled={isLocating}
        >
          {isLocating ? (
            <ActivityIndicator size="small" color={colors.forest700} />
          ) : (
            <Ionicons name="navigate" size={20} color={colors.forest700} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.floatingButton}
          activeOpacity={0.85}
          onPress={handleFitAll}
        >
          <Ionicons name="expand" size={20} color={colors.slate700} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.floatingButton}
          activeOpacity={0.85}
          onPress={loadMarkers}
        >
          <Ionicons name="reload" size={18} color={colors.slate700} />
        </TouchableOpacity>
      </View>

      {/* 4. Bottom Callout / Detail Card when marker is tapped (Requirements 3, 8) */}
      {selectedMarker && (
        <View style={styles.calloutCard}>
          {/* Header row */}
          <View style={styles.calloutHeader}>
            <View style={styles.badgeGroup}>
              {/* Category Pill */}
              <View
                style={[
                  styles.categoryBadge,
                  {
                    backgroundColor:
                      activeCategoryObj?.backgroundColor ?? colors.slate100,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.categoryBadgeText,
                    { color: activeCategoryObj?.color ?? colors.slate700 },
                  ]}
                >
                  {activeCategoryObj?.name ?? selectedMarker.category}
                </Text>
              </View>

              {/* Severity Badge */}
              <View
                style={[
                  styles.severityBadge,
                  selectedMarker.severity === 'High' && styles.severityHigh,
                  selectedMarker.severity === 'Medium' && styles.severityMed,
                  selectedMarker.severity === 'Low' && styles.severityLow,
                ]}
              >
                <Ionicons
                  name={
                    selectedMarker.severity === 'High'
                      ? 'flame'
                      : selectedMarker.severity === 'Medium'
                      ? 'alert-circle'
                      : 'leaf'
                  }
                  size={12}
                  color={
                    selectedMarker.severity === 'High'
                      ? colors.rose700
                      : selectedMarker.severity === 'Medium'
                      ? colors.amber700
                      : colors.forest700
                  }
                />
                <Text
                  style={[
                    styles.severityText,
                    selectedMarker.severity === 'High' && { color: colors.rose700 },
                    selectedMarker.severity === 'Medium' && { color: colors.amber700 },
                    selectedMarker.severity === 'Low' && { color: colors.forest700 },
                  ]}
                >
                  {selectedMarker.severity} Severity
                </Text>
              </View>

              {/* Ownership Pill */}
              <View
                style={[
                  styles.ownershipBadge,
                  selectedMarker.isOwn
                    ? styles.ownershipMine
                    : styles.ownershipCommunity,
                ]}
              >
                <Text
                  style={[
                    styles.ownershipText,
                    selectedMarker.isOwn
                      ? styles.ownershipTextMine
                      : styles.ownershipTextCommunity,
                  ]}
                >
                  {selectedMarker.isOwn ? 'Your Report' : 'Community'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeCalloutButton}
              onPress={() => setSelectedMarker(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={colors.slate400} />
            </TouchableOpacity>
          </View>

          {/* Details body */}
          <View style={styles.calloutBody}>
            {selectedMarker.photoUrl ? (
              <Image
                source={{ uri: selectedMarker.photoUrl }}
                style={styles.calloutThumbnail}
              />
            ) : (
              <View style={styles.calloutNoPhoto}>
                <Ionicons name="image-outline" size={24} color={colors.slate400} />
              </View>
            )}

            <View style={styles.calloutTextContent}>
              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={13} color={colors.slate400} />
                <Text style={styles.metaText}>
                  {formatDate(selectedMarker.createdAt)}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={13} color={colors.slate400} />
                <Text style={styles.metaText}>
                  {formatCoordinates(
                    selectedMarker.latitude,
                    selectedMarker.longitude
                  )}
                </Text>
              </View>

              {selectedMarker.note ? (
                <Text style={styles.calloutNote} numberOfLines={2}>
                  "{selectedMarker.note}"
                </Text>
              ) : (
                <Text style={styles.calloutNoteEmpty}>No description note</Text>
              )}
            </View>
          </View>

          {/* Action button */}
          <TouchableOpacity
            style={styles.viewDetailButton}
            activeOpacity={0.85}
            onPress={() =>
              navigation.navigate('ReportDetail', { reportId: selectedMarker.id })
            }
          >
            <Text style={styles.viewDetailText}>View Report Details</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate100,
  },
  topOverlay: {
    position: 'absolute',
    top: 12,
    left: spacing.md,
    right: spacing.md,
    zIndex: 20,
  },
  filterTabsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 14,
    padding: 3,
    ...shadows.card,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 11,
  },
  filterTabActive: {
    backgroundColor: colors.forest700,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate600,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  categoryScroll: {
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  categoryPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.slate200,
    ...shadows.card,
  },
  categoryPillActive: {
    backgroundColor: colors.slate800,
    borderColor: colors.slate800,
  },
  categoryPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.slate600,
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  syncingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginTop: 6,
    alignSelf: 'center',
  },
  syncingText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  floatingControls: {
    position: 'absolute',
    right: spacing.md,
    bottom: 220,
    gap: spacing.sm,
    zIndex: 20,
  },
  floatingButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  calloutCard: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: spacing.md,
    zIndex: 30,
    ...shadows.floatingBar,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
    flex: 1,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  severityLow: {
    backgroundColor: colors.forest50,
  },
  severityMed: {
    backgroundColor: colors.amber50,
  },
  severityHigh: {
    backgroundColor: colors.rose50,
  },
  severityText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  ownershipBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ownershipMine: {
    backgroundColor: colors.sky50,
    borderWidth: 1,
    borderColor: colors.sky200,
  },
  ownershipCommunity: {
    backgroundColor: colors.slate100,
  },
  ownershipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  ownershipTextMine: {
    color: colors.sky700,
  },
  ownershipTextCommunity: {
    color: colors.slate600,
  },
  closeCalloutButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.slate100,
  },
  calloutBody: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  calloutThumbnail: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: colors.slate200,
  },
  calloutNoPhoto: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutTextContent: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11.5,
    color: colors.slate500,
    fontWeight: '500',
  },
  calloutNote: {
    fontSize: 12,
    color: colors.slate800,
    fontStyle: 'italic',
    marginTop: 2,
  },
  calloutNoteEmpty: {
    fontSize: 11,
    color: colors.slate400,
    marginTop: 2,
  },
  viewDetailButton: {
    backgroundColor: colors.forest700,
    height: 42,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    ...shadows.card,
  },
  viewDetailText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
