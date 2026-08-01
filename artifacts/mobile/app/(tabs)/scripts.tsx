import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import Animated, { FadeInUp, FadeInDown, FadeOutUp } from "react-native-reanimated";
import { DailyAIIdeaCard } from "@/components/DailyAIIdeaCard";
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '@/context/DataContext';
import { ScriptCard } from '@/components/ScriptCard';
import { FilterChip } from '@/components/FilterChip';
import { EmptyState } from '@/components/EmptyState';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ScriptStatus } from '@/types';

type Filter = 'all' | ScriptStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'not_started', label: 'Not Started' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

export default function ScriptsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { scripts, categories, updateScript, deleteScripts } = useData();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // ── Multi-select state ──
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const filtered = useMemo(() => {
    let result = scripts;
    result = result.filter(s => !s.categoryIds.includes("All"));
    if (filter !== 'all') {
      result = result.filter(s => s.status === filter);
    } else {
      result = result.filter(s => s.status !== 'completed');
    }
    if (selectedCategory) result = result.filter(s => s.categoryIds.includes(selectedCategory));
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        s =>
          s.title.toLowerCase().includes(q) ||
          s.notes.toLowerCase().includes(q) ||
          s.reference.toLowerCase().includes(q),
      );
    }
    return [...result].sort(
      (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime(),
    );
  }, [scripts, filter, search, selectedCategory]);

  // ── Selection helpers ──
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      // Auto-exit selection mode if nothing is selected
      if (next.size === 0) {
        setSelectionMode(false);
      }
      return next;
    });
  }, []);

  const enterSelectionMode = useCallback((id: string) => {
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  const cancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filtered.map(s => s.id)));
  }, [filtered]);

  const handleBulkDelete = useCallback(() => {
    const count = selectedIds.size;
    if (count === 0) return;

    Alert.alert(
      'Delete Scripts',
      `Are you sure you want to delete ${count} script${count > 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteScripts(Array.from(selectedIds));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              cancelSelection();
            } catch (e: any) {
              Alert.alert('Error', e.message ?? 'Failed to delete scripts.');
            }
          },
        },
      ],
    );
  }, [selectedIds, deleteScripts, cancelSelection]);

  const renderItem = useCallback(
    ({ item }: { item: typeof scripts[0] }) => (
      <ScriptCard
        script={item}
        categories={categories}
        onPress={() => router.push(`/script/${item.id}`)}
        onStatusChange={(status) => updateScript(item.id, { status })}
        selectionMode={selectionMode}
        selected={selectedIds.has(item.id)}
        onSelect={() => toggleSelect(item.id)}
        onLongPress={() => {
          if (!selectionMode) {
            enterSelectionMode(item.id);
          } else {
            toggleSelect(item.id);
          }
        }}
      />
    ),
    [categories, selectionMode, selectedIds, toggleSelect, enterSelectionMode],
  );

  const listHeader = (
    <View style={{ gap: 16, paddingBottom: 8, paddingTop: 4 }}>
      {/* ── Daily AI Content Idea (if Niches are configured) ── */}
      <Animated.View
        entering={FadeInUp.delay(150).springify()}
        style={{ marginHorizontal: 16 }}
      >
        <DailyAIIdeaCard />
      </Animated.View>

      {/* Search */}
      <View
        style={[
          styles.searchWrap,
          {
            backgroundColor: colors.muted,
            borderRadius: colors.radius,
            borderColor: colors.border,
            marginHorizontal: 16,
          },
        ]}
      >
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[
            styles.searchInput,
            { color: colors.foreground, fontFamily: 'Inter_400Regular' },
          ]}
          placeholder="Search title, notes, reference…"
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <Feather name="x" size={15} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {/* Status filters */}
      <View style={{ paddingHorizontal: 16 }}>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={i => i.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          renderItem={({ item }) => (
            <FilterChip
              label={item.label}
              active={filter === item.key}
              onPress={() => setFilter(item.key)}
            />
          )}
        />
      </View>

      {/* Category filters */}
      {categories.length > 0 && (
        <View style={{ paddingHorizontal: 16 }}>
          <FlatList
            horizontal
            data={categories}
            keyExtractor={c => c.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
            renderItem={({ item }) => (
              <FilterChip
                label={item.name}
                active={selectedCategory === item.id}
                onPress={() =>
                  setSelectedCategory(
                    selectedCategory === item.id ? null : item.id,
                  )
                }
                color={item.color}
              />
            )}
          />
        </View>
      )}
    </View>
  );


  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header — normal or selection mode */}
      {selectionMode ? (
        <Animated.View
          entering={FadeInDown.duration(250)}
          style={[
            styles.selectionBar,
            {
              paddingTop: topInset + 12,
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Pressable onPress={cancelSelection} hitSlop={12} style={styles.selBarBtn}>
            <Feather name="x" size={22} color={colors.foreground} />
          </Pressable>

          <Text
            style={[
              styles.selBarCount,
              { color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
            ]}
          >
            {selectedIds.size} selected
          </Text>

          <View style={styles.selBarActions}>
            <Pressable
              onPress={selectAll}
              hitSlop={8}
              style={[styles.selBarActionBtn, { backgroundColor: colors.muted }]}
            >
              <Feather name="check-square" size={16} color={colors.primary} />
              <Text style={[styles.selBarActionText, { color: colors.primary, fontFamily: 'Inter_500Medium' }]}>
                All
              </Text>
            </Pressable>

            <Pressable
              onPress={handleBulkDelete}
              hitSlop={8}
              style={[styles.selBarActionBtn, { backgroundColor: colors.destructive + '15' }]}
            >
              <Feather name="trash-2" size={16} color={colors.destructive} />
              <Text style={[styles.selBarActionText, { color: colors.destructive, fontFamily: 'Inter_500Medium' }]}>
                Delete
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : (
        <View style={[styles.topBar, { paddingTop: topInset + 12 }]}>
          <Text
            style={[
              styles.title,
              { color: colors.foreground, fontFamily: 'Inter_700Bold' },
            ]}
          >
            Scripts
          </Text>
          <Text
            style={[
              styles.count,
              {
                color: colors.mutedForeground,
                fontFamily: 'Inter_400Regular',
              },
            ]}
          >
            {scripts.length} total
          </Text>
        </View>
      )}

      {/* List */}

      <FlatList
        data={filtered}
        keyExtractor={s => s.id}
        renderItem={renderItem}
        extraData={selectedIds}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: bottomInset + 172 },
        ]}
        ListEmptyComponent={
          <EmptyState
            icon="file-text"
            title={search ? 'No results found' : 'No scripts yet'}
            subtitle={search ? 'Try a different search term' : 'Tap the + button to create your first script'}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* FAB — hidden in selection mode */}
      {!selectionMode && (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/script/new');
          }}
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  title: { fontSize: 28, fontWeight: '700' },
  count: { fontSize: 14 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 15 },
  listContent: { paddingTop: 6 },
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
  // ── Selection bar styles ──
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  selBarBtn: {
    padding: 4,
  },
  selBarCount: {
    fontSize: 16,
    flex: 1,
  },
  selBarActions: {
    flexDirection: 'row',
    gap: 8,
  },
  selBarActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  selBarActionText: {
    fontSize: 13,
  },
});
