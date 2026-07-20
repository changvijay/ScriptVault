import React, { useState, useMemo } from 'react';
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
} from 'react-native';
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
  low:    { label: 'Low',    color: '#6B7280' },
  medium: { label: 'Medium', color: '#F59E0B' },
  high:   { label: 'High',   color: '#EF4444' },
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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
  insets: { bottom: number };
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
  React.useEffect(() => {
    if (visible) {
      setText(initial?.text ?? '');
      setPriority(initial?.priority ?? 'medium');
      setDueDate(initial?.dueDate ? new Date(initial.dueDate) : null);
    }
  }, [visible]);

  const handleSave = () => {
    if (!text.trim()) return;
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.modalSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />

          <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
            {isEditing ? 'Edit Task' : 'New Task'}
          </Text>

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

          {/* Save */}
          <Pressable
            onPress={handleSave}
            disabled={!text.trim()}
            style={[styles.saveBtn, { backgroundColor: text.trim() ? colors.primary : colors.muted, borderRadius: 12 }]}
          >
            <Text style={[styles.saveBtnText, { color: text.trim() ? colors.primaryForeground : colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
              {isEditing ? 'Save Changes' : 'Add Task'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={datePicker}
        date={dueDate}
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

  const topInset = Platform.OS === 'web' ? 0 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const filtered = useMemo(() => {
    let list = [...todos];
    if (filter === 'active') list = list.filter(t => !t.completed);
    if (filter === 'completed') list = list.filter(t => t.completed);
    // Sort: incomplete first, then by priority (high > medium > low), then by due date
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
  }, [todos, filter]);

  const stats = useMemo(() => ({
    total: todos.length,
    active: todos.filter(t => !t.completed).length,
    completed: todos.filter(t => t.completed).length,
    overdue: todos.filter(t => isOverdue(t.dueDate, t.completed)).length,
  }), [todos]);

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
          {stats.completed > 0 && (
            <Pressable onPress={handleClearCompleted} style={[styles.clearDoneBtn, { backgroundColor: colors.muted, borderRadius: 8 }]}>
              <Feather name="check-square" size={14} color={colors.mutedForeground} />
              <Text style={[styles.clearDoneText, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Clear done</Text>
            </Pressable>
          )}
        </View>
      </View>

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
          icon="check-square"
          title={filter === 'completed' ? 'No completed tasks' : filter === 'active' ? 'No active tasks' : 'No tasks yet'}
          subtitle={filter === 'all' ? 'Tap + to add your first task' : 'Switch filter to see other tasks'}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 100, gap: 10 }}
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
        insets={{ bottom: bottomInset }}
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
  clearDoneBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6 },
  clearDoneText: { fontSize: 12 },

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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  modalTitle: { fontSize: 20 },
  modalLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4 },
  todoInput: {
    fontSize: 16,
    padding: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    lineHeight: 23,
  },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityChip: { paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1.5 },
  priorityChipText: { fontSize: 14 },
  dueDateRow: { flexDirection: 'row', gap: 8 },
  dueDateBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1 },
  clearBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  saveBtn: { paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  saveBtnText: { fontSize: 16 },

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
