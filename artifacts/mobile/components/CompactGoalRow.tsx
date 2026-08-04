import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Goal } from '@/types';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface Props {
  goal: Goal;
  onPress: () => void;
  onIncrement?: () => void;
}

export function CompactGoalRow({ goal, onPress, onIncrement }: Props) {
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
        styles.row,
        {
          borderBottomColor: colors.border,
          backgroundColor: pressed ? colors.card : 'transparent',
        },
      ]}
    >
      {/* Title + progress */}
      <View style={styles.main}>
        <View style={styles.topLine}>
          <Text
            style={[styles.title, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}
            numberOfLines={1}
          >
            {goal.title}
          </Text>
          <Text
            style={[styles.pct, { color: goal.completed ? colors.completed : colors.primary, fontFamily: 'Inter_700Bold' }]}
          >
            {goal.completed ? '✓' : `${pct}%`}
          </Text>
        </View>

        {/* Thin progress bar */}
        <View style={[styles.barBg, { backgroundColor: colors.muted }]}>
          <Animated.View
            style={[
              styles.barFill,
              {
                backgroundColor: barColor,
                width: widthAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      </View>

      {/* Increment button */}
      {onIncrement && !goal.completed && (
        <Pressable
          hitSlop={10}
          onPress={(e) => {
            e.stopPropagation?.();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onIncrement();
          }}
          style={[styles.incrementBtn, { backgroundColor: colors.primary + '15' }]}
        >
          <Feather name="plus" size={14} color={colors.primary} />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  main: {
    flex: 1,
    gap: 6,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 14,
    flex: 1,
    letterSpacing: -0.2,
  },
  pct: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 0,
  },
  barBg: {
    height: 4,
    borderRadius: 2,
    width: '100%',
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },
  incrementBtn: {
    padding: 6,
    borderRadius: 8,
    flexShrink: 0,
  },
});
