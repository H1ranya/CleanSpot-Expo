import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { imageService } from '../services/ImageService';
import { colors, spacing, borderRadius } from '../utils/theme';

export interface CameraCaptureModalProps {
  visible: boolean;
  onClose: () => void;
  onPhotoCaptured: (processedPhotoUri: string) => void;
}

export function CameraCaptureModal({
  visible,
  onClose,
  onPhotoCaptured,
}: CameraCaptureModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  const cameraRef = useRef<CameraView>(null);

  // Handle capture action
  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) {
      return;
    }

    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });

      if (photo?.uri) {
        setCapturedPreview(photo.uri);
      } else {
        Alert.alert('Camera Error', 'Could not capture photo. Please try again.');
      }
    } catch (error) {
      console.error('[CameraModal] Capture error:', error);
      Alert.alert(
        'Capture Failed',
        'An error occurred while capturing the photo. Please check your camera hardware.'
      );
    } finally {
      setIsCapturing(false);
    }
  };

  // Confirm photo: delegates processing & storage to ImageService
  const handleConfirmPhoto = async () => {
    if (!capturedPreview || isProcessing) {
      return;
    }

    try {
      setIsProcessing(true);
      // Process: resize ~1024px, compress JPEG 65%, store in permanent offline directory
      const processed = await imageService.processAndStorePhoto(capturedPreview);

      // Reset state and notify caller with the persistent local file reference
      setCapturedPreview(null);
      onPhotoCaptured(processed.uri);
      onClose();
    } catch (error) {
      console.error('[CameraModal] Processing error:', error);
      Alert.alert(
        'Processing Error',
        'Failed to process and store the image. Please try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Discard preview and retake
  const handleRetake = () => {
    setCapturedPreview(null);
  };

  // Toggle front/back lens
  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  // Render permission denial screen
  const renderPermissionState = () => {
    if (!permission) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.forest500} />
          <Text style={styles.permissionSubtext}>Checking camera permissions...</Text>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.centerContainer}>
          <View style={styles.permissionIconCircle}>
            <Ionicons name="camera-outline" size={40} color={colors.amber600} />
          </View>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionDescription}>
            CleanSpot requires camera access to capture evidence of illegal dumping and overflowing bins. Gallery selection is not permitted.
          </Text>

          <TouchableOpacity
            style={styles.permissionButton}
            activeOpacity={0.8}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelTextButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {!permission?.granted ? (
          renderPermissionState()
        ) : capturedPreview ? (
          // Review captured preview
          <View style={styles.previewContainer}>
            <Image source={{ uri: capturedPreview }} style={styles.previewImage} />

            {/* Top Bar */}
            <View style={styles.previewTopBar}>
              <Text style={styles.previewTitle}>Review Evidence</Text>
            </View>

            {/* Bottom Actions */}
            <View style={styles.previewBottomBar}>
              <TouchableOpacity
                style={styles.retakeButton}
                activeOpacity={0.7}
                onPress={handleRetake}
                disabled={isProcessing}
              >
                <Ionicons name="refresh-outline" size={20} color="#FFFFFF" />
                <Text style={styles.retakeButtonText}>Retake</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmButton}
                activeOpacity={0.85}
                onPress={handleConfirmPhoto}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={22} color="#FFFFFF" />
                    <Text style={styles.confirmButtonText}>Use Photo</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // Active Camera View with absolute overlay controls
          <View style={styles.cameraContainer}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={facing}
            />

            <View style={styles.overlayContainer} pointerEvents="box-none">
              {/* Top Controls: Close & Flip */}
              <View style={styles.cameraHeader}>
                <TouchableOpacity
                  style={styles.circularControl}
                  activeOpacity={0.7}
                  onPress={onClose}
                >
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>

                <View style={styles.cameraBadge}>
                  <Text style={styles.cameraBadgeText}>EVIDENCE CAPTURE</Text>
                </View>

                <TouchableOpacity
                  style={styles.circularControl}
                  activeOpacity={0.7}
                  onPress={toggleCameraFacing}
                >
                  <Ionicons name="camera-reverse-outline" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Viewfinder crosshairs guide */}
              <View style={styles.viewfinderCenter} pointerEvents="none">
                <View style={styles.viewfinderFrame} />
              </View>

              {/* Bottom Shutter Controls */}
              <View style={styles.shutterBar}>
                <TouchableOpacity
                  style={[
                    styles.shutterOuterCircle,
                    isCapturing && styles.shutterDisabled,
                  ]}
                  activeOpacity={0.8}
                  onPress={handleCapture}
                  disabled={isCapturing}
                >
                  <View style={styles.shutterInnerCircle}>
                    {isCapturing && (
                      <ActivityIndicator size="small" color={colors.forest700} />
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000000',
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 54,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  circularControl: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    backgroundColor: 'rgba(21, 128, 61, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: borderRadius.round,
  },
  cameraBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  viewfinderCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinderFrame: {
    width: '80%',
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 20,
    borderStyle: 'dashed',
  },
  shutterBar: {
    paddingBottom: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuterCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  shutterDisabled: {
    opacity: 0.6,
  },
  shutterInnerCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  previewImage: {
    flex: 1,
    resizeMode: 'cover',
  },
  previewTopBar: {
    position: 'absolute',
    top: 54,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: borderRadius.round,
  },
  previewBottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    gap: 8,
  },
  retakeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.forest700,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  permissionIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.amber100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.slate900,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  permissionDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.slate600,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  permissionButton: {
    backgroundColor: colors.forest700,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  permissionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelTextButton: {
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.slate500,
  },
  permissionSubtext: {
    fontSize: 14,
    color: colors.slate600,
    marginTop: spacing.md,
  },
});
