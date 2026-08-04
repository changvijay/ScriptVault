import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useData } from "@/context/DataContext";
import { ProgressRing } from "@/components/ProgressRing";
import { StatCard } from "@/components/StatCard";
import { CompactScriptRow } from "@/components/CompactScriptRow";
import { CompactGoalRow } from "@/components/CompactGoalRow";
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
  const { scripts, categories, goals, todos, updateScript, updateGoal } = useData();

  const now = new Date();

  // ── Tab state for scripts panel ───────────────────────────────────
  const [scriptsTab, setScriptsTab] = useState<"due" | "recent">("due");

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
        .slice(0, 3),
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

  // ── Overdue/urgent alerts ─────────────────────────────────────────
  const hasOverdueScripts = stats.overdue > 0;
  const hasOverdueTodos = todoStats.overdue > 0;
  const hasHighPriority = todoStats.highPriority > 0;
  const showAlertBanner = hasOverdueScripts || hasOverdueTodos || hasHighPriority;

  // Auto-select tab: prefer "due" if there are upcoming deadlines, else "recent"
  const effectiveTab = scriptsTab === "due" && upcomingDeadlines.length === 0 ? "recent" : scriptsTab;

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  // Tab bar is 84px on web, ~83px on iOS native → +100 clears it with room
  const bottomPad = Platform.OS === "web" ? 100 : insets.bottom + 100;

  return (
    <Animated.ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topInset + 12, paddingBottom: bottomPad },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.header}>
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
      </Animated.View>

      {/* ── Overdue / High Priority Alert ── */}
      {showAlertBanner && (
        <Animated.View entering={FadeInUp.delay(250).springify()}>
          <View
            style={[
              styles.alertBanner,
              {
                backgroundColor: colors.destructive + "10",
                borderColor: colors.destructive + "30",
                marginHorizontal: 16,
              },
            ]}
          >
            <View style={styles.alertContent}>
              <Text
                style={[
                  styles.alertText,
                  { color: colors.destructive, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                ⚡{" "}
                {[
                  hasOverdueScripts && `${stats.overdue} overdue script${stats.overdue > 1 ? "s" : ""}`,
                  hasOverdueTodos && `${todoStats.overdue} overdue task${todoStats.overdue > 1 ? "s" : ""}`,
                  hasHighPriority && !hasOverdueTodos && `${todoStats.highPriority} high-priority`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                if (hasOverdueScripts) router.push("/(tabs)/scripts");
                else router.push("/(tabs)/todos");
              }}
            >
              <Text
                style={[
                  styles.alertLink,
                  { color: colors.destructive, fontFamily: "Inter_500Medium" },
                ]}
              >
                View →
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* ── Unified KPI Card ── */}
      <Animated.View
        entering={FadeInUp.delay(200).springify()}
        style={[
          styles.kpiCard,
          {
            backgroundColor: colors.card,
            borderRadius: colors.radius,
            borderColor: colors.border,
          },
        ]}
      >
        {/* Scripts row: ring + inline stats */}
        <View style={styles.kpiSection}>
          <ProgressRing
            progress={stats.pct}
            size={72}
            strokeWidth={7}
            color={colors.primary}
            backgroundColor={colors.muted}
            label={`${stats.pct}%`}
            labelColor={colors.foreground}
          />
          <View style={styles.kpiStatsCol}>
            <Text
              style={[
                styles.kpiLabel,
                { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              Scripts
            </Text>
            <View style={styles.inlineStatsRow}>
              <StatCard label="Total" value={stats.total} accent={colors.primary} inline />
              <StatCard label="Done" value={stats.completed} accent={colors.completed} inline />
              <StatCard label="Overdue" value={stats.overdue} accent={colors.destructive} inline />
            </View>
          </View>
        </View>

        {/* Divider */}
        <View style={[styles.kpiDivider, { backgroundColor: colors.border }]} />

        {/* To-Do row: bar + inline stats */}
        <View style={styles.kpiSection}>
          <View style={styles.kpiStatsCol}>
            <View style={styles.todoHeaderRow}>
              <Text
                style={[
                  styles.kpiLabel,
                  { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                To-Do
              </Text>
              <Text
                style={[
                  styles.kpiPct,
                  { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
                ]}
              >
                {todoStats.pct}%
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
            <View style={styles.inlineStatsRow}>
              <StatCard label="Total" value={todoStats.total} accent={colors.primary} inline />
              <StatCard label="Done" value={todoStats.completed} accent={colors.completed} inline />
              <StatCard label="Active" value={todoStats.active} accent={colors.inProgress} inline />
              {todoStats.overdue > 0 && (
                <StatCard label="Overdue" value={todoStats.overdue} accent={colors.destructive} inline />
              )}
            </View>
          </View>
        </View>
      </Animated.View>

      {/* ── Monthly Calendar (UNCHANGED) ── */}
      <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.section}>
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
      </Animated.View>

      {/* ── Active Goals (Compact) ── */}
      {activeGoals.length > 0 && (
        <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.section}>
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
          <View
            style={[
              styles.listCard,
              {
                backgroundColor: colors.card,
                borderRadius: colors.radius,
                borderColor: colors.border,
              },
            ]}
          >
            {activeGoals.map((goal, i) => (
              <CompactGoalRow
                key={goal.id}
                goal={goal}
                onPress={() => router.push("/(tabs)/goals")}
                onIncrement={() => {
                  const newProgress = goal.currentProgress + 1;
                  updateGoal(goal.id, {
                    currentProgress: newProgress,
                    completed: newProgress >= goal.targetValue,
                  });
                }}
              />
            ))}
          </View>
        </Animated.View>
      )}

      {/* ── Scripts Tabbed Panel (Due This Week + Recent) ── */}
      <Animated.View entering={FadeInUp.delay(500).springify()} style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.tabRow}>
            <Pressable
              onPress={() => setScriptsTab("due")}
              style={[
                styles.tabBtn,
                {
                  backgroundColor: effectiveTab === "due" ? colors.primary + "18" : "transparent",
                  borderColor: effectiveTab === "due" ? colors.primary + "40" : "transparent",
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color: effectiveTab === "due" ? colors.primary : colors.mutedForeground,
                    fontFamily: effectiveTab === "due" ? "Inter_600SemiBold" : "Inter_400Regular",
                  },
                ]}
              >
                Due This Week
                {upcomingDeadlines.length > 0 && ` (${upcomingDeadlines.length})`}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setScriptsTab("recent")}
              style={[
                styles.tabBtn,
                {
                  backgroundColor: effectiveTab === "recent" ? colors.primary + "18" : "transparent",
                  borderColor: effectiveTab === "recent" ? colors.primary + "40" : "transparent",
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color: effectiveTab === "recent" ? colors.primary : colors.mutedForeground,
                    fontFamily: effectiveTab === "recent" ? "Inter_600SemiBold" : "Inter_400Regular",
                  },
                ]}
              >
                Recent
              </Text>
            </Pressable>
          </View>
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

        <View
          style={[
            styles.listCard,
            {
              backgroundColor: colors.card,
              borderRadius: colors.radius,
              borderColor: colors.border,
            },
          ]}
        >
          {effectiveTab === "due" ? (
            upcomingDeadlines.length > 0 ? (
              upcomingDeadlines.map((script) => (
                <CompactScriptRow
                  key={script.id}
                  script={script}
                  categories={categories}
                  onPress={() => router.push(`/script/${script.id}`)}
                  onStatusChange={(status) => updateScript(script.id, { status })}
                />
              ))
            ) : (
              <View style={styles.miniEmpty}>
                <Text style={[styles.miniEmptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  No deadlines this week 🎉
                </Text>
              </View>
            )
          ) : recentScripts.length > 0 ? (
            recentScripts.map((script) => (
              <CompactScriptRow
                key={script.id}
                script={script}
                categories={categories}
                onPress={() => router.push(`/script/${script.id}`)}
                onStatusChange={(status) => updateScript(script.id, { status })}
              />
            ))
          ) : (
            <EmptyState
              icon="file-text"
              title="No scripts yet"
              subtitle="Tap the Scripts tab to create your first script"
            />
          )}
        </View>
      </Animated.View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: 10 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  greeting: { fontSize: 13, marginBottom: 1 },
  appName: { fontSize: 24, fontWeight: "700", letterSpacing: -0.5 },
  headerBadges: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  headerBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  headerBadgeText: { fontSize: 12 },

  // Unified KPI card
  kpiCard: {
    marginHorizontal: 16,
    padding: 14,
    gap: 0,
    borderRadius: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  kpiSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 8,
  },
  kpiStatsCol: {
    flex: 1,
    gap: 6,
  },
  kpiLabel: {
    fontSize: 14,
    letterSpacing: -0.2,
  },
  kpiPct: {
    fontSize: 12,
  },
  kpiDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  todoHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inlineStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 2,
  },

  // Progress bar (for to-do)
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    minWidth: 4,
  },

  // Alert banner
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  alertContent: {
    flex: 1,
  },
  alertText: { fontSize: 13 },
  alertLink: { fontSize: 13 },

  // Section shared
  section: { gap: 6, marginTop: 4 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 2,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700", letterSpacing: -0.3 },
  seeAll: { fontSize: 14 },

  // Compact list card (wraps CompactScriptRow / CompactGoalRow)
  listCard: {
    marginHorizontal: 16,
    borderWidth: 1,
    overflow: "hidden",
  },

  // Tabs
  tabRow: {
    flexDirection: "row",
    gap: 4,
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 13,
  },

  // Mini empty state
  miniEmpty: {
    paddingVertical: 20,
    alignItems: "center",
  },
  miniEmptyText: {
    fontSize: 14,
  },
});
