import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function daysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

interface Props {
  visible: boolean;
  date: Date | null;
  onConfirm: (date: Date) => void;
  onClose: () => void;
}

export function DatePickerModal({ visible, date, onConfirm, onClose }: Props) {
  const colors = useColors();
  const now = new Date();
  const [year, setYear] = useState(date ? date.getFullYear() : now.getFullYear());
  const [month, setMonth] = useState(date ? date.getMonth() : now.getMonth());
  const [day, setDay] = useState(date ? date.getDate() : now.getDate());

  const maxDay = daysInMonth(month, year);
  const safeDay = Math.min(day, maxDay);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20 }]}>
        {/* Header */}
        <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose}>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 15 }}>Cancel</Text>
          </Pressable>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 16 }}>Set Deadline</Text>
          <Pressable onPress={() => onConfirm(new Date(year, month, safeDay))}>
            <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>Done</Text>
          </Pressable>
        </View>

        {/* Pickers */}
        <View style={styles.pickersRow}>
          {/* Month */}
          <View style={styles.pickerCol}>
            <Pressable onPress={() => setMonth(m => Math.max(0, m - 1))} style={styles.arrowBtn}>
              <Feather name="chevron-up" size={20} color={colors.mutedForeground} />
            </Pressable>
            <Text style={[styles.pickerVal, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              {MONTHS[month].slice(0, 3)}
            </Text>
            <Pressable onPress={() => setMonth(m => Math.min(11, m + 1))} style={styles.arrowBtn}>
              <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
            </Pressable>
            <Text style={[styles.pickerLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>Month</Text>
          </View>

          {/* Day */}
          <View style={styles.pickerCol}>
            <Pressable onPress={() => setDay(d => Math.max(1, d - 1))} style={styles.arrowBtn}>
              <Feather name="chevron-up" size={20} color={colors.mutedForeground} />
            </Pressable>
            <Text style={[styles.pickerVal, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              {String(safeDay).padStart(2, '0')}
            </Text>
            <Pressable onPress={() => setDay(d => Math.min(maxDay, d + 1))} style={styles.arrowBtn}>
              <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
            </Pressable>
            <Text style={[styles.pickerLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>Day</Text>
          </View>

          {/* Year */}
          <View style={styles.pickerCol}>
            <Pressable onPress={() => setYear(y => y - 1)} style={styles.arrowBtn}>
              <Feather name="chevron-up" size={20} color={colors.mutedForeground} />
            </Pressable>
            <Text style={[styles.pickerVal, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              {year}
            </Text>
            <Pressable onPress={() => setYear(y => y + 1)} style={styles.arrowBtn}>
              <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
            </Pressable>
            <Text style={[styles.pickerLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>Year</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  pickersRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  pickerCol: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  arrowBtn: {
    padding: 8,
  },
  pickerVal: {
    fontSize: 24,
    fontWeight: '600',
  },
  pickerLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
});
