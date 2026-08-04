import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '@/context/DataContext';
import { GoalCard } from '@/components/GoalCard';
import { EmptyState } from '@/components/EmptyState';
import { DatePickerModal } from "@/components/DatePickerModal";
import { Feather } from '@expo/vector-icons';
import { Goal } from '@/types';
import * as Haptics from 'expo-haptics';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

type GoalMode = 'create' | 'edit';

interface GoalForm {
  title: string;
  targetValue: string;
  currentProgress: string;
  deadline: Date | null;
}

const QUICK_TEMPLATES = [
  'Complete 10 scripts this month',
  'Finish 3 scripts this week',
  'Write for 30 minutes every day',
  'Complete 5 scripts in progress',
];

export default function GoalsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { goals, createGoal, updateGoal, deleteGoal } = useData();

  const [modalVisible, setModalVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [mode, setMode] = useState<GoalMode>('create');
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [form, setForm] = useState<GoalForm>({
    title: '',
    targetValue: '10',
    currentProgress: '0',
    deadline: null,
  });

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const active = goals.filter(g => !g.completed);
  const completed = goals.filter(g => g.completed);

  const openCreate = () => {
    setMode('create');
    setEditingGoal(null);
    setForm({ title: '', targetValue: '10', currentProgress: '0', deadline: null });
    setModalVisible(true);
  };

  const openEdit = (goal: Goal) => {
    setMode('edit');
    setEditingGoal(goal);
    setForm({
      title: goal.title,
      targetValue: String(goal.targetValue),
      currentProgress: String(goal.currentProgress),
      deadline: goal.deadline ? new Date(goal.deadline) : null,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    const target = parseInt(form.targetValue) || 1;
    const progress = parseInt(form.currentProgress) || 0;
    const deadlineStr = form.deadline
      ? form.deadline.toISOString().split('T')[0]
      : null;

    if (mode === 'create') {
      await createGoal({
        title: form.title.trim(),
        targetValue: target,
        currentProgress: progress,
        deadline: deadlineStr,
      });
    } else if (editingGoal) {
      await updateGoal(editingGoal.id, {
        title: form.title.trim(),
        targetValue: target,
        currentProgress: progress,
        deadline: deadlineStr,
        completed: progress >= target,
      });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setModalVisible(false);
  };

  const handleDelete = () => {
    if (!editingGoal) return;
    Alert.alert('Delete Goal', 'Are you sure you want to delete this goal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteGoal(editingGoal.id);
          setModalVisible(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  };

  const formatDeadline = (d: Date) =>
    `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.topBar, { paddingTop: topInset + 12 }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
          Goals
        </Text>
        <View style={styles.topBadges}>
          <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.badgeText, { color: colors.primary, fontFamily: 'Inter_500Medium' }]}>
              {active.length} active
            </Text>
          </View>
          {completed.length > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.completed + '20' }]}>
              <Text style={[styles.badgeText, { color: colors.completed, fontFamily: 'Inter_500Medium' }]}>
                {completed.length} done
              </Text>
            </View>
          )}
        </View>
      </View>

      <FlatList
        data={[...active, ...completed]}
        keyExtractor={g => g.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: bottomInset + 172 }}
        ListHeaderComponent={
          active.length === 0 && completed.length === 0 ? null : (
            <>
              {active.length > 0 && (
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
                  ACTIVE
                </Text>
              )}
            </>
          )
        }
        ListEmptyComponent={
          <EmptyState
            icon="flag"
            title="No goals yet"
            subtitle="Set personal goals to track your scripting progress"
          />
        }
        renderItem={({ item, index }) => {
          const isFirstCompleted = item.completed && (index === 0 || !goals[index - 1]?.completed);
          return (
            <>
              {isFirstCompleted && completed.length > 0 && (
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium', marginTop: 12 }]}>
                  COMPLETED
                </Text>
              )}
              <GoalCard
                goal={item}
                onPress={() => openEdit(item)}
                onIncrement={() => {
                  const newProgress = item.currentProgress + 1;
                  updateGoal(item.id, {
                    currentProgress: newProgress,
                    completed: newProgress >= item.targetValue,
                  });
                }}
              />
            </>
          );
        }}
      />

      {/* FAB */}
      <Pressable
        onPress={openCreate}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: colors.primary,
            bottom: bottomInset + 100,
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.95 : 1 }],
            borderRadius: 32,
          },
        ]}
      >
        <Feather name="plus" size={26} color={colors.primaryForeground} />
      </Pressable>

      {/* Goal Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            {/* Modal header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Pressable onPress={() => setModalVisible(false)}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
              <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
                {mode === 'create' ? 'New Goal' : 'Edit Goal'}
              </Text>
              <Pressable onPress={handleSave}>
                <Text style={[{ color: form.title.trim() ? colors.primary : colors.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 16 }]}>
                  Save
                </Text>
              </Pressable>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 20 }} keyboardShouldPersistTaps="handled">
              {/* Title */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Goal Title</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, fontFamily: 'Inter_400Regular' }]}
                  value={form.title}
                  onChangeText={t => setForm(f => ({ ...f, title: t }))}
                  placeholder="e.g. Complete 10 scripts this month"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              {/* Quick templates */}
              {mode === 'create' && (
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Quick Templates</Text>
                  <View style={{ gap: 8 }}>
                    {QUICK_TEMPLATES.map(t => (
                      <Pressable
                        key={t}
                        onPress={() => setForm(f => ({ ...f, title: t }))}
                        style={[styles.templateChip, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: 8 }]}
                      >
                        <Text style={[styles.templateText, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}>{t}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {/* Target & Progress */}
              <View style={styles.row}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Target</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, fontFamily: 'Inter_400Regular' }]}
                    value={form.targetValue}
                    onChangeText={t => setForm(f => ({ ...f, targetValue: t }))}
                    keyboardType="numeric"
                    placeholder="10"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Progress</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, fontFamily: 'Inter_400Regular' }]}
                    value={form.currentProgress}
                    onChangeText={t => setForm(f => ({ ...f, currentProgress: t }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
              </View>

              {/* Deadline */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Deadline (optional)</Text>
                <View style={styles.row}>
                  <Pressable
                    onPress={() => setDatePickerVisible(true)}
                    style={[styles.dateBtn, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: colors.radius, flex: 1 }]}
                  >
                    <Feather name="calendar" size={15} color={colors.mutedForeground} />
                    <Text style={[{ color: form.deadline ? colors.foreground : colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 15 }]}>
                      {form.deadline ? formatDeadline(form.deadline) : 'Set deadline'}
                    </Text>
                  </Pressable>
                  {form.deadline && (
                    <Pressable
                      onPress={() => setForm(f => ({ ...f, deadline: null }))}
                      style={[styles.clearBtn, { backgroundColor: colors.muted, borderRadius: 8 }]}
                    >
                      <Feather name="x" size={16} color={colors.mutedForeground} />
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Delete */}
              {mode === 'edit' && (
                <Pressable onPress={handleDelete} style={[styles.deleteBtn, { borderColor: colors.destructive + '60', borderRadius: colors.radius }]}>
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                  <Text style={[{ color: colors.destructive, fontFamily: 'Inter_500Medium', fontSize: 15 }]}>Delete Goal</Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>

        <DatePickerModal
          visible={datePickerVisible}
          date={form.deadline}
          blockPastDates={true}
          onConfirm={d => { setForm(f => ({ ...f, deadline: d })); setDatePickerVisible(false); }}
          onClose={() => setDatePickerVisible(false)}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 28, fontWeight: '700' },
  topBadges: { flexDirection: 'row', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 13 },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
  },
  row: { flexDirection: 'row', gap: 12 },
  templateChip: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
  },
  templateText: { fontSize: 14 },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  clearBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1,
    marginTop: 8,
  },
});
