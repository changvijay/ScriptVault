import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  name: string;
  color: string;
  small?: boolean;
}

export function CategoryBadge({ name, color, small }: Props) {
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: color + '20',
          borderColor: color + '60',
          paddingHorizontal: small ? 6 : 8,
          paddingVertical: small ? 2 : 3,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text
        style={[
          styles.text,
          { color, fontSize: small ? 10 : 11, fontFamily: 'Inter_500Medium' },
        ]}
      >
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  text: {
    fontWeight: '500',
  },
});
