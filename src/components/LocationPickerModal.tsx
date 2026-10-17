import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CleanSpotMap } from './CleanSpotMap';
import { formatCoordinates } from '../models';
import { locationService } from '../services';
import { colors, spacing, shadows } from '../utils/theme';

export interface LocationPickerModalProps {
  visible: boolean;
  initialLocation?: { latitude: number; longitude: number } | null;
  onConfirm: (coords: { latitude: number; longitude: number }) => void;
  onClose: () => void;
}

export function LocationPickerModal({
  visible,
  initialLocation,
  onConfirm,
  onClose,
}: LocationPickerModalProps) {
  // Default coordinates fallback (Bangalore)
  const defaultCoords = { latitude: 12.9716, longitude: 77.5946 };

  const [selectedCoords, setSelectedCoords] = useState<{ latitude: number; longitude: number }>(
    initialLocation ?? defaultCoords
  );
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (visible) {
      if (initialLocation) {
        setSelectedCoords(initialLocation);
      }
    }
  }, [visible, initialLocation]);

  const handleUseCurrentGps = async () => {
    try {
      setIsLocating(true);
      const res = await locationService.acquireLocationForReport({ timeoutMs: 4000 });
      if (res.location) {
        setSelectedCoords({
          latitude: res.location.latitude,
          longitude: res.location.longitude,
        });
      }
    } catch (err) {
      console.warn('[LocationPickerModal] GPS acquisition failed:', err);
    } finally {
      setIsLocating(false);
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedCoords);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={24} color={colors.slate700} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Select Location</Text>
            <Text style={styles.headerSubtitle}>Tap anywhere on the map to place the pin</Text>
          </View>
          <TouchableOpacity
            style={[styles.locateButton, isLocating && styles.locateButtonDisabled]}
            onPress={handleUseCurrentGps}
            disabled={isLocating}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color={colors.forest700} />
            ) : (
              <Ionicons name="locate" size={20} color={colors.forest700} />
            )}
          </TouchableOpacity>
        </View>

        {/* Interactive Map */}
        <View style={styles.mapContainer}>
          <CleanSpotMap
            mode="select"
            selectedLocation={selectedCoords}
            onSelectLocation={setSelectedCoords}
            initialCenter={{
              latitude: selectedCoords.latitude,
              longitude: selectedCoords.longitude,
              zoom: 15,
            }}
          />
        </View>

        {/* Bottom Coordinates & Action Panel */}
        <View style={styles.bottomPanel}>
          <View style={styles.coordsInfoRow}>
            <View style={styles.coordPinIcon}>
              <Ionicons name="pin" size={20} color={colors.forest700} />
            </View>
            <View style={styles.coordTexts}>
              <Text style={styles.coordsTitle}>Selected Coordinates</Text>
              <Text style={styles.coordsValue}>
                {formatCoordinates(selectedCoords.latitude, selectedCoords.longitude)}
              </Text>
              <Text style={styles.coordsSubtext}>
                Lat: {selectedCoords.latitude.toFixed(6)}, Lng: {selectedCoords.longitude.toFixed(6)}
              </Text>
            </View>
          </View>

          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              activeOpacity={0.8}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.confirmButton}
              activeOpacity={0.85}
              onPress={handleConfirm}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.confirmButtonText}>Set This Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    backgroundColor: '#FFFFFF',
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.slate900,
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.slate500,
    marginTop: 2,
  },
  locateButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.forest50,
    borderWidth: 1,
    borderColor: colors.forest200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locateButtonDisabled: {
    opacity: 0.6,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: colors.slate100,
  },
  bottomPanel: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
    ...shadows.card,
  },
  coordsInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  coordPinIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.forest50,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.forest200,
  },
  coordTexts: {
    flex: 1,
  },
  coordsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  coordsValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.slate900,
    marginTop: 1,
  },
  coordsSubtext: {
    fontSize: 11,
    color: colors.slate400,
    marginTop: 1,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.slate700,
  },
  confirmButton: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.forest700,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    ...shadows.card,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
