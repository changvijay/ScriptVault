import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking, Platform, Modal } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Script, Category, ScriptStatus } from '@/types';
import { CategoryBadge } from './CategoryBadge';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface Props {
  script: Script;
  categories: Category[];
  onPress: () => void;
  onStatusChange?: (status: ScriptStatus) => void;
}

const STATUS_LABELS: Record<ScriptStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export function ScriptCard({ script, categories, onPress, onStatusChange }: Props) {
  const colors = useColors();
  const [statusModalOpen, setStatusModalOpen] = useState(false);

  const statusColor =
    script.status === 'completed'
      ? colors.completed
      : script.status === 'in_progress'
        ? colors.inProgress
        : colors.notStarted;

  const isOverdue =
    script.deadline &&
    script.status !== 'completed' &&
    new Date(script.deadline) < new Date();

  const scriptCategories = categories.filter(c => script.categoryIds.includes(c.id));

  const formatDeadline = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: 20,
          borderColor: colors.border,
          borderWidth: 1,
          opacity: pressed ? 0.95 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          ...Platform.select({
            ios: {
              shadowColor: colors.foreground,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.04,
              shadowRadius: 16,
            },
            android: { elevation: 2 },
          }),
        },
      ]}
    >
      <View style={styles.content}>
        {/* Top row */}
        <View style={styles.topRow}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
            <Text
              style={[styles.title, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}
              numberOfLines={1}
            >
              {script.title}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} opacity={0.5} />
        </View>

        {/* Notes snippet */}
        {script.notes.length > 0 && (
          <Text
            style={[styles.notes, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}
            numberOfLines={2}
          >
            {script.notes}
          </Text>
        )}

        {/* Reference Button */}
        {!!script.reference && (
          <View style={styles.referenceWrap}>
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                Linking.openURL(script.reference).catch(() => {});
              }}
              style={({ pressed }) => [
                styles.referenceBtn,
                { 
                  backgroundColor: pressed ? colors.primary + '10' : 'transparent', 
                  borderColor: colors.border 
                }
              ]}
            >
              <Feather name="link-2" size={12} color={colors.primary} />
              <Text style={[styles.referenceText, { color: colors.primary, fontFamily: 'Inter_500Medium' }]} numberOfLines={1}>
                {script.reference.replace(/^https?:\/\//, '')}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Categories */}
        {scriptCategories.length > 0 && (
          <View style={styles.badges}>
            {scriptCategories.map(cat => (
              <CategoryBadge key={cat.id} name={cat.name} color={cat.color} small />
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <Pressable
            hitSlop={10}
            onPress={(e) => {
              e.stopPropagation?.();
              if (onStatusChange) {
                setStatusModalOpen(true);
                Haptics.selectionAsync();
              }
            }}
          >
            <Text style={[styles.statusText, { color: statusColor, fontFamily: 'Inter_600SemiBold' }]}>
              {STATUS_LABELS[script.status]}
              {onStatusChange ? '  ▾' : ''}
            </Text>
          </Pressable>

          <View style={styles.footerRight}>
            {(script.voiceNotes.length > 0 || script.videoNotes.length > 0) && (
              <View style={styles.mediaIcons}>
                {script.voiceNotes.length > 0 && (
                  <Feather name="mic" size={14} color={colors.mutedForeground} />
                )}
                {script.videoNotes.length > 0 && (
                  <Feather name="video" size={14} color={colors.mutedForeground} />
                )}
              </View>
            )}
            
            {script.deadline && (
              <View style={[styles.deadlineRow, { backgroundColor: isOverdue ? colors.destructive + '15' : colors.muted }]}>
                <Feather
                  name="calendar"
                  size={11}
                  color={isOverdue ? colors.destructive : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.deadline,
                    {
                      color: isOverdue ? colors.destructive : colors.mutedForeground,
                      fontFamily: 'Inter_500Medium',
                    },
                  ]}
                >
                  {formatDeadline(script.deadline)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {onStatusChange && (
        <Modal visible={statusModalOpen} transparent animationType="fade" onRequestClose={() => setStatusModalOpen(false)}>
          <Pressable style={styles.dropdownOverlay} onPress={() => setStatusModalOpen(false)}>
            <View style={[styles.dropdownSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.dropdownSheetTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold', borderBottomColor: colors.border }]}>
                Change Status
              </Text>
              {(Object.keys(STATUS_LABELS) as ScriptStatus[]).map(statusKey => {
                const active = script.status === statusKey;
                return (
                  <Pressable
                    key={statusKey}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      setStatusModalOpen(false);
                      if (!active) {
                        onStatusChange(statusKey);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                    style={[
                      styles.dropdownOption,
                      {
                        backgroundColor: active ? colors.primary + '15' : 'transparent',
                        borderBottomColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.dropdownOptionName, { color: colors.foreground, fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>
                      {STATUS_LABELS[statusKey]}
                    </Text>
                    {active && <Feather name="check" size={16} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Modal>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    overflow: 'visible',
  },
  content: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 16,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    fontSize: 17,
    flex: 1,
    letterSpacing: -0.3,
  },
  notes: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: -2,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  referenceWrap: {
    alignItems: 'flex-start',
  },
  referenceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  referenceText: {
    fontSize: 12,
    flexShrink: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 2,
  },
  statusText: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  deadline: {
    fontSize: 11,
  },
  mediaIcons: {
    flexDirection: 'row',
    gap: 6,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  dropdownSheet: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dropdownSheetTitle: {
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dropdownOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dropdownOptionName: { 
    fontSize: 15 
  },
});;
