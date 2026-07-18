import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface Props {
  label: string;
  value: number | string;
  accent?: string;
  small?: boolean;
}

export function StatCard({ label, value, accent, small }: Props) {
  const colors = useColors();
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
            color: accent ?? colors.primary,
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
});
