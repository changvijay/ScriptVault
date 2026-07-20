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
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { Script, TodoItem, Category } from '@/types';

// ─── Constants ───────────────────────────────────────────────────────────────
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// badge colours
const SCRIPT_COLOR  = '#3B82F6'; // blue
const TODO_COLOR    = '#10B981'; // green
const MIXED_COLOR   = '#F59E0B'; // orange
const OVERDUE_COLOR = '#EF4444'; // red

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────
interface CalendarEvent {
  id: string;
  title: string;
  type: 'script' | 'todo';
  dueDate: string; // YYYY-MM-DD
  category?: string;
  status?: string;
  priority?: string;
  scriptId?: string; // for navigation
}

interface DayCell {
  dateStr: string;       // YYYY-MM-DD
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
  const todayStr = toDateStr(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate(),
  );
  const nowTs = new Date(todayStr).getTime();

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const cells: DayCell[] = [];

  // previous month tail
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear  = month === 0 ? year - 1 : year;
    const ds = toDateStr(prevYear, prevMonth, d);
    cells.push({ dateStr: ds, day: d, isCurrentMonth: false, isToday: false, isPast: true, scriptCount: 0, todoCount: 0 });
  }

  // current month
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

  // next month head — fill to complete last row
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear  = month === 11 ? year + 1 : year;
    for (let d = 1; d <= remaining; d++) {
      const ds = toDateStr(nextYear, nextMonth, d);
      cells.push({ dateStr: ds, day: d, isCurrentMonth: false, isToday: false, isPast: false, scriptCount: 0, todoCount: 0 });
    }
  }

  return cells;
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

// ─── Day Cell ─────────────────────────────────────────────────────────────────
const CELL_W = Math.floor((SCREEN_W - 32) / 7); // 16px padding each side

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
    Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 40 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start();
  };

  const bc = badgeColor(cell.scriptCount, cell.todoCount, cell.isPast, cell.isCurrentMonth);
  const total = cell.scriptCount + cell.todoCount;

  const bgColor = cell.isToday
    ? colors.primary
    : selected
    ? colors.primary + '22'
    : 'transparent';

  const textColor = cell.isToday
    ? colors.primaryForeground
    : !cell.isCurrentMonth
    ? colors.border
    : cell.isPast
    ? colors.mutedForeground
    : colors.foreground;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.cellOuter, { width: CELL_W, minHeight: CELL_W + 14 }]}
    >
      <Animated.View
        style={[
          styles.cellInner,
          {
            width: CELL_W - 4,
            minHeight: CELL_W - 4,
            backgroundColor: bgColor,
            borderRadius: 10,
            borderWidth: selected && !cell.isToday ? 1.5 : 0,
            borderColor: colors.primary,
            transform: [{ scale }],
          },
        ]}
      >
        {/* Day number */}
        <Text
          style={[
            styles.dayNum,
            {
              color: textColor,
              fontFamily: cell.isToday ? 'Inter_700Bold' : 'Inter_400Regular',
              fontSize: cell.isToday ? 14 : 13,
            },
          ]}
        >
          {cell.day}
        </Text>

        {/* Badge */}
        {total > 0 && cell.isCurrentMonth && (
          <View style={[styles.badge, { backgroundColor: bc! + '22', borderRadius: 5 }]}>
            <View style={[styles.badgeDot, { backgroundColor: bc! }]} />
            <Text style={[styles.badgeCount, { color: bc!, fontFamily: 'Inter_600SemiBold' }]}>
              {total}
            </Text>
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

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0, useNativeDriver: true,
        tension: 65, friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 500, duration: 220, useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!dateStr) return null;

  const scripts = events.filter(e => e.type === 'script');
  const todos   = events.filter(e => e.type === 'todo');

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
    if (p === 'high') return '#EF4444';
    if (p === 'medium') return '#F59E0B';
    return '#6B7280';
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <Animated.View
        style={[
          styles.modalSheet,
          { backgroundColor: colors.card, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {/* Header */}
        <View style={styles.modalHeader}>
          <View>
            <Text style={[styles.modalDate, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
              {formatModalDate(dateStr)}
            </Text>
            <Text style={[styles.modalMeta, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              {events.length === 0
                ? 'Nothing scheduled'
                : `${events.length} item${events.length > 1 ? 's' : ''}`}
              {isPast && events.length > 0 ? ' · Overdue' : ''}
            </Text>
          </View>
          <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.muted }]}>
            <Feather name="x" size={17} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <ScrollView
          style={{ maxHeight: 480 }}
          contentContainerStyle={{ gap: 16, paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Scripts section */}
          {scripts.length > 0 && (
            <View style={{ gap: 8 }}>
              <View style={styles.groupHeader}>
                <View style={[styles.groupDot, { backgroundColor: SCRIPT_COLOR }]} />
                <Text style={[styles.groupTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
                  Scripts ({scripts.length})
                </Text>
              </View>
              {scripts.map(ev => (
                <Pressable
                  key={ev.id}
                  onPress={() => { onClose(); setTimeout(() => router.push(`/script/${ev.scriptId ?? ev.id}`), 220); }}
                  style={[styles.eventCard, { backgroundColor: colors.background, borderColor: SCRIPT_COLOR + '30', borderLeftColor: SCRIPT_COLOR }]}
                >
                  <View style={{ flex: 1, gap: 5 }}>
                    <Text style={[styles.eventTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]} numberOfLines={2}>
                      {ev.title}
                    </Text>
                    <View style={styles.eventTags}>
                      <View style={[styles.tag, { backgroundColor: statusColor(ev.status) + '18' }]}>
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
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>
          )}

          {/* Todos section */}
          {todos.length > 0 && (
            <View style={{ gap: 8 }}>
              <View style={styles.groupHeader}>
                <View style={[styles.groupDot, { backgroundColor: TODO_COLOR }]} />
                <Text style={[styles.groupTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
                  Todos ({todos.length})
                </Text>
              </View>
              {todos.map(ev => (
                <Pressable
                  key={ev.id}
                  onPress={() => { onClose(); setTimeout(() => router.push('/(tabs)/todos'), 220); }}
                  style={[styles.eventCard, { backgroundColor: colors.background, borderColor: TODO_COLOR + '30', borderLeftColor: TODO_COLOR }]}
                >
                  <View style={{ flex: 1, gap: 5 }}>
                    <Text style={[styles.eventTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]} numberOfLines={2}>
                      {ev.title}
                    </Text>
                    <View style={styles.eventTags}>
                      {ev.status === 'completed' ? (
                        <View style={[styles.tag, { backgroundColor: colors.completed + '18' }]}>
                          <Text style={[styles.tagText, { color: colors.completed, fontFamily: 'Inter_500Medium' }]}>Done</Text>
                        </View>
                      ) : (
                        <View style={[styles.tag, { backgroundColor: colors.muted }]}>
                          <Text style={[styles.tagText, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Active</Text>
                        </View>
                      )}
                      {ev.priority && (
                        <View style={[styles.tag, { backgroundColor: priorityColor(ev.priority) + '18' }]}>
                          <Text style={[styles.tagText, { color: priorityColor(ev.priority), fontFamily: 'Inter_500Medium' }]}>
                            {priorityLabel(ev.priority)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>
          )}

          {/* Empty */}
          {events.length === 0 && (
            <View style={styles.emptyDay}>
              <Feather name="calendar" size={32} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
                Nothing scheduled
              </Text>
              <Text style={[styles.emptySub, { color: colors.border, fontFamily: 'Inter_400Regular' }]}>
                Add a script or to-do with this date.
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
            style={[styles.actionBtn, { backgroundColor: SCRIPT_COLOR + '16', borderColor: SCRIPT_COLOR + '40' }]}
          >
            <Feather name="plus" size={15} color={SCRIPT_COLOR} />
            <Text style={[styles.actionText, { color: SCRIPT_COLOR, fontFamily: 'Inter_600SemiBold' }]}>New Script</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              onClose();
              setTimeout(() => router.push({ pathname: '/(tabs)/todos', params: { prefillDate: dateStr } }), 220);
            }}
            style={[styles.actionBtn, { backgroundColor: TODO_COLOR + '16', borderColor: TODO_COLOR + '40' }]}
          >
            <Feather name="plus" size={15} color={TODO_COLOR} />
            <Text style={[styles.actionText, { color: TODO_COLOR, fontFamily: 'Inter_600SemiBold' }]}>New To-Do</Text>
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

  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalVisible,  setModalVisible]  = useState(false);

  // Slide animation between months
  const slideX = useRef(new Animated.Value(0)).current;

  const animateSlide = useCallback((dir: 'left' | 'right', next: () => void) => {
    const toVal = dir === 'left' ? -SCREEN_W : SCREEN_W;
    Animated.timing(slideX, { toValue: toVal, duration: 180, useNativeDriver: true }).start(() => {
      slideX.setValue(-toVal);
      next();
      Animated.spring(slideX, { toValue: 0, useNativeDriver: true, tension: 70, friction: 12 }).start();
    });
  }, []);

  const goPrev = () => {
    Haptics.selectionAsync();
    animateSlide('right', () => {
      setViewMonth(m => {
        if (m === 0) { setViewYear(y => y - 1); return 11; }
        return m - 1;
      });
    });
  };

  const goNext = () => {
    Haptics.selectionAsync();
    animateSlide('left', () => {
      setViewMonth(m => {
        if (m === 11) { setViewYear(y => y + 1); return 0; }
        return m + 1;
      });
    });
  };

  // Build grid and inject counts
  const grid = useMemo(() => {
    const cells = buildGrid(viewYear, viewMonth);

    // index scripts by deadline date
    const scriptMap: Record<string, number> = {};
    for (const s of scripts) {
      if (s.deadline) scriptMap[s.deadline] = (scriptMap[s.deadline] ?? 0) + 1;
    }
    // index todos by dueDate
    const todoMap: Record<string, number> = {};
    for (const t of todos) {
      if (t.dueDate) todoMap[t.dueDate] = (todoMap[t.dueDate] ?? 0) + 1;
    }

    return cells.map(c => ({
      ...c,
      scriptCount: scriptMap[c.dateStr] ?? 0,
      todoCount: todoMap[c.dateStr] ?? 0,
    }));
  }, [viewYear, viewMonth, scripts, todos]);

  // Build events for modal (lazy — only when a date is selected)
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

  // Legend counts for this month
  const hasScripts = scripts.some(s => s.deadline?.startsWith(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`));
  const hasTodos   = todos.some(t => t.dueDate?.startsWith(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`));

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16 }]}>
      {/* Month header */}
      <View style={styles.calHeader}>
        <Pressable onPress={goPrev} style={[styles.navBtn, { backgroundColor: colors.muted }]}>
          <Feather name="chevron-left" size={18} color={colors.foreground} />
        </Pressable>

        <Pressable
          onPress={() => {
            setViewYear(now.getFullYear());
            setViewMonth(now.getMonth());
            Haptics.selectionAsync();
          }}
        >
          <Text style={[styles.monthLabel, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </Text>
        </Pressable>

        <Pressable onPress={goNext} style={[styles.navBtn, { backgroundColor: colors.muted }]}>
          <Feather name="chevron-right" size={18} color={colors.foreground} />
        </Pressable>
      </View>

      {/* Weekday headers */}
      <View style={styles.weekHeader}>
        {WEEK_DAYS.map(d => (
          <View key={d} style={[styles.weekCell, { width: CELL_W }]}>
            <Text style={[styles.weekDay, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
              {d}
            </Text>
          </View>
        ))}
      </View>

      {/* Grid */}
      <Animated.View style={[styles.grid, { transform: [{ translateX: slideX }] }]}>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
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

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.legendText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>Today</Text>
        </View>
        {hasScripts && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: SCRIPT_COLOR }]} />
            <Text style={[styles.legendText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>Scripts</Text>
          </View>
        )}
        {hasTodos && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: TODO_COLOR }]} />
            <Text style={[styles.legendText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>To-Dos</Text>
          </View>
        )}
        {hasScripts && hasTodos && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: MIXED_COLOR }]} />
            <Text style={[styles.legendText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>Mixed</Text>
          </View>
        )}
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: OVERDUE_COLOR }]} />
          <Text style={[styles.legendText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>Overdue</Text>
        </View>
      </View>

      {/* Detail modal */}
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
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: 12,
  },

  // Header
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  monthLabel: { fontSize: 17 },
  navBtn: {
    width: 34, height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Weekday row
  weekHeader: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  weekCell: { alignItems: 'center', paddingVertical: 4 },
  weekDay: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Grid
  grid: { paddingHorizontal: 8, paddingTop: 4 },
  weekRow: { flexDirection: 'row' },

  // Day cell
  cellOuter: { alignItems: 'center', paddingVertical: 2 },
  cellInner: { alignItems: 'center', justifyContent: 'center', paddingVertical: 5, gap: 2 },
  dayNum: { lineHeight: 16 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },
  badgeCount: { fontSize: 9 },

  // Legend
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11 },

  // Modal backdrop
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  // Modal sheet
  modalSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  modalDate: { fontSize: 20 },
  modalMeta: { fontSize: 13, marginTop: 3 },
  closeBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  // Event groups
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupDot: { width: 10, height: 10, borderRadius: 5 },
  groupTitle: { fontSize: 14 },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: 10,
  },
  eventTitle: { fontSize: 14, lineHeight: 20 },
  eventTags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  tagDot: { width: 6, height: 6, borderRadius: 3 },
  tagText: { fontSize: 11 },

  // Empty state
  emptyDay: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  emptyTitle: { fontSize: 15 },
  emptySub: { fontSize: 13, textAlign: 'center' },

  // Action buttons
  modalActions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionText: { fontSize: 14 },
});
