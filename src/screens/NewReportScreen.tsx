import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackScreenProps } from '../navigation/types';
import {
  CameraCaptureModal,
  WasteCategoryPicker,
  LocationPickerModal,
  SyncStatusBadge,
} from '../components';
import { useLocation } from '../hooks';
import {
  WASTE_CATEGORIES,
  getWasteCategoryById,
  formatCoordinates,
  Severity,
  Report,
} from '../models';
import { reportService, syncService, networkService } from '../services';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';

const SEVERITY_OPTIONS: Array<{
  level: Severity;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  {
    level: 'Low',
    label: 'Low',
    description: 'Minor litter or single bag',
    color: colors.forest700,
    bgColor: colors.forest50,
    borderColor: colors.forest200,
    icon: 'leaf-outline',
  },
  {
    level: 'Medium',
    label: 'Medium',
    description: 'Overflowing bin or scattered waste',
    color: colors.amber700,
    bgColor: colors.amber50,
    borderColor: colors.amber200,
    icon: 'alert-circle-outline',
  },
  {
    level: 'High',
    label: 'High',
    description: 'Hazardous or massive illegal dump',
    color: colors.rose700,
    bgColor: colors.rose50,
    borderColor: colors.rose100,
    icon: 'flame-outline',
  },
];

export function NewReportScreen({ navigation }: RootStackScreenProps<'NewReport'>) {
  // 1. Photo evidence state
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // 2. Category selection state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // 3. Severity state
  const [severity, setSeverity] = useState<Severity>('Medium');

  // 4. Note state
  const [note, setNote] = useState('');

  // 5. Submission & confirmation states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedReport, setSavedReport] = useState<Report | null>(null);
  const [locationModalVisible, setLocationModalVisible] = useState(false);

  // 6. GPS Location hook
  const {
    isAcquiring: isLocating,
    result: locationResult,
    location,
    acquireLocation,
    setManualLocation,
  } = useLocation();

  // Automatically attempt to acquire location on screen mount
  useEffect(() => {
    acquireLocation();
  }, [acquireLocation]);

  // Listen for sync completion to live-update modal state if open
  useEffect(() => {
    if (!savedReport || savedReport.syncStatus === 'SYNCED') return;

    const unsubscribe = syncService.subscribe(async (syncing) => {
      if (!syncing) {
        const updated = await reportService.getReportById(savedReport.id);
        if (updated && updated.syncStatus !== savedReport.syncStatus) {
          setSavedReport(updated);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [savedReport]);

  const handlePhotoCaptured = (uri: string) => {
    setPhotoUri(uri);
  };

  const handleRetake = () => {
    setCameraModalVisible(true);
  };

  const handleResetForm = () => {
    setPhotoUri(null);
    setSelectedCategory(null);
    setSeverity('Medium');
    setNote('');
    setSavedReport(null);
    acquireLocation();
  };

  // Submit report to local SQLite database via ReportService
  const handleSubmitReport = async () => {
    if (!photoUri) {
      Alert.alert(
        'Photo Required',
        'Please capture a photo evidence before submitting your report.'
      );
      return;
    }

    if (!selectedCategory) {
      Alert.alert(
        'Category Required',
        'Please select the type of waste for this report.'
      );
      return;
    }

    if (!location) {
      Alert.alert(
        'Location Required',
        'Please acquire a GPS position or select a manual location.'
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const created = await reportService.create({
        category: selectedCategory,
        severity,
        photoLocalUri: photoUri,
        location,
        note: note.trim() || undefined,
      });

      setSavedReport(created);

      // If active internet is present, immediately initiate background sync
      if (networkService.isOnline()) {
        syncService
          .syncPendingReports({ downloadShared: false })
          .then(async () => {
            const updated = await reportService.getReportById(created.id);
            if (updated) {
              setSavedReport(updated);
            }
          })
          .catch((err) => {
            console.warn('[NewReportScreen] Immediate background sync error:', err);
          });
      }
    } catch (error) {
      console.error('[NewReportScreen] Failed to save report:', error);
      Alert.alert(
        'Submission Error',
        error instanceof Error ? error.message : 'Failed to save report.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeCategoryObj = selectedCategory
    ? getWasteCategoryById(selectedCategory)
    : undefined;

  const isOnline = networkService.isOnline();
  const isSynced = savedReport?.syncStatus === 'SYNCED';

  const confirmTitle = isSynced
    ? 'Report Synced to Cloud!'
    : isOnline
    ? 'Report Submitted!'
    : 'Report Saved Offline!';

  const confirmSubtitle = isSynced
    ? 'Your report has been verified and successfully uploaded to Firebase Cloud.'
    : isOnline
    ? 'Saved locally and currently synchronizing with Firebase Cloud in the background.'
    : 'Your report has been safely queued in local SQLite and will automatically sync once online.';

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* STEP 1: PHOTO EVIDENCE */}
        <View style={styles.sectionHeader}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>1</Text>
          </View>
          <View style={styles.stepTitleBlock}>
            <Text style={styles.sectionTitle}>Photo Evidence</Text>
            <Text style={styles.sectionSubtitle}>
              Camera capture only • Stored offline
            </Text>
          </View>
        </View>

        {!photoUri ? (
          <TouchableOpacity
            style={styles.captureCard}
            activeOpacity={0.85}
            onPress={() => setCameraModalVisible(true)}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="camera" size={34} color={colors.forest700} />
            </View>
            <Text style={styles.captureTitle}>Take Evidence Photo</Text>
            <Text style={styles.captureDescription}>
              Tap to open camera. High-resolution photos are automatically resized and
              compressed for offline storage.
            </Text>
            <View style={styles.actionPill}>
              <Ionicons name="scan-outline" size={14} color={colors.forest700} />
              <Text style={styles.actionPillText}>Open Camera</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.previewCard}>
            <Image source={{ uri: photoUri }} style={styles.previewImage} />

            <View style={styles.previewDetails}>
              <View style={styles.badgeRow}>
                <View style={styles.successBadge}>
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color={colors.forest700}
                  />
                  <Text style={styles.successBadgeText}>Evidence Captured</Text>
                </View>
                <Text style={styles.offlineTag}>Offline Stored</Text>
              </View>

              <TouchableOpacity
                style={styles.retakeButton}
                activeOpacity={0.8}
                onPress={handleRetake}
              >
                <Ionicons name="camera-reverse" size={16} color={colors.slate700} />
                <Text style={styles.retakeButtonText}>Retake Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* STEP 2: WASTE CATEGORY */}
        <View style={styles.sectionHeader}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>2</Text>
          </View>
          <View style={styles.stepTitleBlock}>
            <Text style={styles.sectionTitle}>Waste Category</Text>
            <Text style={styles.sectionSubtitle}>
              Tap to select • Hold any tile for disposal guidelines
            </Text>
          </View>
        </View>

        <View style={styles.categoryPickerSection}>
          <WasteCategoryPicker
            categories={WASTE_CATEGORIES}
            selectedId={selectedCategory}
            columns={2}
            onSelect={(id) => setSelectedCategory(id)}
          />
        </View>

        {/* STEP 3: SEVERITY SELECTION */}
        <View style={styles.sectionHeader}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>3</Text>
          </View>
          <View style={styles.stepTitleBlock}>
            <Text style={styles.sectionTitle}>Severity Level</Text>
            <Text style={styles.sectionSubtitle}>
              Estimate the environmental impact & urgency
            </Text>
          </View>
        </View>

        <View style={styles.severityRow}>
          {SEVERITY_OPTIONS.map((opt) => {
            const isSelected = severity === opt.level;
            return (
              <TouchableOpacity
                key={opt.level}
                style={[
                  styles.severityCard,
                  isSelected && {
                    borderColor: opt.color,
                    backgroundColor: opt.bgColor,
                    borderWidth: 2,
                  },
                ]}
                activeOpacity={0.8}
                onPress={() => setSeverity(opt.level)}
              >
                <View
                  style={[
                    styles.severityIconCircle,
                    { backgroundColor: isSelected ? opt.bgColor : colors.slate100 },
                  ]}
                >
                  <Ionicons
                    name={opt.icon}
                    size={20}
                    color={isSelected ? opt.color : colors.slate500}
                  />
                </View>
                <Text
                  style={[
                    styles.severityLabel,
                    isSelected && { color: opt.color, fontWeight: '800' },
                  ]}
                >
                  {opt.label}
                </Text>
                <Text
                  style={[styles.severityDesc, isSelected && { color: opt.color }]}
                  numberOfLines={2}
                >
                  {opt.description}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* STEP 4: OPTIONAL NOTE */}
        <View style={styles.sectionHeader}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>4</Text>
          </View>
          <View style={styles.stepTitleBlock}>
            <Text style={styles.sectionTitle}>Description & Notes</Text>
            <Text style={styles.sectionSubtitle}>
              Optional landmark or access notes
            </Text>
          </View>
        </View>

        <View style={styles.noteContainer}>
          <TextInput
            style={styles.noteInput}
            placeholder="e.g. Behind the bus shelter, overflowing onto sidewalk, requires vehicle pickup..."
            placeholderTextColor={colors.slate400}
            multiline
            numberOfLines={3}
            maxLength={500}
            value={note}
            onChangeText={setNote}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{note.length} / 500</Text>
        </View>

        {/* STEP 5: GPS INCIDENT LOCATION */}
        <View style={styles.sectionHeader}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>5</Text>
          </View>
          <View style={styles.stepTitleBlock}>
            <Text style={styles.sectionTitle}>Incident Location</Text>
            <Text style={styles.sectionSubtitle}>
              Single-fix GPS • Fallback to last-known position
            </Text>
          </View>
        </View>

        <View style={styles.locationContainer}>
          {isLocating ? (
            <View style={styles.locationLoadingCard}>
              <ActivityIndicator size="small" color={colors.forest700} />
              <Text style={styles.locationLoadingText}>
                Acquiring GPS fix (7s timeout)...
              </Text>
            </View>
          ) : location ? (
            <View style={styles.locationActiveCard}>
              <View style={styles.locationTopRow}>
                <View style={styles.locationCoordBlock}>
                  <Ionicons name="location" size={20} color={colors.forest700} />
                  <Text style={styles.locationCoords}>
                    {formatCoordinates(location.latitude, location.longitude)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.locationSourceBadge,
                    locationResult?.source === 'last_known' && styles.sourceBadgeAmber,
                    locationResult?.source === 'manual' && styles.sourceBadgeBlue,
                  ]}
                >
                  <Text
                    style={[
                      styles.locationSourceBadgeText,
                      locationResult?.source === 'last_known' && styles.sourceTextAmber,
                      locationResult?.source === 'manual' && styles.sourceTextBlue,
                    ]}
                  >
                    {locationResult?.source === 'last_known'
                      ? 'Cached Fix'
                      : locationResult?.source === 'manual'
                        ? 'Manual Pin'
                        : `GPS ±${location.accuracy ? Math.round(location.accuracy) : 0}m`}
                  </Text>
                </View>
              </View>

              <View style={styles.locationMetaRow}>
                <Text style={styles.locationDetailText}>
                  Lat: {location.latitude.toFixed(6)} • Lng:{' '}
                  {location.longitude.toFixed(6)}
                </Text>
                {location.altitude != null && (
                  <Text style={styles.locationDetailText}>
                    Alt: {Math.round(location.altitude)}m
                  </Text>
                )}
              </View>

              <View style={styles.locationActiveActionsRow}>
                <TouchableOpacity
                  style={styles.refreshLocButton}
                  activeOpacity={0.8}
                  onPress={acquireLocation}
                >
                  <Ionicons name="refresh" size={14} color={colors.forest700} />
                  <Text style={styles.refreshLocButtonText}>Re-acquire GPS</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pickOnMapButton}
                  activeOpacity={0.8}
                  onPress={() => setLocationModalVisible(true)}
                >
                  <Ionicons name="map-outline" size={14} color={colors.slate700} />
                  <Text style={styles.pickOnMapButtonText}>Change on Map</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.locationPromptCard}>
              {locationResult?.status === 'PERMISSION_DENIED' && (
                <View style={styles.locationAlertBox}>
                  <Ionicons name="warning-outline" size={16} color={colors.amber700} />
                  <Text style={styles.locationAlertText}>{locationResult.message}</Text>
                </View>
              )}

              {locationResult?.status === 'SERVICES_DISABLED' && (
                <View style={styles.locationAlertBox}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={16}
                    color={colors.rose700}
                  />
                  <Text style={styles.locationAlertText}>{locationResult.message}</Text>
                </View>
              )}

              {locationResult?.status === 'MANUAL_REQUIRED' && (
                <View style={styles.locationAlertBox}>
                  <Ionicons name="map-outline" size={16} color={colors.forest700} />
                  <Text style={styles.locationAlertText}>{locationResult.message}</Text>
                </View>
              )}

              <View style={styles.locationActionButtonsRow}>
                <TouchableOpacity
                  style={styles.acquireGpsButton}
                  activeOpacity={0.85}
                  onPress={acquireLocation}
                >
                  <Ionicons name="locate" size={16} color="#FFFFFF" />
                  <Text style={styles.acquireGpsButtonText}>
                    Acquire Current GPS Fix
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.manualFallbackButton}
                  activeOpacity={0.8}
                  onPress={() => setLocationModalVisible(true)}
                >
                  <Ionicons name="pin" size={14} color={colors.slate700} />
                  <Text style={styles.manualFallbackButtonText}>Pick Location</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* SUBMIT BUTTON */}
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          activeOpacity={0.85}
          onPress={handleSubmitReport}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Submit User Report</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Full-screen camera capture modal */}
        <CameraCaptureModal
          visible={cameraModalVisible}
          onClose={() => setCameraModalVisible(false)}
          onPhotoCaptured={handlePhotoCaptured}
        />

        {/* Manual Location Selection Modal */}
        <LocationPickerModal
          visible={locationModalVisible}
          initialLocation={
            location
              ? { latitude: location.latitude, longitude: location.longitude }
              : undefined
          }
          onConfirm={(coords) => setManualLocation(coords)}
          onClose={() => setLocationModalVisible(false)}
        />

        {/* Confirmation Modal */}
        <Modal
          visible={savedReport !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setSavedReport(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.confirmCard}>
              <View style={[styles.confirmIconCircle, isSynced && { backgroundColor: colors.forest100 }]}>
                <Ionicons
                  name={isSynced ? 'cloud-done' : isOnline ? 'cloud-upload' : 'cloud-offline'}
                  size={36}
                  color={colors.forest700}
                />
              </View>

              <Text style={styles.confirmTitle}>{confirmTitle}</Text>
              <Text style={styles.confirmSubtitle}>{confirmSubtitle}</Text>

              {savedReport && (
                <View style={styles.confirmDetailsBox}>
                  <View style={styles.confirmDetailRow}>
                    <Text style={styles.confirmLabel}>Status</Text>
                    <SyncStatusBadge status={savedReport.syncStatus} />
                  </View>

                  <View style={styles.confirmDetailRow}>
                    <Text style={styles.confirmLabel}>Category</Text>
                    <Text style={styles.confirmValue}>
                      {activeCategoryObj?.name || savedReport.category}
                    </Text>
                  </View>

                  <View style={styles.confirmDetailRow}>
                    <Text style={styles.confirmLabel}>Severity</Text>
                    <Text style={styles.confirmValue}>{savedReport.severity}</Text>
                  </View>

                  <View style={styles.confirmDetailRow}>
                    <Text style={styles.confirmLabel}>Coordinates</Text>
                    <Text style={styles.confirmValue}>
                      {savedReport.latitude.toFixed(4)},{' '}
                      {savedReport.longitude.toFixed(4)}
                    </Text>
                  </View>

                  <View style={styles.confirmDetailRow}>
                    <Text style={styles.confirmLabel}>Report ID</Text>
                    <Text style={styles.confirmIdText} numberOfLines={1}>
                      {savedReport.id.substring(0, 18)}...
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.confirmActionsRow}>
                <TouchableOpacity
                  style={styles.confirmSecondaryButton}
                  activeOpacity={0.8}
                  onPress={() => {
                    handleResetForm();
                  }}
                >
                  <Text style={styles.confirmSecondaryText}>Create Another</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmPrimaryButton}
                  activeOpacity={0.85}
                  onPress={() => {
                    setSavedReport(null);
                    navigation.navigate('Home');
                  }}
                >
                  <Text style={styles.confirmPrimaryText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md + 4,
    paddingBottom: spacing.xxl + 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.forest700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stepTitleBlock: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.slate900,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 1,
  },
  captureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.forest200,
    borderStyle: 'dashed',
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: colors.forest100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  captureTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.slate900,
    marginBottom: 4,
  },
  captureDescription: {
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.slate500,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: spacing.md,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.forest50,
    borderWidth: 1,
    borderColor: colors.forest200,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.round,
    gap: 6,
  },
  actionPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.forest700,
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.slate200,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  previewImage: {
    width: '100%',
    height: 220,
    resizeMode: 'cover',
  },
  previewDetails: {
    padding: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.forest100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.round,
    gap: 4,
  },
  successBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.forest800,
  },
  offlineTag: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.slate400,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.slate100,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  retakeButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate700,
  },
  categoryPickerSection: {
    marginBottom: spacing.lg,
  },
  severityRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.lg,
  },
  severityCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md + 2,
    borderWidth: 1.5,
    borderColor: colors.slate200,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs + 2,
    alignItems: 'center',
    ...shadows.card,
  },
  severityIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  severityLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate800,
    marginBottom: 2,
  },
  severityDesc: {
    fontSize: 10.5,
    color: colors.slate500,
    textAlign: 'center',
    lineHeight: 14,
  },
  noteContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md + 2,
    borderWidth: 1,
    borderColor: colors.slate200,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  noteInput: {
    fontSize: 13.5,
    color: colors.slate900,
    minHeight: 68,
    lineHeight: 20,
  },
  charCount: {
    fontSize: 11,
    color: colors.slate400,
    textAlign: 'right',
    marginTop: 4,
  },
  locationContainer: {
    marginBottom: spacing.lg,
  },
  locationLoadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.slate200,
    ...shadows.card,
  },
  locationLoadingText: {
    fontSize: 13,
    color: colors.slate600,
    fontWeight: '600',
  },
  locationActiveCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.md + 2,
    borderWidth: 1,
    borderColor: colors.forest200,
    ...shadows.card,
  },
  locationTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationCoordBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationCoords: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.slate900,
  },
  locationSourceBadge: {
    backgroundColor: colors.forest100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.round,
  },
  sourceBadgeAmber: {
    backgroundColor: colors.amber100,
  },
  sourceBadgeBlue: {
    backgroundColor: colors.sky100,
  },
  locationSourceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.forest800,
  },
  sourceTextAmber: {
    color: colors.amber700,
  },
  sourceTextBlue: {
    color: colors.sky700,
  },
  locationMetaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.sm,
  },
  locationDetailText: {
    fontSize: 11.5,
    color: colors.slate500,
  },
  locationActiveActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  refreshLocButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.forest50,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    gap: 6,
  },
  refreshLocButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.forest700,
  },
  pickOnMapButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.slate100,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    gap: 6,
  },
  pickOnMapButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate700,
  },
  locationPromptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.md + 2,
    borderWidth: 1,
    borderColor: colors.slate200,
    ...shadows.card,
  },
  locationAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm + 2,
    backgroundColor: colors.slate50,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  locationAlertText: {
    flex: 1,
    fontSize: 12,
    color: colors.slate700,
    lineHeight: 16,
  },
  locationActionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  acquireGpsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.forest700,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    gap: 8,
  },
  acquireGpsButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  manualFallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.slate100,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  manualFallbackButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate700,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.forest700,
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    gap: 8,
    marginBottom: spacing.lg,
    ...shadows.fab,
  },
  submitButtonDisabled: {
    opacity: 0.65,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.hero,
  },
  confirmIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.forest100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.slate900,
    marginBottom: 4,
    textAlign: 'center',
  },
  confirmSubtitle: {
    fontSize: 13,
    color: colors.slate600,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  confirmDetailsBox: {
    width: '100%',
    backgroundColor: colors.slate50,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: 8,
    marginBottom: spacing.xl,
  },
  confirmDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmLabel: {
    fontSize: 12.5,
    color: colors.slate500,
    fontWeight: '600',
  },
  confirmValue: {
    fontSize: 13,
    color: colors.slate800,
    fontWeight: '700',
  },
  confirmIdText: {
    fontSize: 11.5,
    fontFamily: 'monospace',
    color: colors.slate600,
  },
  pendingBadge: {
    backgroundColor: colors.amber100,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.round,
  },
  pendingBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.amber800,
  },
  confirmActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmSecondaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmSecondaryText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.slate700,
  },
  confirmPrimaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    backgroundColor: colors.forest700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmPrimaryText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
