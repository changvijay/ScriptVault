import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '@/context/DataContext';
import { EmptyState } from '@/components/EmptyState';
import { DatePickerModal } from '@/components/DatePickerModal';
import { Feather } from '@expo/vector-icons';
import { TodoItem } from '@/types';
import * as Haptics from 'expo-haptics';

type Priority = TodoItem['priority'];
type FilterType = 'all' | 'active' | 'completed';

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string }> = {
  low: { label: 'Low', color: '#6B7280' },
  medium: { label: 'Medium', color: '#F59E0B' },
  high: { label: 'High', color: '#EF4444' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PAGE_SIZE = 5;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function isOverdue(dueDate: string | null, completed: boolean): boolean {
  if (!dueDate || completed) return false;
  return new Date(dueDate + 'T23:59:59') < new Date();
}

// ─── Todo row ──────────────────────────────────────────────────────────────
function TodoRow({
  item,
  colors,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: TodoItem;
  colors: ReturnType<typeof useColors>;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const overdue = isOverdue(item.dueDate, item.completed);
  const pc = PRIORITY_CONFIG[item.priority];

  return (
    <Pressable
      onPress={onToggle}
      onLongPress={onEdit}
      style={[
        styles.todoRow,
        {
          backgroundColor: colors.card,
          borderColor: item.completed ? colors.border : colors.border,
          borderRadius: 12,
          opacity: item.completed ? 0.65 : 1,
        },
      ]}
    >
      {/* Priority stripe */}
      <View style={[styles.priorityStripe, { backgroundColor: pc.color }]} />

      {/* Checkbox */}
      <Pressable onPress={onToggle} hitSlop={10} style={[styles.checkbox, {
        borderColor: item.completed ? colors.primary : colors.border,
        backgroundColor: item.completed ? colors.primary : 'transparent',
      }]}>
        {item.completed && <Feather name="check" size={12} color={colors.primaryForeground} />}
      </Pressable>

      {/* Content */}
      <View style={{ flex: 1, gap: 3 }}>
        <Text
          style={[
            styles.todoText,
            {
              color: colors.foreground,
              fontFamily: 'Inter_500Medium',
              textDecorationLine: item.completed ? 'line-through' : 'none',
            },
          ]}
          numberOfLines={2}
        >
          {item.text}
        </Text>
        <View style={styles.todoMeta}>
          <View style={[styles.priorityBadge, { backgroundColor: pc.color + '20' }]}>
            <Text style={[styles.priorityText, { color: pc.color, fontFamily: 'Inter_500Medium' }]}>
              {pc.label}
            </Text>
          </View>
          {item.dueDate && (
            <View style={[styles.dueBadge, { backgroundColor: overdue ? '#EF444420' : colors.muted }]}>
              <Feather name="calendar" size={10} color={overdue ? '#EF4444' : colors.mutedForeground} />
              <Text style={[styles.dueText, { color: overdue ? '#EF4444' : colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                {formatDate(item.dueDate)}{overdue ? ' · Overdue' : ''}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.rowActions}>
        <Pressable onPress={onEdit} hitSlop={8} style={{ padding: 4 }}>
          <Feather name="edit-2" size={15} color={colors.mutedForeground} />
        </Pressable>
        <Pressable onPress={onDelete} hitSlop={8} style={{ padding: 4 }}>
          <Feather name="trash-2" size={15} color={colors.destructive} />
        </Pressable>
      </View>
    </Pressable>
  );
}

// ─── Add / Edit modal ──────────────────────────────────────────────────────
// Redesigned for keyboard ergonomics:
//  - Header (Cancel / Title / Save) is FIXED — never pushed offscreen by the keyboard
//  - Body scrolls independently in a ScrollView with keyboardShouldPersistTaps="handled"
//    so priority chips / due-date button are tappable without a throwaway dismiss-tap
//  - Sheet has a max-height instead of auto-grow, so it behaves predictably with KAV
function TodoModal({
  visible,
  colors,
  insets,
  initial,
  onClose,
  onSave,
}: {
  visible: boolean;
  colors: ReturnType<typeof useColors>;
  insets: { bottom: number; top: number };
  initial?: Partial<TodoItem>;
  onClose: () => void;
  onSave: (data: Partial<TodoItem>) => void;
}) {
  const [text, setText] = useState(initial?.text ?? '');
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'medium');
  const [dueDate, setDueDate] = useState<Date | null>(
    initial?.dueDate ? new Date(initial.dueDate) : null,
  );
  const [datePicker, setDatePicker] = useState(false);

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      setText(initial?.text ?? '');
      setPriority(initial?.priority ?? 'medium');
      setDueDate(initial?.dueDate ? new Date(initial.dueDate) : null);
    }
  }, [visible]);

  const canSave = !!text.trim();

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      text: text.trim(),
      priority,
      dueDate: dueDate ? dueDate.toISOString().split('T')[0] : null,
    });
    onClose();
  };

  const isEditing = !!initial?.id;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
          style={styles.kavWrapper}
        >
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.card, maxHeight: '100%', borderColor: colors.border },
            ]}
          >

            {/* ── Fixed header: always visible, keyboard or not ── */}
            <View style={[styles.modalHeaderRow, { borderBottomColor: colors.border }]}>
              <Pressable onPress={onClose} hitSlop={10} style={styles.headerBtn}>
                <Text style={[styles.headerBtnText, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
                  Cancel
                </Text>
              </Pressable>

              <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
                {isEditing ? 'Edit Task' : 'New Task'}
              </Text>

              <Pressable
                onPress={handleSave}
                disabled={!canSave}
                hitSlop={10}
                style={[
                  styles.headerSaveBtn,
                  { backgroundColor: canSave ? colors.primary : colors.muted, borderRadius: 8 },
                ]}
              >
                <Text
                  style={[
                    styles.headerSaveBtnText,
                    { color: canSave ? colors.primaryForeground : colors.mutedForeground, fontFamily: 'Inter_600SemiBold' },
                  ]}
                >
                  Save
                </Text>
              </Pressable>
            </View>

            {/* ── Scrollable body ── */}
            <ScrollView
              style={{ flexGrow: 0 }}
              contentContainerStyle={[styles.modalBody, { paddingBottom: insets.bottom + 20 }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Text input */}
              <TextInput
                style={[
                  styles.todoInput,
                  { color: colors.foreground, backgroundColor: colors.muted, borderRadius: 12, fontFamily: 'Inter_400Regular', borderColor: colors.border },
                ]}
                value={text}
                onChangeText={setText}
                placeholder="What needs to be done?"
                placeholderTextColor={colors.mutedForeground}
                multiline
                autoFocus
                blurOnSubmit={false}
                returnKeyType="done"
              />

              {/* Priority picker */}
              <Text style={[styles.modalLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Priority</Text>
              <View style={styles.priorityRow}>
                {(['low', 'medium', 'high'] as Priority[]).map(p => {
                  const active = priority === p;
                  const pc = PRIORITY_CONFIG[p];
                  return (
                    <Pressable
                      key={p}
                      onPress={() => { setPriority(p); Haptics.selectionAsync(); }}
                      style={[
                        styles.priorityChip,
                        {
                          backgroundColor: active ? pc.color + '22' : colors.muted,
                          borderColor: active ? pc.color : colors.border,
                          borderRadius: 20,
                        },
                      ]}
                    >
                      <Text style={[styles.priorityChipText, { color: active ? pc.color : colors.mutedForeground, fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>
                        {pc.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Due date */}
              <Text style={[styles.modalLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Due Date</Text>
              <View style={styles.dueDateRow}>
                <Pressable
                  onPress={() => setDatePicker(true)}
                  style={[styles.dueDateBtn, { backgroundColor: colors.muted, borderRadius: 10, borderColor: colors.border, flex: 1 }]}
                >
                  <Feather name="calendar" size={15} color={dueDate ? colors.primary : colors.mutedForeground} />
                  <Text style={{ color: dueDate ? colors.foreground : colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 15 }}>
                    {dueDate ? `${MONTHS[dueDate.getMonth()]} ${dueDate.getDate()}, ${dueDate.getFullYear()}` : 'No due date'}
                  </Text>
                </Pressable>
                {dueDate && (
                  <Pressable onPress={() => setDueDate(null)} style={[styles.clearBtn, { backgroundColor: colors.muted, borderRadius: 10 }]}>
                    <Feather name="x" size={16} color={colors.mutedForeground} />
                  </Pressable>
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>

      <DatePickerModal
        visible={datePicker}
        date={dueDate}
        blockPastDates={true}
        onConfirm={d => { setDueDate(d); setDatePicker(false); }}
        onClose={() => setDatePicker(false)}
      />
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────
export default function TodosScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { todos, createTodo, updateTodo, deleteTodo, toggleTodo } = useData();

  const [filter, setFilter] = useState<FilterType>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const searchInputRef = useRef<TextInput>(null);

  const { prefillDate } = useLocalSearchParams<{ prefillDate?: string }>();

  useEffect(() => {
    if (prefillDate) {
      setEditingTodo({ dueDate: prefillDate } as Partial<TodoItem> as any);
      setModalVisible(true);
      router.setParams({ prefillDate: '' });
    }
  }, [prefillDate]);

  const topInset = Platform.OS === 'web' ? 0 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const filtered = useMemo(() => {
    let list = [...todos];
    if (filter === 'active') list = list.filter(t => !t.completed);
    if (filter === 'completed') list = list.filter(t => t.completed);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        t => (t.text || '').toLowerCase().includes(q)
      );
    }
    const priorityOrder: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
    list.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });
    return list;
  }, [todos, filter, search]);

  const stats = useMemo(() => ({
    total: todos.length,
    active: todos.filter(t => !t.completed).length,
    completed: todos.filter(t => t.completed).length,
    overdue: todos.filter(t => isOverdue(t.dueDate, t.completed)).length,
  }), [todos]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setPage(0);
  }, [filter, search]);

  const paged = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page],
  );

  const openEdit = (todo: TodoItem) => {
    setEditingTodo(todo);
    setModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const openAdd = () => {
    setEditingTodo(null);
    setModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSave = async (data: Partial<TodoItem>) => {
    if (editingTodo) {
      await updateTodo(editingTodo.id, data);
    } else {
      await createTodo(data);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Task', 'Remove this task?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteTodo(id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  };

  const handleClearCompleted = () => {
    const completed = todos.filter(t => t.completed);
    if (completed.length === 0) return;
    Alert.alert('Clear Completed', `Remove ${completed.length} completed task${completed.length > 1 ? 's' : ''}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: async () => {
          for (const t of completed) await deleteTodo(t.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  };

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Done' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topInset + 16, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
            To-Do List
          </Text>
          {stats.total > 0 && (
            <Text style={[styles.headerSub, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              {stats.active} remaining · {stats.completed} done
              {stats.overdue > 0 ? ` · ${stats.overdue} overdue` : ''}
            </Text>
          )}
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              if (showSearch) {
                setShowSearch(false);
                setSearch('');
                Keyboard.dismiss();
              } else {
                setShowSearch(true);
                setTimeout(() => {
                  searchInputRef.current?.focus();
                }, 50);
              }
            }}
            style={[
              styles.searchHeaderBtn,
              {
                backgroundColor: showSearch ? colors.primary : colors.muted,
                borderRadius: 8,
              },
            ]}
            accessibilityLabel="Search tasks"
            accessibilityRole="button"
          >
            <Feather
              name={showSearch ? 'x' : 'search'}
              size={14}
              color={showSearch ? colors.primaryForeground : colors.mutedForeground}
            />
            <Text
              style={[
                styles.searchHeaderText,
                {
                  color: showSearch
                    ? colors.primaryForeground
                    : colors.mutedForeground,
                  fontFamily: 'Inter_500Medium',
                },
              ]}
            >
              {showSearch ? 'Close' : 'Search'}
            </Text>
          </Pressable>

          {stats.completed > 0 && (
            <Pressable onPress={handleClearCompleted} style={[styles.clearDoneBtn, { backgroundColor: colors.muted, borderRadius: 8 }]}>
              <Feather name="check-square" size={14} color={colors.mutedForeground} />
              <Text style={[styles.clearDoneText, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Clear done</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Search Bar */}
      {showSearch && (
        <View style={[styles.searchBarWrap, { borderBottomColor: colors.border }]}>
          <View
            style={[
              styles.searchInputBox,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
              },
            ]}
          >
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              ref={searchInputRef}
              style={[
                styles.searchInput,
                { color: colors.foreground, fontFamily: 'Inter_400Regular' },
              ]}
              placeholder="Search tasks…"
              placeholderTextColor={colors.mutedForeground}
              value={search}
              onChangeText={setSearch}
              accessibilityLabel="Search tasks"
              returnKeyType="search"
            />
            {search.length > 0 && (
              <Pressable
                onPress={() => setSearch('')}
                hitSlop={10}
                accessibilityLabel="Clear search text"
              >
                <Feather
                  name="x-circle"
                  size={15}
                  color={colors.mutedForeground}
                />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Filter chips */}
      <View style={[styles.filterRow, { borderBottomColor: colors.border }]}>
        {FILTERS.map(f => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => { setFilter(f.key); Haptics.selectionAsync(); }}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? colors.primary : colors.muted,
                  borderRadius: 20,
                },
              ]}
            >
              <Text style={[styles.filterChipText, { color: active ? colors.primaryForeground : colors.mutedForeground, fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>
                {f.label}
                {f.key === 'all' && stats.total > 0 ? ` (${stats.total})` : ''}
                {f.key === 'active' && stats.active > 0 ? ` (${stats.active})` : ''}
                {f.key === 'completed' && stats.completed > 0 ? ` (${stats.completed})` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={search ? 'search' : 'check-square'}
          title={
            search
              ? 'No matching tasks'
              : filter === 'completed'
              ? 'No completed tasks'
              : filter === 'active'
              ? 'No active tasks'
              : 'No tasks yet'
          }
          subtitle={
            search
              ? 'Try a different keyword or clear your search'
              : filter === 'all'
              ? 'Tap + to add your first task'
              : 'Switch filter to see other tasks'
          }
        />
      ) : (
        <FlatList
          data={paged}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 174, gap: 10 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TodoRow
              item={item}
              colors={colors}
              onToggle={async () => {
                await toggleTodo(item.id);
                Haptics.impactAsync(item.completed ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
              }}
              onEdit={() => openEdit(item)}
              onDelete={() => handleDelete(item.id)}
            />
          )}
          ListFooterComponent={
            filtered.length > PAGE_SIZE ? (
              <View style={styles.pagination}>
                <Pressable
                  onPress={() => {
                    setPage(p => Math.max(0, p - 1));
                    Haptics.selectionAsync();
                  }}
                  disabled={page === 0}
                  hitSlop={8}
                  style={[
                    styles.pageBtn,
                    { backgroundColor: colors.muted, opacity: page === 0 ? 0.4 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Previous page"
                >
                  <Feather name="chevron-left" size={18} color={colors.foreground} />
                </Pressable>

                <Text style={[styles.pageLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
                  Page {page + 1} of {totalPages}
                </Text>

                <Pressable
                  onPress={() => {
                    setPage(p => Math.min(totalPages - 1, p + 1));
                    Haptics.selectionAsync();
                  }}
                  disabled={page >= totalPages - 1}
                  hitSlop={8}
                  style={[
                    styles.pageBtn,
                    { backgroundColor: colors.muted, opacity: page >= totalPages - 1 ? 0.4 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Next page"
                >
                  <Feather name="chevron-right" size={18} color={colors.foreground} />
                </Pressable>
              </View>
            ) : null
          }
        />
      )}

      {/* FAB */}
      <Pressable
        onPress={openAdd}
        style={[styles.fab, { backgroundColor: colors.primary, bottom: bottomInset + 96 }]}
      >
        <Feather name="plus" size={26} color={colors.primaryForeground} />
      </Pressable>

      <TodoModal
        visible={modalVisible}
        colors={colors}
        insets={{ bottom: bottomInset, top: topInset }}
        initial={editingTodo ?? undefined}
        onClose={() => { setModalVisible(false); setEditingTodo(null); }}
        onSave={handleSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 28 },
  headerSub: { fontSize: 13, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchHeaderText: { fontSize: 12 },
  clearDoneBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6 },
  clearDoneText: { fontSize: 12 },

  searchBarWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 16,
  },
  pageBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageLabel: {
    fontSize: 13,
  },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7 },
  filterChipText: { fontSize: 13 },

  // Todo row
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  priorityStripe: { width: 4, alignSelf: 'stretch' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    flexShrink: 0,
  },
  todoText: { fontSize: 15, lineHeight: 21 },
  todoMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 2 },
  priorityBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  priorityText: { fontSize: 11 },
  dueBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  dueText: { fontSize: 11 },
  rowActions: { flexDirection: 'column', gap: 4, paddingRight: 12, paddingVertical: 10 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center' },
  kavWrapper: { width: '100%', paddingHorizontal: 20 },
  modalSheet: {
    borderRadius: 24,
    paddingTop: 16,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },

  // Fixed header (new)
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerBtn: { paddingVertical: 6, paddingRight: 6, minWidth: 60 },
  headerBtnText: { fontSize: 15 },
  modalTitle: { fontSize: 17, flex: 1, textAlign: 'center' },
  headerSaveBtn: { paddingHorizontal: 16, paddingVertical: 8, minWidth: 60, alignItems: 'center' },
  headerSaveBtnText: { fontSize: 15 },

  // Scrollable body (new)
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },

  todoInput: {
    fontSize: 16,
    padding: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    lineHeight: 23,
  },
  modalLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4 },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityChip: { paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1.5 },
  priorityChipText: { fontSize: 14 },
  dueDateRow: { flexDirection: 'row', gap: 8 },
  dueDateBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1 },
  clearBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});