import React, { useMemo } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useData } from "@/context/DataContext";
import { ProgressRing } from "@/components/ProgressRing";
import { StatCard } from "@/components/StatCard";
import { ScriptCard } from "@/components/ScriptCard";
import { GoalCard } from "@/components/GoalCard";
import { EmptyState } from "@/components/EmptyState";
import { MonthCalendar } from "@/components/MonthCalendar";
import { router } from "expo-router";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function isOverdue(dueDate: string | null, completed: boolean): boolean {
  if (!dueDate || completed) return false;
  return new Date(dueDate + "T23:59:59") < new Date();
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { scripts, categories, goals, todos } = useData();

  const now = new Date();

  // ── Script stats ──────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = scripts.length;
    const completed = scripts.filter((s) => s.status === "completed").length;
    const inProgress = scripts.filter((s) => s.status === "in_progress").length;
    const notStarted = scripts.filter((s) => s.status === "not_started").length;
    const overdue = scripts.filter((s) => {
      if (!s.deadline || s.status === "completed") return false;
      return new Date(s.deadline) < now;
    }).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, notStarted, overdue, pct };
  }, [scripts]);

  // ── Todo stats ────────────────────────────────────────────────────
  const todoStats = useMemo(() => {
    const total = todos.length;
    const completed = todos.filter((t) => t.completed).length;
    const active = todos.filter((t) => !t.completed).length;
    const overdueCount = todos.filter((t) =>
      isOverdue(t.dueDate, t.completed),
    ).length;
    const highPriority = todos.filter(
      (t) => !t.completed && t.priority === "high",
    ).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      total,
      completed,
      active,
      overdue: overdueCount,
      highPriority,
      pct,
    };
  }, [todos]);

  const recentScripts = useMemo(
    () =>
      [...scripts]
        .sort(
          (a, b) =>
            new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime(),
        )
        .slice(0, 4),
    [scripts],
  );

  const upcomingDeadlines = useMemo(() => {
    const in7 = new Date(now.getTime() + 7 * 86400000);
    return scripts
      .filter(
        (s) =>
          s.deadline &&
          s.status !== "completed" &&
          new Date(s.deadline) >= now &&
          new Date(s.deadline) <= in7,
      )
      .sort(
        (a, b) =>
          new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime(),
      )
      .slice(0, 3);
  }, [scripts]);

  const activeGoals = useMemo(
    () => goals.filter((g) => !g.completed).slice(0, 3),
    [goals],
  );

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  // Tab bar is 84px on web, ~83px on iOS native → +100 clears it with room
  const bottomPad = Platform.OS === "web" ? 100 : insets.bottom + 100;

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topInset + 16, paddingBottom: bottomPad },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text
            style={[
              styles.greeting,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {DAYS[now.getDay()]}, {MONTHS_SHORT[now.getMonth()]} {now.getDate()}
          </Text>
          <Text
            style={[
              styles.appName,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            ScriptVault
          </Text>
        </View>
        <View style={styles.headerBadges}>
          <View
            style={[
              styles.headerBadge,
              { backgroundColor: colors.primary + "20" },
            ]}
          >
            <Text
              style={[
                styles.headerBadgeText,
                { color: colors.primary, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              {stats.total} scripts
            </Text>
          </View>
          {todos.length > 0 && (
            <View
              style={[
                styles.headerBadge,
                { backgroundColor: colors.inProgress + "20" },
              ]}
            >
              <Text
                style={[
                  styles.headerBadgeText,
                  { color: colors.inProgress, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {todoStats.active} tasks
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Scripts KPI ── */}
      <View
        style={[
          styles.kpiCard,
          {
            backgroundColor: colors.card,
            borderRadius: colors.radius,
            borderColor: colors.border,
          },
        ]}
      >
        {/* Card header */}
        <View style={styles.kpiCardHead}>
          <Text
            style={[
              styles.kpiCardTitle,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            Scripts
          </Text>
          <Text
            style={[
              styles.kpiCardSub,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {stats.pct}% complete
          </Text>
        </View>

        {/* Ring + stats grid */}
        <View style={styles.kpiBody}>
          <ProgressRing
            progress={stats.pct}
            size={100}
            strokeWidth={9}
            color={colors.primary}
            backgroundColor={colors.muted}
            label={`${stats.pct}%`}
            sublabel="Done"
            labelColor={colors.foreground}
            sublabelColor={colors.mutedForeground}
          />
          <View style={styles.kpiGrid}>
            <View style={styles.kpiRow}>
              <StatCard
                label="Total"
                value={stats.total}
                accent={colors.primary}
                small
              />
              <StatCard
                label="Done"
                value={stats.completed}
                accent={colors.completed}
                small
              />
            </View>
            <View style={styles.kpiRow}>
              <StatCard
                label="Active"
                value={stats.inProgress}
                accent={colors.inProgress}
                small
              />
              <StatCard
                label="Overdue"
                value={stats.overdue}
                accent={
                  stats.overdue > 0
                    ? colors.destructive
                    : colors.mutedForeground
                }
                small
              />
            </View>
          </View>
        </View>
      </View>

      {/* ── Monthly Calendar ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            Calendar
          </Text>
        </View>
        <MonthCalendar
          scripts={scripts}
          todos={todos}
          categories={categories}
        />
      </View>

      {/* ── To-Do KPI ── */}
      <View
        style={[
          styles.kpiCard,
          {
            backgroundColor: colors.card,
            borderRadius: colors.radius,
            borderColor: colors.border,
          },
        ]}
      >
        {/* Card header */}
        <View style={styles.kpiCardHead}>
          <Text
            style={[
              styles.kpiCardTitle,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            To-Do List
          </Text>
          <Text
            style={[
              styles.kpiCardSub,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {todoStats.pct}% complete
          </Text>
        </View>

        {/* Progress bar */}
        <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${todoStats.pct}%` as any,
                backgroundColor:
                  todoStats.pct === 100 ? colors.completed : colors.inProgress,
              },
            ]}
          />
        </View>

        {/* Stats row */}
        <View style={styles.todoStatsRow}>
          <StatCard
            label="Total"
            value={todoStats.total}
            accent={colors.primary}
            small
          />
          <StatCard
            label="Done"
            value={todoStats.completed}
            accent={colors.completed}
            small
          />
          <StatCard
            label="Active"
            value={todoStats.active}
            accent={colors.inProgress}
            small
          />
          <StatCard
            label="Overdue"
            value={todoStats.overdue}
            accent={
              todoStats.overdue > 0
                ? colors.destructive
                : colors.mutedForeground
            }
            small
          />
        </View>

        {/* High priority callout */}
        {todoStats.highPriority > 0 && (
          <View
            style={[
              styles.highPriorityBanner,
              {
                backgroundColor: colors.destructive + "15",
                borderColor: colors.destructive + "40",
              },
            ]}
          >
            <Text
              style={[
                styles.highPriorityText,
                { color: colors.destructive, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              ⚡ {todoStats.highPriority} high-priority task
              {todoStats.highPriority > 1 ? "s" : ""} pending
            </Text>
            <Pressable onPress={() => router.push("/(tabs)/todos")}>
              <Text
                style={[
                  styles.highPriorityLink,
                  { color: colors.destructive, fontFamily: "Inter_500Medium" },
                ]}
              >
                View →
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* ── Goals ── */}
      {activeGoals.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.foreground, fontFamily: "Inter_700Bold" },
              ]}
            >
              Active Goals
            </Text>
            <Pressable onPress={() => router.push("/(tabs)/goals")}>
              <Text
                style={[
                  styles.seeAll,
                  { color: colors.primary, fontFamily: "Inter_500Medium" },
                ]}
              >
                See all
              </Text>
            </Pressable>
          </View>
          {activeGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onPress={() => router.push("/(tabs)/goals")}
            />
          ))}
        </View>
      )}

      {/* ── Upcoming deadlines ── */}
      {upcomingDeadlines.length > 0 && (
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              styles.sectionTitlePad,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            Due This Week
          </Text>
          {upcomingDeadlines.map((script) => (
            <ScriptCard
              key={script.id}
              script={script}
              categories={categories}
              onPress={() => router.push(`/script/${script.id}`)}
            />
          ))}
        </View>
      )}

      {/* ── Recent scripts ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            Recent Scripts
          </Text>
          <Pressable onPress={() => router.push("/(tabs)/scripts")}>
            <Text
              style={[
                styles.seeAll,
                { color: colors.primary, fontFamily: "Inter_500Medium" },
              ]}
            >
              See all
            </Text>
          </Pressable>
        </View>
        {recentScripts.length === 0 ? (
          <EmptyState
            icon="file-text"
            title="No scripts yet"
            subtitle="Tap the Scripts tab to create your first script"
          />
        ) : (
          recentScripts.map((script) => (
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
  content: { gap: 16 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  greeting: { fontSize: 13, marginBottom: 2 },
  appName: { fontSize: 26, fontWeight: "700" },
  headerBadges: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  headerBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  headerBadgeText: { fontSize: 13 },

  // KPI card shared
  kpiCard: {
    marginHorizontal: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
  },
  kpiCardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kpiCardTitle: { fontSize: 16 },
  kpiCardSub: { fontSize: 13 },

  // Scripts KPI
  kpiBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  kpiGrid: { flex: 1, gap: 8 },
  kpiRow: { flexDirection: "row", gap: 8 },

  // Todos KPI
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    minWidth: 6,
  },
  todoStatsRow: { flexDirection: "row", gap: 8 },
  highPriorityBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  highPriorityText: { fontSize: 13 },
  highPriorityLink: { fontSize: 13 },

  // Sections
  section: { gap: 4 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  sectionTitlePad: { paddingHorizontal: 20, marginBottom: 4 },
  seeAll: { fontSize: 14 },
});
