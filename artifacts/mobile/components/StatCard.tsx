import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface Props {
  label: string;
  value: number | string;
  accent?: string;
  small?: boolean;
  inline?: boolean;
}

export function StatCard({ label, value, accent, small, inline }: Props) {
  const colors = useColors();
  const accentColor = accent ?? colors.primary;

  if (inline) {
    return (
      <View style={styles.inlineChip}>
        <View style={[styles.inlineDot, { backgroundColor: accentColor }]} />
        <Text style={[styles.inlineValue, { color: accentColor, fontFamily: 'Inter_700Bold' }]}>
          {value}
        </Text>
        <Text style={[styles.inlineLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          {label}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          borderColor: colors.border,
          flex: 1,
        },
      ]}
    >
      <Text
        style={[
          styles.value,
          {
            color: accentColor,
            fontSize: small ? 22 : 28,
            fontFamily: 'Inter_700Bold',
          },
        ]}
      >
        {value}
      </Text>
      <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderWidth: 1,
    alignItems: 'flex-start',
    gap: 2,
  },
  value: {
    fontWeight: '700',
  },
  label: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Inline chip variant
  inlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  inlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  inlineValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  inlineLabel: {
    fontSize: 12,
  },
});
