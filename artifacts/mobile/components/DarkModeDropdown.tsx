import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, ThemeMode } from '@/context/ThemeContext';

interface DarkModeDropdownProps {
  /**
   * Layout style variant:
   * - 'dropdown': compact button that opens modal menu (default)
   * - 'segmented': horizontal row of segment buttons
   * - 'card': full width card row with selector
   */
  variant?: 'dropdown' | 'segmented' | 'card';
  showLabel?: boolean;
  label?: string;
}

interface ModeOption {
  id: ThemeMode;
  label: string;
  sublabel: string;
  icon: keyof typeof Feather.glyphMap;
}

const OPTIONS: ModeOption[] = [
  {
    id: 'system',
    label: 'System Default',
    sublabel: 'Matches device appearance',
    icon: 'smartphone',
  },
  {
    id: 'light',
    label: 'Light Mode',
    sublabel: 'Clean, high-contrast light theme',
    icon: 'sun',
  },
  {
    id: 'dark',
    label: 'Dark Mode',
    sublabel: 'Sleek, eye-friendly dark theme',
    icon: 'moon',
  },
];

export function DarkModeDropdown({
  variant = 'dropdown',
  showLabel = true,
  label = 'Theme',
}: DarkModeDropdownProps) {
  const { themeMode, setThemeMode, colors, isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const currentOption = OPTIONS.find((opt) => opt.id === themeMode) ?? OPTIONS[0];

  const handleSelectMode = async (mode: ThemeMode) => {
    Haptics.selectionAsync();
    await setThemeMode(mode);
    setIsOpen(false);
  };

  const currentIcon =
    themeMode === 'system' ? 'smartphone' : themeMode === 'dark' ? 'moon' : 'sun';

  if (variant === 'segmented') {
    return (
      <View
        style={[
          styles.segmentedContainer,
          {
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
            borderColor: colors.border,
            borderRadius: colors.radius,
          },
        ]}
      >
        {OPTIONS.map((opt) => {
          const isSelected = themeMode === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => handleSelectMode(opt.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={({ pressed }) => [
                styles.segmentedSegment,
                {
                  backgroundColor: isSelected
                    ? colors.card
                    : pressed
                    ? colors.secondary
                    : 'transparent',
                  borderRadius: colors.radius - 3,
                },
                isSelected && styles.segmentedActiveShadow,
              ]}
            >
              <Feather
                name={opt.icon}
                size={15}
                color={isSelected ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.segmentedText,
                  {
                    color: isSelected ? colors.foreground : colors.mutedForeground,
                    fontFamily: isSelected ? 'Inter_600SemiBold' : 'Inter_500Medium',
                  },
                ]}
              >
                {opt.label.replace(' Mode', '').replace(' Default', '')}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (variant === 'card') {
    return (
      <View
        style={[
          styles.cardContainer,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + '18' }]}>
            <Feather name={currentIcon} size={18} color={colors.primary} />
          </View>
          <View style={styles.cardTextGroup}>
            <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              Appearance & Theme
            </Text>
            <Text style={[styles.cardSubtitle, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              Active: {currentOption.label} ({currentOption.sublabel})
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.segmentedContainer,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
              borderColor: colors.border,
              borderRadius: colors.radius,
              marginTop: 12,
            },
          ]}
        >
          {OPTIONS.map((opt) => {
            const isSelected = themeMode === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => handleSelectMode(opt.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => [
                  styles.segmentedSegment,
                  {
                    backgroundColor: isSelected
                      ? colors.background
                      : pressed
                      ? colors.secondary
                      : 'transparent',
                    borderRadius: colors.radius - 3,
                  },
                  isSelected && styles.segmentedActiveShadow,
                ]}
              >
                <Feather
                  name={opt.icon}
                  size={15}
                  color={isSelected ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.segmentedText,
                    {
                      color: isSelected ? colors.foreground : colors.mutedForeground,
                      fontFamily: isSelected ? 'Inter_600SemiBold' : 'Inter_500Medium',
                    },
                  ]}
                >
                  {opt.label.replace(' Mode', '').replace(' Default', '')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  // Default dropdown variant
  return (
    <View style={styles.dropdownWrapper}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          setIsOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Theme switcher: ${currentOption.label}`}
        style={({ pressed }) => [
          styles.triggerBtn,
          {
            backgroundColor: pressed ? colors.secondary : colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
          },
        ]}
      >
        <Feather name={currentIcon} size={16} color={colors.primary} />
        {showLabel && (
          <Text
            style={[
              styles.triggerText,
              { color: colors.foreground, fontFamily: 'Inter_500Medium' },
            ]}
          >
            {currentOption.label}
          </Text>
        )}
        <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.modalContent,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: colors.radius + 4,
                  },
                ]}
              >
                <View style={styles.modalHeader}>
                  <View style={styles.modalTitleGroup}>
                    <Text
                      style={[
                        styles.modalTitle,
                        { color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
                      ]}
                    >
                      Theme Mode
                    </Text>
                    <Text
                      style={[
                        styles.modalSub,
                        { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
                      ]}
                    >
                      Choose your preferred app appearance
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setIsOpen(false)}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.closeBtn,
                      { backgroundColor: pressed ? colors.secondary : 'transparent' },
                    ]}
                  >
                    <Feather name="x" size={18} color={colors.mutedForeground} />
                  </Pressable>
                </View>

                <View style={styles.optionsList}>
                  {OPTIONS.map((opt) => {
                    const isSelected = themeMode === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => handleSelectMode(opt.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        style={({ pressed }) => [
                          styles.optionItem,
                          {
                            backgroundColor: isSelected
                              ? colors.primary + '12'
                              : pressed
                              ? colors.secondary
                              : 'transparent',
                            borderColor: isSelected ? colors.primary + '40' : colors.border,
                            borderRadius: colors.radius,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.optionIconBox,
                            {
                              backgroundColor: isSelected
                                ? colors.primary
                                : isDark
                                ? 'rgba(255,255,255,0.08)'
                                : 'rgba(0,0,0,0.05)',
                            },
                          ]}
                        >
                          <Feather
                            name={opt.icon}
                            size={18}
                            color={isSelected ? colors.primaryForeground : colors.mutedForeground}
                          />
                        </View>

                        <View style={styles.optionTextGroup}>
                          <Text
                            style={[
                              styles.optionLabel,
                              {
                                color: isSelected ? colors.primary : colors.foreground,
                                fontFamily: isSelected ? 'Inter_600SemiBold' : 'Inter_500Medium',
                              },
                            ]}
                          >
                            {opt.label}
                          </Text>
                          <Text
                            style={[
                              styles.optionSublabel,
                              {
                                color: colors.mutedForeground,
                                fontFamily: 'Inter_400Regular',
                              },
                            ]}
                          >
                            {opt.sublabel}
                          </Text>
                        </View>

                        {isSelected && (
                          <View
                            style={[
                              styles.checkBadge,
                              { backgroundColor: colors.primary + '20' },
                            ]}
                          >
                            <Feather name="check" size={16} color={colors.primary} />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  dropdownWrapper: {
    position: 'relative',
  },
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  triggerText: {
    fontSize: 13,
  },
  segmentedContainer: {
    flexDirection: 'row',
    padding: 3,
    borderWidth: 1,
  },
  segmentedSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  segmentedActiveShadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      },
    }),
  },
  segmentedText: {
    fontSize: 12,
  },
  cardContainer: {
    padding: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextGroup: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    padding: 20,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.25)',
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitleGroup: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
  },
  modalSub: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
  },
  optionsList: {
    gap: 10,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    gap: 12,
  },
  optionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextGroup: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 14,
  },
  optionSublabel: {
    fontSize: 12,
    marginTop: 2,
  },
  checkBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
