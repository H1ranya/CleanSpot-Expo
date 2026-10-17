import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WasteCategory } from '../models';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';

export interface WasteCategoryPickerProps {
  categories: readonly WasteCategory[] | WasteCategory[];
  selectedId: string | null;
  columns?: number;
  disabled?: boolean;
  onSelect?: (id: string) => void;
  onLongPress?: (id: string) => void;
}

/**
 * Custom scratch-built Grid WasteCategoryPicker.
 * 
 * Features:
 * - Configurable dynamic column layout (e.g. 2, 3, or 4 columns)
 * - Clear selected state with accent borders and check badge
 * - Full disabled state handling
 * - Single tap invokes onSelect
 * - Long press invokes onLongPress and opens detailed disposal guidance
 */
export function WasteCategoryPicker({
  categories,
  selectedId,
  columns = 2,
  disabled = false,
  onSelect,
  onLongPress,
}: WasteCategoryPickerProps) {
  const [activeInfoCategory, setActiveInfoCategory] = useState<WasteCategory | null>(null);

  // Compute percentage width for each tile based on columns and gaps
  const columnCount = Math.max(1, Math.min(columns, 6));
  // Using flexWrap with a percentage width:
  // e.g. for 2 columns with 10px gap: approx (100% - 10px) / 2
  const itemWidthPercent = `${Math.floor(100 / columnCount) - (columnCount > 1 ? 2 : 0)}%` as const;

  const handlePress = (category: WasteCategory) => {
    if (disabled) return;
    onSelect?.(category.id);
  };

  const handleLongPress = (category: WasteCategory) => {
    if (disabled) return;
    onLongPress?.(category.id);
    setActiveInfoCategory(category);
  };

  return (
    <View style={[styles.container, disabled && styles.containerDisabled]}>
      <View style={styles.grid}>
        {categories.map((cat) => {
          const isSelected = selectedId === cat.id;

          return (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.tile,
                { width: itemWidthPercent },
                isSelected && styles.tileSelected,
                disabled && styles.tileDisabled,
              ]}
              activeOpacity={disabled ? 1 : 0.75}
              disabled={disabled}
              onPress={() => handlePress(cat)}
              onLongPress={() => handleLongPress(cat)}
              delayLongPress={450}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, disabled }}
              accessibilityLabel={`${cat.name} waste category. Long press for disposal instructions.`}
            >
              {/* Selected indicator badge */}
              {isSelected && (
                <View style={styles.selectedBadge}>
                  <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                </View>
              )}

              {/* Category Icon */}
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: cat.backgroundColor },
                  isSelected && styles.iconContainerSelected,
                ]}
              >
                <Ionicons
                  name={cat.iconName as any}
                  size={24}
                  color={isSelected ? colors.forest700 : cat.color}
                />
              </View>

              {/* Category Label */}
              <Text
                style={[
                  styles.label,
                  isSelected && styles.labelSelected,
                  disabled && styles.labelDisabled,
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Disposal Info Modal triggered on long press */}
      <Modal
        visible={activeInfoCategory !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveInfoCategory(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setActiveInfoCategory(null)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            {activeInfoCategory && (
              <>
                <View style={styles.modalHeader}>
                  <View
                    style={[
                      styles.modalIconWrap,
                      { backgroundColor: activeInfoCategory.backgroundColor },
                    ]}
                  >
                    <Ionicons
                      name={activeInfoCategory.iconName as any}
                      size={28}
                      color={activeInfoCategory.color}
                    />
                  </View>
                  <View style={styles.modalTitleBlock}>
                    <Text style={styles.modalTitle}>{activeInfoCategory.name}</Text>
                    <Text style={styles.modalSubtitle}>Disposal Guidelines</Text>
                  </View>
                </View>

                <View style={styles.modalBody}>
                  <Text style={styles.modalDescription}>
                    {activeInfoCategory.description}
                  </Text>

                  {activeInfoCategory.disposalInfo && (
                    <View style={styles.disposalTipBox}>
                      <Ionicons
                        name="information-circle-outline"
                        size={18}
                        color={colors.forest700}
                        style={{ marginTop: 1 }}
                      />
                      <Text style={styles.disposalTipText}>
                        {activeInfoCategory.disposalInfo}
                      </Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.modalCloseButton}
                  activeOpacity={0.8}
                  onPress={() => setActiveInfoCategory(null)}
                >
                  <Text style={styles.modalCloseButtonText}>Understood</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  containerDisabled: {
    opacity: 0.6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  tile: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md + 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.slate200,
    position: 'relative',
    ...shadows.card,
  },
  tileSelected: {
    borderColor: colors.forest600,
    backgroundColor: colors.forest50,
    borderWidth: 2,
    shadowColor: colors.forest700,
    shadowOpacity: 0.15,
  },
  tileDisabled: {
    backgroundColor: colors.slate100,
    borderColor: colors.slate200,
  },
  selectedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.forest700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: borderRadius.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs + 2,
  },
  iconContainerSelected: {
    backgroundColor: colors.forest100,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.slate800,
    textAlign: 'center',
  },
  labelSelected: {
    color: colors.forest900,
    fontWeight: '800',
  },
  labelDisabled: {
    color: colors.slate400,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: spacing.xl,
    ...shadows.hero,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: spacing.md,
  },
  modalIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitleBlock: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.slate900,
  },
  modalSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate500,
    marginTop: 2,
  },
  modalBody: {
    marginBottom: spacing.lg,
  },
  modalDescription: {
    fontSize: 13,
    color: colors.slate600,
    lineHeight: 19,
    marginBottom: spacing.md,
  },
  disposalTipBox: {
    flexDirection: 'row',
    backgroundColor: colors.forest50,
    borderWidth: 1,
    borderColor: colors.forest200,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 4,
    gap: 8,
  },
  disposalTipText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.forest900,
    fontWeight: '500',
  },
  modalCloseButton: {
    backgroundColor: colors.forest700,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
