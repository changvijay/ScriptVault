import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Modal } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Script, Category, ScriptStatus } from '@/types';
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

export function CompactScriptRow({ script, categories, onPress, onStatusChange }: Props) {
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

  const formatDeadline = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Find the first category to show as a subtle color accent
  const firstCat = categories.find(c => script.categoryIds.includes(c.id));

  return (
    <>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          onPress();
        }}
        onLongPress={() => {
          if (onStatusChange) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setStatusModalOpen(true);
          }
        }}
        delayLongPress={400}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: pressed ? colors.card : 'transparent',
            borderBottomColor: colors.border,
          },
        ]}
      >
        {/* Status dot */}
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />

        {/* Title */}
        <Text
          style={[styles.title, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}
          numberOfLines={1}
        >
          {script.title}
        </Text>

        {/* Category dot (optional, very subtle) */}
        {firstCat && (
          <View style={[styles.catDot, { backgroundColor: firstCat.color + '60' }]} />
        )}

        {/* Deadline badge */}
        {script.deadline && (
          <View style={[styles.deadlineBadge, { backgroundColor: isOverdue ? colors.destructive + '15' : colors.muted }]}>
            <Text
              style={[
                styles.deadlineText,
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

        {/* Chevron */}
        <Feather name="chevron-right" size={14} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
      </Pressable>

      {/* Status change modal — same as ScriptCard */}
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
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    flexShrink: 0,
  },
  title: {
    fontSize: 14,
    flex: 1,
    letterSpacing: -0.2,
  },
  catDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    flexShrink: 0,
  },
  deadlineBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  deadlineText: {
    fontSize: 11,
  },
  // Modal styles (shared with ScriptCard)
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
    fontSize: 15,
  },
});
