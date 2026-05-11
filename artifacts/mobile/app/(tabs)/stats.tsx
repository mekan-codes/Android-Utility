import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatFilter, useStudy } from "@/context/StudyContext";
import { useColors } from "@/hooks/useColors";

function formatMinutes(minutes: number): string {
  if (minutes === 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const FILTERS: { key: StatFilter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7days", label: "7 Days" },
  { key: "30days", label: "30 Days" },
  { key: "year", label: "Year" },
  { key: "alltime", label: "All Time" },
];

export default function StatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<StatFilter>("7days");

  const {
    subjects,
    sessions,
    getFilterMinutes,
    getFilterDailyAverage,
    getBestSubjectForFilter,
    getSessionsForFilter,
    getChartData,
  } = useStudy();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const totalMinutes = getFilterMinutes(activeFilter);
  const dailyAvg = getFilterDailyAverage(activeFilter);
  const bestSubject = getBestSubjectForFilter(activeFilter);
  const filteredSessions = getSessionsForFilter(activeFilter);
  const chartData = getChartData(activeFilter);
  const maxBarMinutes = Math.max(...chartData.map((d) => d.minutes), 1);

  const subjectBreakdown = useMemo(() => subjects
    .map((s) => ({ subject: s, minutes: getFilterMinutes(activeFilter, s.id) }))
    .filter((item) => item.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes), [activeFilter, getFilterMinutes, subjects]);

  const recentSessions = useMemo(() => [...filteredSessions]
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 10), [filteredSessions]);

  const maxSubjectMinutes = Math.max(...subjectBreakdown.map((i) => i.minutes), 1);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 16, paddingBottom: bottomPad + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.headline, { color: colors.foreground }]}>Stats</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setActiveFilter(f.key)}
              style={[
                styles.filterTab,
                {
                  backgroundColor: activeFilter === f.key ? colors.primary : colors.card,
                  borderColor: activeFilter === f.key ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.filterTabText, { color: activeFilter === f.key ? "#fff" : colors.mutedForeground }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.primary + "15" }]}>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>{formatMinutes(totalMinutes)}</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Total</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.success + "15" }]}>
            <Text style={[styles.summaryValue, { color: colors.success }]}>{formatMinutes(dailyAvg)}</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Avg active day</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.warningLight }]}>
            <Text style={[styles.summaryValue, { color: colors.warning }]} numberOfLines={1} adjustsFontSizeToFit>
              {bestSubject?.name ?? "None"}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Best</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            {FILTERS.find((f) => f.key === activeFilter)?.label} Chart
          </Text>
          <View style={styles.barChart}>
            {chartData.map((day, i) => {
              const heightPct = day.minutes / maxBarMinutes;
              return (
                <View key={`${day.date}-${i}`} style={styles.barCol}>
                  <Text style={[styles.barValue, { color: colors.mutedForeground }]}>
                    {day.minutes > 0 ? formatMinutes(day.minutes) : ""}
                  </Text>
                  <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${day.minutes > 0 ? Math.max(5, heightPct * 100) : 0}%` as `${number}%`,
                          backgroundColor: colors.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barLabel, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {day.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {subjectBreakdown.length > 0 ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Subject Breakdown</Text>
            {subjectBreakdown.map(({ subject, minutes }) => {
              const pct = minutes / maxSubjectMinutes;
              return (
                <TouchableOpacity key={subject.id} onPress={() => router.push(`/subject/${subject.id}`)} style={styles.subjectRow}>
                  <View style={styles.subjectMeta}>
                    <View style={[styles.subjectDot, { backgroundColor: subject.color }]} />
                    <Text style={[styles.subjectName, { color: colors.foreground }]}>{subject.name}</Text>
                    <Text style={[styles.subjectMinutes, { color: colors.foreground }]}>{formatMinutes(minutes)}</Text>
                    <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                  </View>
                  <View style={[styles.subjectTrack, { backgroundColor: colors.muted }]}>
                    <View
                      style={[
                        styles.subjectFill,
                        {
                          width: `${Math.max(4, pct * 100)}%` as `${number}%`,
                          backgroundColor: subject.color,
                        },
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {recentSessions.length > 0 ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Recent Sessions</Text>
            {recentSessions.map((session, idx) => {
              const subject = subjects.find((s) => s.id === session.subjectId);
              const date = new Date(session.completedAt);
              const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
              return (
                <View
                  key={session.id}
                  style={[
                    styles.sessionRow,
                    {
                      borderBottomColor: colors.border,
                      borderBottomWidth: idx < recentSessions.length - 1 ? StyleSheet.hairlineWidth : 0,
                    },
                  ]}
                >
                  <View style={[styles.sessionDot, { backgroundColor: subject?.color ?? colors.primary }]} />
                  <View style={styles.sessionInfo}>
                    <Text style={[styles.sessionSubject, { color: colors.foreground }]}>{session.subjectName}</Text>
                    <Text style={[styles.sessionMeta, { color: colors.mutedForeground }]}>
                      {session.date} - {timeStr}
                    </Text>
                  </View>
                  <View style={styles.sessionRight}>
                    <Text style={[styles.sessionDuration, { color: colors.foreground }]}>
                      {formatMinutes(session.durationMinutes)}
                    </Text>
                    <View style={[styles.typeBadge, { backgroundColor: session.source === "pomodoro" ? colors.secondary : colors.warningLight }]}>
                      <Text style={[styles.typeText, { color: session.source === "pomodoro" ? colors.primary : colors.warning }]}>
                        {session.source === "pomodoro" ? "Pomo" : "Manual"}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {sessions.length === 0 && (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="bar-chart-2" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No study sessions yet</Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              Start a Pomodoro session on the Study tab.
            </Text>
            <TouchableOpacity onPress={() => router.push("/study")} style={[styles.emptyBtn, { backgroundColor: colors.primary }]}>
              <Text style={styles.emptyBtnText}>Go to Study</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 18 },
  headline: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 14 },
  filterScroll: { marginBottom: 14 },
  filterRow: { flexDirection: "row", gap: 8 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderRadius: 10 },
  filterTabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  summaryCard: { flex: 1, padding: 12, alignItems: "center", gap: 4, borderRadius: 12 },
  summaryValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "center" },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 14, gap: 12 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: -4 },
  barChart: { flexDirection: "row", alignItems: "flex-end", height: 110, gap: 4 },
  barCol: { flex: 1, alignItems: "center", gap: 3, height: "100%", justifyContent: "flex-end" },
  barValue: { fontSize: 8, fontFamily: "Inter_500Medium", textAlign: "center" },
  barTrack: { width: "100%", flex: 1, borderRadius: 4, overflow: "hidden", justifyContent: "flex-end" },
  barFill: { width: "100%", borderRadius: 4 },
  barLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", textAlign: "center", maxWidth: 36 },
  subjectRow: { gap: 7 },
  subjectMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  subjectDot: { width: 10, height: 10, borderRadius: 5 },
  subjectName: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  subjectTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  subjectFill: { height: "100%", borderRadius: 3 },
  subjectMinutes: { fontSize: 13, fontFamily: "Inter_700Bold" },
  sessionRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  sessionDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  sessionInfo: { flex: 1 },
  sessionSubject: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sessionMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  sessionRight: { alignItems: "flex-end", gap: 3 },
  sessionDuration: { fontSize: 13, fontFamily: "Inter_700Bold" },
  typeBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  typeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  emptyBox: { alignItems: "center", paddingVertical: 42, borderRadius: 14, borderWidth: 1, gap: 8, borderStyle: "dashed" },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  emptyHint: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 24 },
  emptyBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginTop: 6 },
  emptyBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
