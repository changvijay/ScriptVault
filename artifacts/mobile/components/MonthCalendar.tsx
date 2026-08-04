import React, { useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
  PanResponder,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { Script, TodoItem, Category } from '@/types';

// ─── Constants ───────────────────────────────────────────────────────────────
const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type ViewMode = 'month' | 'week';

// Modern, slightly desaturated semantic palette — better contrast in both themes
const SCRIPT_COLOR = '#6366F1'; // indigo
const TODO_COLOR = '#10B981'; // emerald
const MIXED_COLOR = '#F59E0B'; // amber
const OVERDUE_COLOR = '#F43F5E'; // rose (softer than pure red, less alarming)

const { width: SCREEN_W } = Dimensions.get('window');
const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY = 0.3;

// ─── Types ────────────────────────────────────────────────────────────────────
interface CalendarEvent {
  id: string;
  title: string;
  type: 'script' | 'todo';
  dueDate: string;
  category?: string;
  status?: string;
  priority?: string;
  scriptId?: string;
}

interface DayCell {
  dateStr: string;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  scriptCount: number;
  todoCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function buildGrid(year: number, month: number): DayCell[] {
  const todayStr = toDateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const nowTs = new Date(todayStr).getTime();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const cells: DayCell[] = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const ds = toDateStr(prevYear, prevMonth, d);
    cells.push({ dateStr: ds, day: d, isCurrentMonth: false, isToday: false, isPast: true, scriptCount: 0, todoCount: 0 });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const ds = toDateStr(year, month, d);
    const ts = new Date(ds).getTime();
    cells.push({
      dateStr: ds, day: d, isCurrentMonth: true,
      isToday: ds === todayStr,
      isPast: ts < nowTs,
      scriptCount: 0, todoCount: 0,
    });
  }

  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    for (let d = 1; d <= remaining; d++) {
      const ds = toDateStr(nextYear, nextMonth, d);
      cells.push({ dateStr: ds, day: d, isCurrentMonth: false, isToday: false, isPast: false, scriptCount: 0, todoCount: 0 });
    }
  }

  return cells;
}

function getWeekStart(d: Date): Date {
  const nd = new Date(d);
  nd.setHours(0, 0, 0, 0);
  nd.setDate(nd.getDate() - nd.getDay()); // back up to Sunday
  return nd;
}

function buildWeekGrid(weekStart: Date): DayCell[] {
  const todayStr = toDateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const nowTs = new Date(todayStr).getTime();
  const cells: DayCell[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const ds = toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
    const ts = new Date(ds).getTime();
    cells.push({
      dateStr: ds,
      day: d.getDate(),
      isCurrentMonth: true, // always "active" in week view
      isToday: ds === todayStr,
      isPast: ts < nowTs,
      scriptCount: 0,
      todoCount: 0,
    });
  }
  return cells;
}

function formatWeekRange(weekStart: Date): { range: string; year: string } {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);

  const sameMonth = weekStart.getMonth() === end.getMonth();
  const sameYear = weekStart.getFullYear() === end.getFullYear();

  const range = sameMonth
    ? `${SHORT_MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}–${end.getDate()}`
    : `${SHORT_MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} – ${SHORT_MONTHS[end.getMonth()]} ${end.getDate()}`;

  const year = sameYear ? `${weekStart.getFullYear()}` : `${weekStart.getFullYear()}–${end.getFullYear()}`;

  return { range, year };
}

function badgeColor(scriptCount: number, todoCount: number, isPast: boolean, isCurrentMonth: boolean): string | null {
  if (!isCurrentMonth) return null;
  if (scriptCount === 0 && todoCount === 0) return null;
  if (isPast) return OVERDUE_COLOR;
  if (scriptCount > 0 && todoCount > 0) return MIXED_COLOR;
  if (scriptCount > 0) return SCRIPT_COLOR;
  return TODO_COLOR;
}

function formatModalDate(ds: string): string {
  const d = new Date(ds + 'T12:00:00');
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatWeekday(ds: string): string {
  const d = new Date(ds + 'T12:00:00');
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
}

// ─── Day Cell ─────────────────────────────────────────────────────────────────
const CELL_W = Math.floor((SCREEN_W - 32) / 7);
const WEEK_CELL_W = Math.floor((SCREEN_W - 64) / 7); // slightly narrower in week view for more luxurious padding

function DayCellView({
  cell,
  selected,
  colors,
  onPress,
}: {
  cell: DayCell;
  selected: boolean;
  colors: ReturnType<typeof useColors>;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, speed: 60, bounciness: 4 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 9 }).start();
  };

  const bc = badgeColor(cell.scriptCount, cell.todoCount, cell.isPast, cell.isCurrentMonth);
  const total = cell.scriptCount + cell.todoCount;
  const isDisabled = !cell.isCurrentMonth;

  const textColor = cell.isToday
    ? '#FFFFFF'
    : isDisabled
      ? colors.border
      : cell.isPast
        ? colors.mutedForeground
        : colors.foreground;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      hitSlop={2}
      accessibilityRole="button"
      accessibilityLabel={`${cell.day}${total > 0 ? `, ${total} item${total > 1 ? 's' : ''}` : ''}${cell.isToday ? ', today' : ''}`}
      style={[styles.cellOuter, { width: CELL_W, minHeight: CELL_W + 12 }]}
    >
      <Animated.View
        style={[
          styles.cellInner,
          {
            width: CELL_W - 6,
            height: CELL_W - 6,
            transform: [{ scale }],
          },
        ]}
      >
        {cell.isToday ? (
          <LinearGradient
            colors={[colors.primary, colors.primary + 'D9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.cellFill, styles.cellShadowToday]}
          >
            <Text style={[styles.dayNum, { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 15 }]}>
              {cell.day}
            </Text>
          </LinearGradient>
        ) : (
          <View
            style={[
              styles.cellFill,
              selected && styles.cellSelectedShadow,
              {
                backgroundColor: selected ? colors.primary + '12' : 'transparent',
                borderWidth: selected ? 1.5 : 0,
                borderColor: colors.primary + '45',
              },
            ]}
          >
            <Text style={[styles.dayNum, { color: textColor, fontFamily: 'Inter_500Medium', fontSize: 14 }]}>
              {cell.day}
            </Text>
          </View>
        )}

        {/* Indicator dots — modern minimal style */}
        {total > 0 && cell.isCurrentMonth && !cell.isToday && (
          <View style={styles.dotsRow}>
            {Array.from({ length: Math.min(total, 3) }).map((_, i) => (
              <View key={i} style={[styles.miniDot, { backgroundColor: bc! }]} />
            ))}
          </View>
        )}
        {total > 0 && cell.isCurrentMonth && cell.isToday && (
          <View style={[styles.todayCountPill, { backgroundColor: '#FFFFFF' }]}>
            <Text style={[styles.todayCountText, { color: colors.primary, fontFamily: 'Inter_700Bold' }]}>{total}</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ─── Day Detail Modal ─────────────────────────────────────────────────────────
function DayModal({
  visible,
  dateStr,
  events,
  categories,
  colors,
  onClose,
}: {
  visible: boolean;
  dateStr: string | null;
  events: CalendarEvent[];
  categories: Category[];
  colors: ReturnType<typeof useColors>;
  onClose: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(500)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 13 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 500, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!dateStr) return null;

  const scripts = events.filter(e => e.type === 'script');
  const todos = events.filter(e => e.type === 'todo');

  const catName = (id?: string) => {
    if (!id) return null;
    return categories.find(c => c.id === id)?.name ?? null;
  };
  const catColor = (id?: string) => {
    if (!id) return colors.mutedForeground;
    return categories.find(c => c.id === id)?.color ?? colors.mutedForeground;
  };

  const isPast = new Date(dateStr + 'T23:59:59') < new Date();

  const statusLabel = (s?: string) => {
    if (s === 'completed') return 'Done';
    if (s === 'in_progress') return 'In Progress';
    return 'Not Started';
  };
  const statusColor = (s?: string) => {
    if (s === 'completed') return colors.completed;
    if (s === 'in_progress') return colors.inProgress;
    return colors.notStarted;
  };

  const priorityLabel = (p?: string) => {
    if (p === 'high') return 'High';
    if (p === 'medium') return 'Medium';
    return 'Low';
  };
  const priorityColor = (p?: string) => {
    if (p === 'high') return OVERDUE_COLOR;
    if (p === 'medium') return MIXED_COLOR;
    return colors.mutedForeground;
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close">
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        </Pressable>
      </Animated.View>

      <Animated.View
        style={[
          styles.modalSheet,
          { backgroundColor: colors.card, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {/* Header */}
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.modalWeekday, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
              {formatWeekday(dateStr).toUpperCase()}
            </Text>
            <Text style={[styles.modalDate, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
              {formatModalDate(dateStr)}
            </Text>
            <View style={styles.modalMetaRow}>
              {events.length > 0 && (
                <View style={[styles.metaPill, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.modalMeta, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
                    {events.length} item{events.length > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
              {isPast && events.length > 0 && (
                <View style={[styles.metaPill, { backgroundColor: OVERDUE_COLOR + '16' }]}>
                  <Feather name="alert-circle" size={11} color={OVERDUE_COLOR} style={{ marginRight: 4 }} />
                  <Text style={[styles.modalMeta, { color: OVERDUE_COLOR, fontFamily: 'Inter_600SemiBold' }]}>
                    Overdue
                  </Text>
                </View>
              )}
            </View>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            style={({ pressed }) => [styles.closeBtn, { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <ScrollView
          style={{ maxHeight: 460 }}
          contentContainerStyle={{ gap: 18, paddingBottom: 8, paddingTop: 4 }}
          showsVerticalScrollIndicator={false}
        >
          {scripts.length > 0 && (
            <View style={{ gap: 10 }}>
              <View style={styles.groupHeader}>
                <View style={[styles.groupIconWrap, { backgroundColor: SCRIPT_COLOR + '16' }]}>
                  <Feather name="file-text" size={13} color={SCRIPT_COLOR} />
                </View>
                <Text style={[styles.groupTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
                  Scripts
                </Text>
                <View style={[styles.countChip, { backgroundColor: SCRIPT_COLOR + '14' }]}>
                  <Text style={[styles.countChipText, { color: SCRIPT_COLOR, fontFamily: 'Inter_700Bold' }]}>{scripts.length}</Text>
                </View>
              </View>
              {scripts.map(ev => (
                <Pressable
                  key={ev.id}
                  onPress={() => { onClose(); setTimeout(() => router.push(`/script/${ev.scriptId ?? ev.id}`), 220); }}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.eventCard,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      opacity: pressed ? 0.72 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                >
                  <View style={[styles.eventAccent, { backgroundColor: SCRIPT_COLOR }]} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={[styles.eventTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]} numberOfLines={2}>
                      {ev.title}
                    </Text>
                    <View style={styles.eventTags}>
                      <View style={[styles.tag, { backgroundColor: statusColor(ev.status) + '18' }]}>
                        <View style={[styles.tagDot, { backgroundColor: statusColor(ev.status) }]} />
                        <Text style={[styles.tagText, { color: statusColor(ev.status), fontFamily: 'Inter_500Medium' }]}>
                          {statusLabel(ev.status)}
                        </Text>
                      </View>
                      {ev.category && (
                        <View style={[styles.tag, { backgroundColor: catColor(ev.category) + '18' }]}>
                          <View style={[styles.tagDot, { backgroundColor: catColor(ev.category) }]} />
                          <Text style={[styles.tagText, { color: catColor(ev.category), fontFamily: 'Inter_500Medium' }]}>
                            {catName(ev.category)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={[styles.chevronWrap, { backgroundColor: colors.muted }]}>
                    <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {todos.length > 0 && (
            <View style={{ gap: 10 }}>
              <View style={styles.groupHeader}>
                <View style={[styles.groupIconWrap, { backgroundColor: TODO_COLOR + '16' }]}>
                  <Feather name="check-square" size={13} color={TODO_COLOR} />
                </View>
                <Text style={[styles.groupTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
                  To-Dos
                </Text>
                <View style={[styles.countChip, { backgroundColor: TODO_COLOR + '14' }]}>
                  <Text style={[styles.countChipText, { color: TODO_COLOR, fontFamily: 'Inter_700Bold' }]}>{todos.length}</Text>
                </View>
              </View>
              {todos.map(ev => (
                <Pressable
                  key={ev.id}
                  onPress={() => { onClose(); setTimeout(() => router.push('/(tabs)/todos'), 220); }}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.eventCard,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      opacity: pressed ? 0.72 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                >
                  <View style={[styles.eventAccent, { backgroundColor: TODO_COLOR }]} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text
                      style={[
                        styles.eventTitle,
                        {
                          color: ev.status === 'completed' ? colors.mutedForeground : colors.foreground,
                          fontFamily: 'Inter_600SemiBold',
                          textDecorationLine: ev.status === 'completed' ? 'line-through' : 'none',
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {ev.title}
                    </Text>
                    <View style={styles.eventTags}>
                      {ev.status === 'completed' ? (
                        <View style={[styles.tag, { backgroundColor: colors.completed + '18' }]}>
                          <Feather name="check" size={10} color={colors.completed} />
                          <Text style={[styles.tagText, { color: colors.completed, fontFamily: 'Inter_500Medium' }]}>Done</Text>
                        </View>
                      ) : (
                        <View style={[styles.tag, { backgroundColor: colors.muted }]}>
                          <Text style={[styles.tagText, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Active</Text>
                        </View>
                      )}
                      {ev.priority && (
                        <View style={[styles.tag, { backgroundColor: priorityColor(ev.priority) + '18' }]}>
                          <View style={[styles.tagDot, { backgroundColor: priorityColor(ev.priority) }]} />
                          <Text style={[styles.tagText, { color: priorityColor(ev.priority), fontFamily: 'Inter_500Medium' }]}>
                            {priorityLabel(ev.priority)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={[styles.chevronWrap, { backgroundColor: colors.muted }]}>
                    <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {events.length === 0 && (
            <View style={styles.emptyDay}>
              <View style={[styles.emptyIconWrap, { backgroundColor: colors.muted }]}>
                <Feather name="calendar" size={26} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
                Nothing scheduled
              </Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                Add a script or to-do for this date
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Action buttons */}
        <View style={styles.modalActions}>
          <Pressable
            onPress={() => {
              onClose();
              setTimeout(() => router.push({ pathname: '/script/new', params: { prefillDate: dateStr } }), 220);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.actionBtnPrimary,
              { backgroundColor: SCRIPT_COLOR, opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            <Feather name="plus" size={16} color="#FFFFFF" />
            <Text style={[styles.actionTextPrimary, { fontFamily: 'Inter_600SemiBold' }]}>New Script</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              onClose();
              setTimeout(() => router.push({ pathname: '/(tabs)/todos', params: { prefillDate: dateStr } }), 220);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.actionBtnSecondary,
              { backgroundColor: colors.muted, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            <Feather name="plus" size={16} color={colors.foreground} />
            <Text style={[styles.actionTextSecondary, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>New To-Do</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface MonthCalendarProps {
  scripts: Script[];
  todos: TodoItem[];
  categories: Category[];
}

export function MonthCalendar({ scripts, todos, categories }: MonthCalendarProps) {
  const colors = useColors();
  const now = new Date();

  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewMode, setViewMode] = useState<ViewMode>('week'); // default to compact weekly view
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(now));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [legendVisible, setLegendVisible] = useState(false);

  const slideX = useRef(new Animated.Value(0)).current;
  const fadeOpacity = useRef(new Animated.Value(1)).current;
  const isSwiping = useRef(false);

  const animateSlide = useCallback((dir: 'left' | 'right', next: () => void) => {
    if (isSwiping.current) return;
    isSwiping.current = true;
    const toVal = dir === 'left' ? -SCREEN_W * 0.25 : SCREEN_W * 0.25;
    Animated.parallel([
      Animated.timing(slideX, { toValue: toVal, duration: 140, useNativeDriver: true }),
      Animated.timing(fadeOpacity, { toValue: 0.3, duration: 140, useNativeDriver: true }),
    ]).start(() => {
      slideX.setValue(-toVal);
      next();
      Animated.parallel([
        Animated.spring(slideX, { toValue: 0, useNativeDriver: true, tension: 90, friction: 15 }),
        Animated.timing(fadeOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        isSwiping.current = false;
      });
    });
  }, []);

  // ── Swipe gesture handler ─────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 10 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5
        );
      },
      onPanResponderMove: (_, gestureState) => {
        const dampened = gestureState.dx * 0.4;
        slideX.setValue(dampened);
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, vx } = gestureState;
        const shouldNavigate =
          Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(vx) > SWIPE_VELOCITY;

        if (shouldNavigate) {
          if (dx > 0) {
            slideX.setValue(0);
            goPrevRef.current();
          } else {
            slideX.setValue(0);
            goNextRef.current();
          }
        } else {
          Animated.spring(slideX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 120,
            friction: 14,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(slideX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 120,
          friction: 14,
        }).start();
      },
    })
  ).current;

  const goPrev = useCallback(() => {
    Haptics.selectionAsync();
    animateSlide('right', () => {
      if (viewMode === 'week') {
        setWeekStart(ws => {
          const nd = new Date(ws);
          nd.setDate(nd.getDate() - 7);
          return nd;
        });
      } else {
        setViewMonth(m => {
          if (m === 0) { setViewYear(y => y - 1); return 11; }
          return m - 1;
        });
      }
    });
  }, [viewMode, animateSlide]);

  const goNext = useCallback(() => {
    Haptics.selectionAsync();
    animateSlide('left', () => {
      if (viewMode === 'week') {
        setWeekStart(ws => {
          const nd = new Date(ws);
          nd.setDate(nd.getDate() + 7);
          return nd;
        });
      } else {
        setViewMonth(m => {
          if (m === 11) { setViewYear(y => y + 1); return 0; }
          return m + 1;
        });
      }
    });
  }, [viewMode, animateSlide]);

  // Refs for PanResponder (can't close over changing state)
  const goPrevRef = useRef(goPrev);
  const goNextRef = useRef(goNext);
  goPrevRef.current = goPrev;
  goNextRef.current = goNext;

  const jumpToToday = () => {
    Haptics.selectionAsync();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setWeekStart(getWeekStart(now));
  };

  const isCurrentMonthView = viewYear === now.getFullYear() && viewMonth === now.getMonth();
  const isCurrentWeekView = weekStart.getTime() === getWeekStart(now).getTime();
  const showTodayBtn = viewMode === 'month' ? !isCurrentMonthView : !isCurrentWeekView;

  const grid = useMemo(() => {
    const cells = viewMode === 'week' ? buildWeekGrid(weekStart) : buildGrid(viewYear, viewMonth);

    const scriptMap: Record<string, number> = {};
    for (const s of scripts) {
      if (s.deadline) scriptMap[s.deadline] = (scriptMap[s.deadline] ?? 0) + 1;
    }
    const todoMap: Record<string, number> = {};
    for (const t of todos) {
      if (t.dueDate) todoMap[t.dueDate] = (todoMap[t.dueDate] ?? 0) + 1;
    }

    return cells.map(c => ({
      ...c,
      scriptCount: scriptMap[c.dateStr] ?? 0,
      todoCount: todoMap[c.dateStr] ?? 0,
    }));
  }, [viewMode, viewYear, viewMonth, weekStart, scripts, todos]);

  const modalEvents = useMemo((): CalendarEvent[] => {
    if (!selectedDate) return [];
    const evs: CalendarEvent[] = [];
    for (const s of scripts) {
      if (s.deadline === selectedDate) {
        evs.push({
          id: s.id,
          scriptId: s.id,
          title: s.title,
          type: 'script',
          dueDate: s.deadline,
          category: s.categoryIds?.[0],
          status: s.status,
        });
      }
    }
    for (const t of todos) {
      if (t.dueDate === selectedDate) {
        evs.push({
          id: t.id,
          title: t.text,
          type: 'todo',
          dueDate: t.dueDate,
          status: t.completed ? 'completed' : 'active',
          priority: t.priority,
        });
      }
    }
    return evs;
  }, [selectedDate, scripts, todos]);

  const weeks = useMemo(() => {
    const rows: typeof grid[] = [];
    for (let i = 0; i < grid.length; i += 7) rows.push(grid.slice(i, i + 7));
    return rows;
  }, [grid]);

  const hasScripts = grid.some(c => c.scriptCount > 0);
  const hasTodos = grid.some(c => c.todoCount > 0);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Luxury top accent gradient */}
      <LinearGradient
        colors={[colors.primary + '18', colors.primary + '06', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.topAccent}
      />

      {/* Header */}
      <View style={styles.calHeader}>
        {/* Left: nav arrows flanking the range label */}
        <View style={styles.navRow}>
          <Pressable
            onPress={goPrev}
            accessibilityRole="button"
            accessibilityLabel="Previous"
            hitSlop={6}
            style={({ pressed }) => [
              styles.navBtn,
              { backgroundColor: colors.muted, opacity: pressed ? 0.6 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] },
            ]}
          >
            <Feather name="chevron-left" size={17} color={colors.foreground} />
          </Pressable>

          <Pressable onPress={jumpToToday} disabled={!showTodayBtn} style={{ flex: 1 }}>
            <View style={styles.rangeLabelWrap}>
              {viewMode === 'month' ? (
                <>
                  <Text style={[styles.monthLabel, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
                    {MONTH_NAMES[viewMonth]}
                  </Text>
                  <Text style={[styles.yearLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
                    {viewYear}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.monthLabel, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
                    {formatWeekRange(weekStart).range}
                  </Text>
                  <Text style={[styles.yearLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
                    {formatWeekRange(weekStart).year}
                  </Text>
                </>
              )}
            </View>
          </Pressable>

          <Pressable
            onPress={goNext}
            accessibilityRole="button"
            accessibilityLabel="Next"
            hitSlop={6}
            style={({ pressed }) => [
              styles.navBtn,
              { backgroundColor: colors.muted, opacity: pressed ? 0.6 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] },
            ]}
          >
            <Feather name="chevron-right" size={17} color={colors.foreground} />
          </Pressable>
        </View>

        {/* Right: Info icon + W/M toggle */}
        <View style={styles.headerControls}>
          <Pressable
            onPress={() => setLegendVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Show legend"
            hitSlop={6}
            style={({ pressed }) => [
              styles.navBtn,
              { backgroundColor: colors.muted, opacity: pressed ? 0.6 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] },
            ]}
          >
            <Feather name="info" size={15} color={colors.foreground} />
          </Pressable>

          {/* Tiny W/M toggle */}
          <View style={[styles.miniToggleTrack, { backgroundColor: colors.muted }]}>
            <Pressable
              onPress={() => {
                if (viewMode !== 'week') {
                  Haptics.selectionAsync();
                  setWeekStart(getWeekStart(selectedDate ? new Date(selectedDate + 'T12:00:00') : new Date(viewYear, viewMonth, Math.min(now.getDate(), 28))));
                  setViewMode('week');
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Week view"
              style={[
                styles.miniToggleBtn,
                viewMode === 'week' && {
                  backgroundColor: colors.card,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 3,
                  elevation: 2,
                },
              ]}
            >
              <Text
                style={[
                  styles.miniToggleText,
                  {
                    color: viewMode === 'week' ? colors.foreground : colors.mutedForeground,
                    fontFamily: viewMode === 'week' ? 'Inter_700Bold' : 'Inter_500Medium',
                  },
                ]}
              >
                W
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (viewMode !== 'month') {
                  Haptics.selectionAsync();
                  const anchor = new Date(weekStart);
                  setViewYear(anchor.getFullYear());
                  setViewMonth(anchor.getMonth());
                  setViewMode('month');
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Month view"
              style={[
                styles.miniToggleBtn,
                viewMode === 'month' && {
                  backgroundColor: colors.card,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 3,
                  elevation: 2,
                },
              ]}
            >
              <Text
                style={[
                  styles.miniToggleText,
                  {
                    color: viewMode === 'month' ? colors.foreground : colors.mutedForeground,
                    fontFamily: viewMode === 'month' ? 'Inter_700Bold' : 'Inter_500Medium',
                  },
                ]}
              >
                M
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Weekday headers */}
      <View style={styles.weekHeader}>
        {WEEK_DAYS.map((d, i) => (
          <View key={`${d}-${i}`} style={[styles.weekCell, { width: viewMode === 'week' ? WEEK_CELL_W : CELL_W }]}>
            <Text style={[styles.weekDay, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
              {d}
            </Text>
          </View>
        ))}
      </View>

      {/* Swipeable Grid */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.grid,
          { transform: [{ translateX: slideX }], opacity: fadeOpacity },
        ]}
      >
        {weeks.map((week, wi) => (
          <View key={wi} style={[styles.weekRow, viewMode === 'week' && styles.weekRowExpanded]}>
            {week.map(cell => (
              <DayCellView
                key={cell.dateStr}
                cell={cell}
                selected={selectedDate === cell.dateStr}
                colors={colors}
                onPress={() => {
                  if (!cell.isCurrentMonth) return;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedDate(cell.dateStr);
                  setModalVisible(true);
                }}
              />
            ))}
          </View>
        ))}
      </Animated.View>

      {/* Legend Modal */}
      <Modal visible={legendVisible} transparent animationType="fade" onRequestClose={() => setLegendVisible(false)} statusBarTranslucent>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setLegendVisible(false)} accessibilityLabel="Close legend">
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        </Pressable>
        <View style={styles.legendModalCenter}>
          <View style={[styles.legendModalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.legendModalHeader}>
              <Text style={[styles.legendModalTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>Calendar Legend</Text>
              <Pressable
                onPress={() => setLegendVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
                style={({ pressed }) => [styles.closeBtnSmall, { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
              >
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <View style={styles.legendGrid}>
              <View style={[styles.legendChip, { backgroundColor: colors.primary + '10' }]}>
                <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.legendText, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Today</Text>
              </View>
              {hasScripts && (
                <View style={[styles.legendChip, { backgroundColor: SCRIPT_COLOR + '10' }]}>
                  <View style={[styles.legendDot, { backgroundColor: SCRIPT_COLOR }]} />
                  <Text style={[styles.legendText, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Scripts</Text>
                </View>
              )}
              {hasTodos && (
                <View style={[styles.legendChip, { backgroundColor: TODO_COLOR + '10' }]}>
                  <View style={[styles.legendDot, { backgroundColor: TODO_COLOR }]} />
                  <Text style={[styles.legendText, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>To-Dos</Text>
                </View>
              )}
              {hasScripts && hasTodos && (
                <View style={[styles.legendChip, { backgroundColor: MIXED_COLOR + '10' }]}>
                  <View style={[styles.legendDot, { backgroundColor: MIXED_COLOR }]} />
                  <Text style={[styles.legendText, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Mixed</Text>
                </View>
              )}
              <View style={[styles.legendChip, { backgroundColor: OVERDUE_COLOR + '10' }]}>
                <View style={[styles.legendDot, { backgroundColor: OVERDUE_COLOR }]} />
                <Text style={[styles.legendText, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Overdue</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <DayModal
        visible={modalVisible}
        dateStr={selectedDate}
        events={modalEvents}
        categories={categories}
        colors={colors}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    overflow: 'hidden',
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
  },

  // Luxury top accent
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
  },

  // Header
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 10,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  rangeLabelWrap: {
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  monthLabel: { fontSize: 17, lineHeight: 21, letterSpacing: -0.3 },
  yearLabel: { fontSize: 11.5, marginTop: 1, opacity: 0.6 },
  headerControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  todayBtn: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 9,
  },
  todayBtnText: { fontSize: 11.5, letterSpacing: 0.2 },
  navBtn: {
    width: 32, height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Mini W/M toggle
  miniToggleTrack: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  miniToggleBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniToggleText: { fontSize: 12 },

  // Weekday row
  weekHeader: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingBottom: 8,
    justifyContent: 'space-around',
  },
  weekCell: { alignItems: 'center', paddingVertical: 2 },
  weekDay: { fontSize: 12, letterSpacing: 0.4, opacity: 0.55 },

  // Grid
  grid: { paddingHorizontal: 8, paddingTop: 2 },
  weekRow: { flexDirection: 'row' },
  weekRowExpanded: {
    paddingVertical: 6,
    justifyContent: 'space-around',
  },

  // Day cell
  cellOuter: { alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  cellInner: { alignItems: 'center', justifyContent: 'center' },
  cellFill: {
    width: '100%',
    height: '100%',
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellShadowToday: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 5,
  },
  cellSelectedShadow: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  dayNum: { lineHeight: 18 },
  dotsRow: {
    position: 'absolute',
    bottom: 5,
    flexDirection: 'row',
    gap: 3,
  },
  miniDot: { width: 4, height: 4, borderRadius: 2 },
  todayCountPill: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  todayCountText: { fontSize: 9.5, lineHeight: 12 },

  // Legend Modal
  legendModalCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  legendModalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  legendModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  legendModalTitle: {
    fontSize: 16,
  },
  closeBtnSmall: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontSize: 12 },

  // Modal sheet
  modalSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    paddingBottom: Platform.OS === 'ios' ? 38 : 26,
    gap: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 24,
  },
  handle: { width: 38, height: 4.5, borderRadius: 3, alignSelf: 'center', marginBottom: 2, opacity: 0.6 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  modalWeekday: { fontSize: 11.5, letterSpacing: 0.8, marginBottom: 3 },
  modalDate: { fontSize: 22, lineHeight: 27 },
  modalMetaRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  metaPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  modalMeta: { fontSize: 12 },
  closeBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },

  // Event groups
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  groupIconWrap: {
    width: 24, height: 24, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  groupTitle: { fontSize: 14.5, flex: 1 },
  countChip: { paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 7 },
  countChipText: { fontSize: 11.5 },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 14,
    borderWidth: 1,
    borderRadius: 16,
  },
  eventAccent: { width: 4, height: '100%', minHeight: 34, borderRadius: 2 },
  eventTitle: { fontSize: 14.5, lineHeight: 20 },
  eventTags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 },
  tagDot: { width: 5, height: 5, borderRadius: 2.5 },
  tagText: { fontSize: 11 },
  chevronWrap: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  // Empty state
  emptyDay: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  emptyIconWrap: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16 },
  emptySub: { fontSize: 13, textAlign: 'center' },

  // Action buttons
  modalActions: { flexDirection: 'row', gap: 10 },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 15,
    shadowColor: SCRIPT_COLOR,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 15,
  },
  actionTextPrimary: { fontSize: 14.5, color: '#FFFFFF' },
  actionTextSecondary: { fontSize: 14.5 },
});