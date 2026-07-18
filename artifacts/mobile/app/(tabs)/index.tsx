import React, { useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '@/context/DataContext';
import { ProgressRing } from '@/components/ProgressRing';
import { StatCard } from '@/components/StatCard';
import { ScriptCard } from '@/components/ScriptCard';
import { GoalCard } from '@/components/GoalCard';
import { EmptyState } from '@/components/EmptyState';
import { router } from 'expo-router';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { scripts, categories, goals } = useData();

  const now = new Date();

  const stats = useMemo(() => {
    const total = scripts.length;
    const completed = scripts.filter(s => s.status === 'completed').length;
    const inProgress = scripts.filter(s => s.status === 'in_progress').length;
    const overdue = scripts.filter(s => {
      if (!s.deadline || s.status === 'completed') return false;
      return new Date(s.deadline) < now;
    }).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, overdue, pct };
  }, [scripts]);

  const recentScripts = useMemo(
    () =>
      [...scripts]
        .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
        .slice(0, 4),
    [scripts],
  );

  const upcomingDeadlines = useMemo(() => {
    const in7 = new Date(now.getTime() + 7 * 86400000);
    return scripts
      .filter(
        s =>
          s.deadline &&
          s.status !== 'completed' &&
          new Date(s.deadline) >= now &&
          new Date(s.deadline) <= in7,
      )
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
      .slice(0, 3);
  }, [scripts]);

  const activeGoals = useMemo(() => goals.filter(g => !g.completed).slice(0, 3), [goals]);

  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topInset + 16, paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            {DAYS[now.getDay()]}, {MONTHS_SHORT[now.getMonth()]} {now.getDate()}
          </Text>
          <Text style={[styles.appName, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
            ScriptVault
          </Text>
        </View>
        <View style={[styles.headerBadge, { backgroundColor: colors.primary + '20' }]}>
          <Text style={[styles.headerBadgeText, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
            {stats.total} scripts
          </Text>
        </View>
      </View>

      {/* Progress ring + stats */}
      <View style={[styles.progressCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
        <ProgressRing
          progress={stats.pct}
          size={110}
          strokeWidth={10}
          color={colors.primary}
          backgroundColor={colors.muted}
          label={`${stats.pct}%`}
          sublabel="Complete"
          labelColor={colors.foreground}
          sublabelColor={colors.mutedForeground}
        />
        <View style={styles.statsGrid}>
          <View style={styles.statRow}>
            <StatCard label="Total" value={stats.total} accent={colors.primary} small />
            <StatCard label="Done" value={stats.completed} accent={colors.completed} small />
          </View>
          <View style={styles.statRow}>
            <StatCard label="Active" value={stats.inProgress} accent={colors.inProgress} small />
            <StatCard label="Overdue" value={stats.overdue} accent={stats.overdue > 0 ? colors.destructive : colors.mutedForeground} small />
          </View>
        </View>
      </View>

      {/* Goals */}
      {activeGoals.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
              Active Goals
            </Text>
            <Pressable onPress={() => router.push('/(tabs)/goals')}>
              <Text style={[styles.seeAll, { color: colors.primary, fontFamily: 'Inter_500Medium' }]}>See all</Text>
            </Pressable>
          </View>
          {activeGoals.map(goal => (
            <GoalCard key={goal.id} goal={goal} onPress={() => router.push('/(tabs)/goals')} />
          ))}
        </View>
      )}

      {/* Upcoming deadlines */}
      {upcomingDeadlines.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, styles.sectionTitlePad, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
            Due This Week
          </Text>
          {upcomingDeadlines.map(script => (
            <ScriptCard
              key={script.id}
              script={script}
              categories={categories}
              onPress={() => router.push(`/script/${script.id}`)}
            />
          ))}
        </View>
      )}

      {/* Recent scripts */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
            Recent Scripts
          </Text>
          <Pressable onPress={() => router.push('/(tabs)/scripts')}>
            <Text style={[styles.seeAll, { color: colors.primary, fontFamily: 'Inter_500Medium' }]}>See all</Text>
          </Pressable>
        </View>
        {recentScripts.length === 0 ? (
          <EmptyState
            icon="file-text"
            title="No scripts yet"
            subtitle="Tap the Scripts tab to create your first script"
          />
        ) : (
          recentScripts.map(script => (
            <ScriptCard
              key={script.id}
              script={script}
              categories={categories}
              onPress={() => router.push(`/script/${script.id}`)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  greeting: { fontSize: 13, marginBottom: 2 },
  appName: { fontSize: 26, fontWeight: '700' },
  headerBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  headerBadgeText: { fontSize: 13 },
  progressCard: {
    marginHorizontal: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    borderWidth: 1,
  },
  statsGrid: { flex: 1, gap: 8 },
  statRow: { flexDirection: 'row', gap: 8 },
  section: { gap: 4 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  sectionTitlePad: { paddingHorizontal: 20, marginBottom: 4 },
  seeAll: { fontSize: 14 },
});
