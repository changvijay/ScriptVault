import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import Animated, { FadeInUp, FadeInDown, FadeIn, Layout } from 'react-native-reanimated';
import { DailyAIIdeaCard } from '@/components/DailyAIIdeaCard';
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
  { key: 'not_started', label: 'Not started' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
];

// ── Spacing scale — replaces the scattered "magic numbers" (172, 67, 34…)
// from the original file with a single consistent rhythm. ──
const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

// ── Pagination — a fixed page size keeps each screen scannable and gives
// predictable "page X of Y" navigation, rather than an open-ended infinite
// scroll that's harder to resume from later. ──
const PAGE_SIZE = 5;

export default function ScriptsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { scripts, categories, updateScript, deleteScripts } = useData();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const filtered = useMemo(() => {
    let result = scripts;
    result = result.filter(s => !s.categoryIds.includes('All'));
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Any change to what's being filtered/searched invalidates the current
  // page — reset to page 1 so users don't land on an empty page.
  useEffect(() => {
    setPage(0);
  }, [filter, search, selectedCategory]);

  const paged = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page],
  );

  const activeFilterCount = (filter !== 'all' ? 1 : 0) + (selectedCategory ? 1 : 0);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  }, []);

  const enterSelectionMode = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  const cancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  // Selects everything on the current page — matches what's visibly on
  // screen, so users aren't surprised by items selected off-page.
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(paged.map(s => s.id)));
  }, [paged]);

  const handleBulkDelete = useCallback(() => {
    const count = selectedIds.size;
    if (count === 0) return;

    Alert.alert(
      `Delete ${count} script${count > 1 ? 's' : ''}?`,
      'This cannot be undone.',
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
              Alert.alert('Couldn\u2019t delete scripts', e.message ?? 'Please try again.');
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
          if (!selectionMode) enterSelectionMode(item.id);
          else toggleSelect(item.id);
        }}
        accessibilityRole="button"
        accessibilityLabel={item.title}
        accessibilityState={{ selected: selectedIds.has(item.id) }}
      />
    ),
    [categories, selectionMode, selectedIds, toggleSelect, enterSelectionMode],
  );

  const listHeader = (
    <View style={{ paddingBottom: SPACE.sm, paddingTop: SPACE.xs }}>
      <Animated.View entering={FadeInUp.delay(120).springify()} style={{ marginHorizontal: SPACE.lg }}>
        <DailyAIIdeaCard />
      </Animated.View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header — normal or selection mode ── */}
      {selectionMode ? (
        <Animated.View
          entering={FadeInDown.duration(220)}
          style={[
            styles.selectionBar,
            {
              paddingTop: topInset + SPACE.md,
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
              shadowColor: '#000',
            },
          ]}
        >
          <Pressable
            onPress={cancelSelection}
            hitSlop={12}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Cancel selection"
          >
            <Feather name="x" size={22} color={colors.foreground} />
          </Pressable>

          <Text style={[styles.selBarCount, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
            {selectedIds.size} selected
          </Text>

          <View style={styles.selBarActions}>
            <Pressable
              onPress={selectAll}
              hitSlop={8}
              style={[styles.pillBtn, { backgroundColor: colors.muted }]}
              accessibilityRole="button"
              accessibilityLabel="Select all scripts"
            >
              <Feather name="check-square" size={15} color={colors.primary} />
              <Text style={[styles.pillBtnText, { color: colors.primary, fontFamily: 'Inter_500Medium' }]}>
                All
              </Text>
            </Pressable>

            <Pressable
              onPress={handleBulkDelete}
              hitSlop={8}
              style={[styles.pillBtn, { backgroundColor: colors.destructive }]}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${selectedIds.size} selected scripts`}
            >
              <Feather name="trash-2" size={15} color="#FFF" />
              <Text style={[styles.pillBtnText, { color: '#FFF', fontFamily: 'Inter_600SemiBold' }]}>
                Delete
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : (
        <View style={[styles.topBar, { paddingTop: topInset + SPACE.md }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
              Scripts
            </Text>
            <View style={[styles.countBadge, { backgroundColor: colors.muted }]}>
              <Text style={[styles.countBadgeText, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
                {scripts.length}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ── Sticky control bar: search + a single filter icon ──
          Status and category used to be two separate always-visible rows.
          Collapsing both behind one icon keeps the default view calm and
          scannable, and puts a badge on the icon so active filters are
          still obvious at a glance without taking up permanent space. */}
      {!selectionMode && (
        <View style={[styles.controlBar, { backgroundColor: colors.background }]}>
          <View
            style={[
              styles.searchWrap,
              { backgroundColor: colors.muted, borderRadius: 12, borderColor: colors.border },
            ]}
          >
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
              placeholder="Search title, notes, reference…"
              placeholderTextColor={colors.mutedForeground}
              value={search}
              onChangeText={setSearch}
              accessibilityLabel="Search scripts"
              returnKeyType="search"
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={10} accessibilityLabel="Clear search">
                <Feather name="x-circle" size={15} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>

          <Pressable
            onPress={() => setFilterSheetOpen(true)}
            hitSlop={8}
            style={[
              styles.filterIconBtn,
              {
                backgroundColor: activeFilterCount > 0 ? colors.primary : colors.muted,
                borderColor: colors.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : 'Filters'
            }
          >
            <Feather
              name="sliders"
              size={17}
              color={activeFilterCount > 0 ? colors.primaryForeground : colors.foreground}
            />
            {activeFilterCount > 0 && (
              <View style={[styles.filterBadge, { backgroundColor: colors.destructive }]}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      )}

      {/* ── Combined status + category filter sheet ──
          One entry point for both filter dimensions, instead of two
          permanently-visible rows competing for attention above the list. */}
      <Modal
        visible={filterSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterSheetOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setFilterSheetOpen(false)}>
          <Animated.View
            entering={FadeIn.duration(150)}
            style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: bottomInset + SPACE.lg }]}
            // Stop backdrop press from bubbling when tapping inside the sheet
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeaderRow}>
              <Text style={[styles.sheetTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
                Filters
              </Text>
              {activeFilterCount > 0 && (
                <Pressable
                  onPress={() => {
                    setFilter('all');
                    setSelectedCategory(null);
                  }}
                  hitSlop={8}
                >
                  <Text style={[styles.clearText, { color: colors.primary, fontFamily: 'Inter_500Medium' }]}>
                    Clear all
                  </Text>
                </Pressable>
              )}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
              STATUS
            </Text>
            <View style={styles.sheetChipRow}>
              {FILTERS.map(f => (
                <FilterChip
                  key={f.key}
                  label={f.label}
                  active={filter === f.key}
                  onPress={() => setFilter(f.key)}
                />
              ))}
            </View>

            {categories.length > 0 && (
              <>
                <Text
                  style={[
                    styles.sectionLabel,
                    { color: colors.mutedForeground, fontFamily: 'Inter_500Medium', marginTop: SPACE.lg },
                  ]}
                >
                  CATEGORIES
                </Text>
                <View style={styles.sheetChipRow}>
                  {categories.map(c => (
                    <FilterChip
                      key={c.id}
                      label={c.name}
                      active={selectedCategory === c.id}
                      onPress={() => setSelectedCategory(selectedCategory === c.id ? null : c.id)}
                      color={c.color}
                    />
                  ))}
                </View>
              </>
            )}

            <Pressable
              onPress={() => setFilterSheetOpen(false)}
              style={[styles.sheetApplyBtn, { backgroundColor: colors.primary }]}
              accessibilityRole="button"
            >
              <Text style={[styles.sheetApplyText, { color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }]}>
                Show results
              </Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* ── List ── */}
      <FlatList
        data={paged}
        keyExtractor={s => s.id}
        renderItem={renderItem}
        extraData={selectedIds}
        ListHeaderComponent={listHeader}
        itemLayoutAnimation={Layout.springify()}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset + 172 }]}
        ListFooterComponent={
          filtered.length > PAGE_SIZE ? (
            <View style={styles.pagination}>
              <Pressable
                onPress={() => setPage(p => Math.max(0, p - 1))}
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
                onPress={() => setPage(p => Math.min(totalPages - 1, p + 1))}
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
        ListEmptyComponent={
          <EmptyState
            icon={search ? 'search' : 'file-text'}
            title={search ? 'No matches found' : 'No scripts yet'}
            subtitle={
              search
                ? 'Try a different keyword, or clear your search.'
                : 'Tap + to draft your first script.'
            }
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* ── FAB ── */}
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
              bottom: bottomInset + SPACE.xxl + 68,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="New script"
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
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.md,
  },
  title: { fontSize: 30, letterSpacing: -0.4 },
  countBadge: {
    paddingHorizontal: SPACE.sm,
    paddingVertical: 3,
    borderRadius: 999,
    minWidth: 26,
    alignItems: 'center',
  },
  countBadgeText: { fontSize: 12 },

  sectionLabel: {
    fontSize: 11,
    letterSpacing: 0.6,
    marginBottom: SPACE.sm,
  },

  controlBar: {
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.md,
    flexDirection: 'row',
    gap: SPACE.sm,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACE.md,
    paddingVertical: 10,
    gap: SPACE.sm,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },

  filterIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.sm,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00000022',
    marginBottom: SPACE.md,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACE.lg,
  },
  sheetTitle: { fontSize: 19 },
  clearText: { fontSize: 14 },
  sheetChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.sm,
  },
  sheetApplyBtn: {
    marginTop: SPACE.xl,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  sheetApplyText: { fontSize: 15 },

  listContent: { paddingTop: SPACE.xs },

  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.lg,
    paddingVertical: SPACE.lg,
  },
  pageBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageLabel: { fontSize: 13 },

  fab: {
    position: 'absolute',
    right: SPACE.lg,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  // ── Selection bar ──
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: SPACE.md,
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  iconBtn: { padding: 4 },
  selBarCount: { fontSize: 16, flex: 1 },
  selBarActions: { flexDirection: 'row', gap: SPACE.sm },
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: 10,
    minHeight: 40,
  },
  pillBtnText: { fontSize: 13 },
});