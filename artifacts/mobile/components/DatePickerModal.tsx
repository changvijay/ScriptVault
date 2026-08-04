import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function daysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(month: number, year: number) {
  return new Date(year, month, 1).getDay();
}

interface Props {
  visible: boolean;
  date: Date | null;
  onConfirm: (date: Date) => void;
  onClose: () => void;
  minDate?: Date;
  blockPastDates?: boolean;
}

export function DatePickerModal({
  visible,
  date,
  minDate,
  blockPastDates = false,
  onConfirm,
  onClose,
}: Props) {
  const colors = useColors();
  const now = useMemo(() => new Date(), []);
  const initialDate = date || now;

  const [year, setYear] = useState(initialDate.getFullYear());
  const [month, setMonth] = useState(initialDate.getMonth());
  const [selectedDate, setSelectedDate] = useState(initialDate);

  // View mode: 'calendar' or 'selector' (Month/Year Picker)
  const [viewMode, setViewMode] = useState<'calendar' | 'selector'>('calendar');

  // Compute effective minimum allowed date
  const effectiveMinDate = useMemo(() => {
    if (blockPastDates) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    }
    if (minDate) {
      const min = new Date(minDate);
      min.setHours(0, 0, 0, 0);
      return min;
    }
    return null;
  }, [blockPastDates, minDate]);

  useEffect(() => {
    if (visible) {
      const d = date || new Date();
      setYear(d.getFullYear());
      setMonth(d.getMonth());
      setSelectedDate(d);
      setViewMode('calendar');
    }
  }, [visible, date]);

  const changeMonth = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    setMonth(newMonth);
    setYear(newYear);
  };

  const handleSelectDay = (day: number) => {
    const d = new Date(year, month, day);
    if (isDateDisabled(d)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.selectionAsync();
    setSelectedDate(d);

    // Auto-apply logic
    onConfirm(d);
    onClose();
  };

  const isDateDisabled = (d: Date) => {
    if (!effectiveMinDate) return false;
    const checkDate = new Date(d);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < effectiveMinDate;
  };

  const daysCount = daysInMonth(month, year);
  const firstDay = getFirstDayOfMonth(month, year);

  const gridCells = useMemo(() => {
    const cells = [];
    for (let i = 0; i < firstDay; i++) {
      cells.push(null);
    }
    for (let i = 1; i <= daysCount; i++) {
      cells.push(i);
    }
    return cells;
  }, [firstDay, daysCount]);

  // Generate a range of years for the selector mode
  const yearList = useMemo(() => {
    const startYear = effectiveMinDate ? effectiveMinDate.getFullYear() : now.getFullYear() - 10;
    const endYear = now.getFullYear() + 15;
    const years = [];
    for (let y = startYear; y <= endYear; y++) {
      years.push(y);
    }
    return years;
  }, [effectiveMinDate, now]);

  const formattedSelectedDate = `${SHORT_WEEKDAYS[selectedDate.getDay()]}, ${MONTHS[selectedDate.getMonth()].slice(0, 3)} ${selectedDate.getDate()}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.centerWrapper}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>

            {/* Context Header */}
            <View style={[styles.header, { backgroundColor: colors.primary }]}>
              <Text style={[styles.headerLabel, { color: colors.primaryForeground }]}>
                Selected Date
              </Text>
              <Text style={[styles.headerDate, { color: colors.primaryForeground }]}>
                {formattedSelectedDate}
              </Text>
            </View>

            {/* Navigation Bar */}
            <View style={styles.monthNav}>
              <Pressable
                onPress={() => setViewMode(viewMode === 'calendar' ? 'selector' : 'calendar')}
                style={({ pressed }) => [styles.titleToggle, pressed && { opacity: 0.7 }]}
              >
                <Text style={[styles.monthText, { color: colors.foreground }]}>
                  {MONTHS[month]} {year}
                </Text>
                <Feather
                  name={viewMode === 'selector' ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.foreground}
                />
              </Pressable>

              {viewMode === 'calendar' && (
                <View style={styles.navActions}>
                  <Pressable
                    onPress={() => changeMonth(-1)}
                    style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.5 }]}
                    hitSlop={15}
                  >
                    <Feather name="chevron-left" size={22} color={colors.foreground} />
                  </Pressable>
                  <View style={{ width: 12 }} />
                  <Pressable
                    onPress={() => changeMonth(1)}
                    style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.5 }]}
                    hitSlop={15}
                  >
                    <Feather name="chevron-right" size={22} color={colors.foreground} />
                  </Pressable>
                </View>
              )}
            </View>

            {/* VIEW MODE 1: Quick Year / Month Selector */}
            {viewMode === 'selector' ? (
              <View style={styles.selectorContainer}>
                <View style={styles.selectorColumn}>
                  <Text style={[styles.selectorTitle, { color: colors.mutedForeground }]}>Month</Text>
                  <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
                    {MONTHS.map((m, idx) => (
                      <Pressable
                        key={m}
                        onPress={() => {
                          setMonth(idx);
                          setViewMode('calendar');
                          Haptics.selectionAsync();
                        }}
                        style={[
                          styles.selectorItem,
                          month === idx && { backgroundColor: colors.primary + '20' },
                        ]}
                      >
                        <Text style={[
                          styles.selectorItemText,
                          { color: month === idx ? colors.primary : colors.foreground },
                          month === idx && { fontFamily: 'Inter_700Bold' },
                        ]}>
                          {m}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.selectorColumn}>
                  <Text style={[styles.selectorTitle, { color: colors.mutedForeground }]}>Year</Text>
                  <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
                    {yearList.map((y) => (
                      <Pressable
                        key={y}
                        onPress={() => {
                          setYear(y);
                          setViewMode('calendar');
                          Haptics.selectionAsync();
                        }}
                        style={[
                          styles.selectorItem,
                          year === y && { backgroundColor: colors.primary + '20' },
                        ]}
                      >
                        <Text style={[
                          styles.selectorItemText,
                          { color: year === y ? colors.primary : colors.foreground },
                          year === y && { fontFamily: 'Inter_700Bold' },
                        ]}>
                          {y}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </View>
            ) : (
              /* VIEW MODE 2: Calendar Grid */
              <>
                <View style={styles.weekdaysRow}>
                  {WEEKDAYS.map((wd) => (
                    <Text key={wd} style={[styles.weekdayText, { color: colors.mutedForeground }]}>
                      {wd}
                    </Text>
                  ))}
                </View>

                <View style={styles.daysGrid}>
                  {gridCells.map((day, idx) => {
                    if (day === null) {
                      return <View key={`empty-${idx}`} style={styles.dayCellContainer} />;
                    }

                    const d = new Date(year, month, day);
                    const disabled = isDateDisabled(d);
                    const isSelected =
                      selectedDate.getFullYear() === year &&
                      selectedDate.getMonth() === month &&
                      selectedDate.getDate() === day;
                    const isToday =
                      now.getFullYear() === year &&
                      now.getMonth() === month &&
                      now.getDate() === day;

                    return (
                      <View key={day} style={styles.dayCellContainer}>
                        <Pressable
                          onPress={() => handleSelectDay(day)}
                          style={({ pressed }) => [
                            styles.dayCell,
                            isSelected && { backgroundColor: colors.primary },
                            pressed && !disabled && !isSelected && { backgroundColor: colors.muted },
                            disabled && styles.disabledDayCell, // Applied red box styling
                          ]}
                        >
                          <Text style={[
                            styles.dayText,
                            {
                              color: isSelected
                                ? colors.primaryForeground
                                : disabled
                                  ? '#ef4444' // Red text for disabled
                                  : colors.foreground,
                              fontFamily: isSelected
                                ? 'Inter_700Bold'
                                : isToday
                                  ? 'Inter_600SemiBold'
                                  : 'Inter_400Regular',
                              opacity: disabled ? 0.7 : 1,
                            },
                          ]}>
                            {day}
                          </Text>
                          {isToday && !isSelected && !disabled && (
                            <View style={[styles.todayDot, { backgroundColor: colors.primary }]} />
                          )}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {/* Footer Actions (Apply removed, only Cancel remains) */}
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.footerBtn, pressed && { backgroundColor: colors.muted }]}
              >
                <Text style={[styles.footerBtnText, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>
                  {viewMode === 'selector' ? 'Back / Cancel' : 'Cancel'}
                </Text>
              </Pressable>
            </View>

          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  centerWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 15,
  },
  header: {
    padding: 20,
    paddingBottom: 16,
  },
  headerLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerDate: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  titleToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navBtn: {
    padding: 4,
  },
  selectorContainer: {
    flexDirection: 'row',
    height: 240,
    paddingHorizontal: 16,
  },
  selectorColumn: {
    flex: 1,
    paddingHorizontal: 4,
  },
  selectorTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    marginBottom: 8,
    textAlign: 'center',
  },
  scrollList: {
    flex: 1,
  },
  selectorItem: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 2,
  },
  selectorItemText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  weekdaysRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  dayCellContainer: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCell: {
    width: '85%',
    height: '85%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 999, // default circle for valid active days
  },
  disabledDayCell: {
    borderRadius: 6, // Square box 
    backgroundColor: 'rgba(239, 68, 68, 0.12)', // Light red background
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)', // Red border
  },
  dayText: {
    fontSize: 14,
  },
  todayDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnText: {
    fontSize: 15,
  },
});