import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Script, Category } from '@/types';
import { CategoryBadge } from './CategoryBadge';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface Props {
  script: Script;
  categories: Category[];
  onPress: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export function ScriptCard({ script, categories, onPress }: Props) {
  const colors = useColors();

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

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

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
          borderRadius: colors.radius,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {/* Status bar */}
      <View style={[styles.statusBar, { backgroundColor: statusColor }]} />

      <View style={styles.content}>
        {/* Top row */}
        <View style={styles.topRow}>
          <Text
            style={[styles.title, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}
            numberOfLines={1}
          >
            {script.title}
          </Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
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

        {/* Categories */}
        {scriptCategories.length > 0 && (
          <View style={styles.badges}>
            {scriptCategories.map(cat => (
              <CategoryBadge key={cat.id} name={cat.name} color={cat.color} small />
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={[styles.statusPill, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor, fontFamily: 'Inter_500Medium' }]}>
              {STATUS_LABELS[script.status]}
            </Text>
          </View>

          <View style={styles.footerRight}>
            {script.deadline && (
              <View style={styles.deadlineRow}>
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
                      fontFamily: 'Inter_400Regular',
                    },
                  ]}
                >
                  {formatDeadline(script.deadline)}
                  {isOverdue ? ' · Overdue' : ''}
                </Text>
              </View>
            )}
            {(script.voiceNotes.length > 0 || script.videoNotes.length > 0) && (
              <View style={styles.mediaIcons}>
                {script.voiceNotes.length > 0 && (
                  <Feather name="mic" size={12} color={colors.mutedForeground} />
                )}
                {script.videoNotes.length > 0 && (
                  <Feather name="video" size={12} color={colors.mutedForeground} />
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    marginHorizontal: 16,
    marginVertical: 5,
  },
  statusBar: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  notes: {
    fontSize: 13,
    lineHeight: 19,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  deadline: {
    fontSize: 11,
  },
  mediaIcons: {
    flexDirection: 'row',
    gap: 5,
  },
});
