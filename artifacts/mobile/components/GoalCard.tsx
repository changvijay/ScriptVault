import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Goal } from '@/types';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface Props {
  goal: Goal;
  onPress: () => void;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function GoalCard({ goal, onPress }: Props) {
  const colors = useColors();
  const progress = Math.min(1, goal.targetValue > 0 ? goal.currentProgress / goal.targetValue : 0);
  const pct = Math.round(progress * 100);

  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(widthAnim, {
      toValue: progress,
      useNativeDriver: false,
      tension: 40,
      friction: 8,
    }).start();
  }, [progress]);

  const isOverdue =
    goal.deadline && !goal.completed && new Date(goal.deadline) < new Date();

  const formatDeadline = (iso: string) => {
    const d = new Date(iso);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };

  const barColor = goal.completed
    ? colors.completed
    : pct >= 75
    ? colors.primary
    : pct >= 40
    ? colors.inProgress
    : colors.mutedForeground;

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
          borderColor: goal.completed ? colors.completed + '60' : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.title, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}
            numberOfLines={2}
          >
            {goal.title}
          </Text>
          {goal.deadline && (
            <View style={styles.deadlineRow}>
              <Feather
                name="calendar"
                size={11}
                color={isOverdue ? colors.destructive : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.deadlineText,
                  {
                    color: isOverdue ? colors.destructive : colors.mutedForeground,
                    fontFamily: 'Inter_400Regular',
                  },
                ]}
              >
                {formatDeadline(goal.deadline)}
              </Text>
            </View>
          )}
        </View>
        {goal.completed ? (
          <View style={[styles.completedBadge, { backgroundColor: colors.completed }]}>
            <Feather name="check" size={14} color="#FFFFFF" />
          </View>
        ) : (
          <Text
            style={[styles.pct, { color: colors.primary, fontFamily: 'Inter_700Bold' }]}
          >
            {pct}%
          </Text>
        )}
      </View>

      {/* Progress bar */}
      <View style={[styles.barBg, { backgroundColor: colors.muted, borderRadius: 6 }]}>
        <Animated.View
          style={[
            styles.barFill,
            {
              backgroundColor: barColor,
              borderRadius: 6,
              width: widthAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      <Text style={[styles.count, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
        {goal.currentProgress} of {goal.targetValue}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 5,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deadlineText: {
    fontSize: 12,
  },
  pct: {
    fontSize: 22,
    fontWeight: '700',
  },
  completedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barBg: {
    height: 8,
    width: '100%',
  },
  barFill: {
    height: 8,
  },
  count: {
    fontSize: 12,
  },
});
