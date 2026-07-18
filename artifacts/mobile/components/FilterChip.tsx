import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';

interface Props {
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string;
}

export function FilterChip({ label, active, onPress, color }: Props) {
  const colors = useColors();
  const activeColor = color ?? colors.primary;

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? activeColor : colors.muted,
          borderColor: active ? activeColor : colors.border,
          opacity: pressed ? 0.75 : 1,
          borderRadius: 20,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: active ? '#FFFFFF' : colors.mutedForeground,
            fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular',
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
  },
  label: {
    fontSize: 13,
  },
});
