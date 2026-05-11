import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStudy } from "@/context/StudyContext";
import { useColors } from "@/hooks/useColors";

function formatMinutes(minutes: number): string {
  if (minutes === 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0] as string;
}

export default function StatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { subjects, sessions, getTodayMinutes, getAllTimeMinutes, getTodayTotalMinutes, getWeekTotalMinutes } = useStudy();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const todayTotal = getTodayTotalMinutes();
  const weekTotal = getWeekTotalMinutes();
  const allTotal = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);

  // Last 7 days bar data
  const today = new Date();
  const last7: { label: string; minutes: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0] as string;
    const dayLabel = i === 0 ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" });
    const minutes = sessions
      .filter((s) => s.date === dateStr)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
    last7.push({ label: dayLabel, minutes });
  }

  const maxMinutes = Math.max(...last7.map((d) => d.minutes), 1);

  // Recent sessions
  const recentSessions = [...sessions]
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 10);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 16, paddingBottom: bottomPad + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.headline, { color: colors.foreground }]}>
          Statistics
        </Text>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.primary + "15", borderRadius: 14 }]}>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>
              {formatMinutes(todayTotal)}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
              Today
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.success + "15", borderRadius: 14 }]}>
            <Text style={[styles.summaryValue, { color: colors.success }]}>
              {formatMinutes(weekTotal)}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
              This Week
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.warningLight, borderRadius: 14 }]}>
            <Text style={[styles.summaryValue, { color: colors.warning }]}>
              {formatMinutes(allTotal)}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
              All Time
            </Text>
          </View>
        </View>

        {/* Weekly Bar Chart */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            Last 7 Days
          </Text>
          <View style={styles.barChart}>
            {last7.map((day, i) => {
              const heightPct = maxMinutes > 0 ? day.minutes / maxMinutes : 0;
              const isToday = i === 6;
              return (
                <View key={i} style={styles.barCol}>
                  <Text style={[styles.barValue, { color: colors.mutedForeground }]}>
                    {day.minutes > 0 ? formatMinutes(day.minutes) : ""}
                  </Text>
                  <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${Math.max(4, heightPct * 100)}%` as `${number}%`,
                          backgroundColor: isToday ? colors.primary : colors.primary + "60",
                          borderRadius: 4,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.barLabel,
                      { color: isToday ? colors.primary : colors.mutedForeground },
                    ]}
                  >
                    {day.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Per-Subject Breakdown */}
        {subjects.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              By Subject
            </Text>
            {subjects.map((subject) => {
              const today = getTodayMinutes(subject.id);
              const total = getAllTimeMinutes(subject.id);
              const pct = allTotal > 0 ? total / allTotal : 0;
              return (
                <View key={subject.id} style={styles.subjectRow}>
                  <View style={styles.subjectMeta}>
                    <View style={[styles.subjectDot, { backgroundColor: subject.color }]} />
                    <Text style={[styles.subjectName, { color: colors.foreground }]}>
                      {subject.name}
                    </Text>
                  </View>
                  <View style={styles.subjectBar}>
                    <View style={[styles.subjectTrack, { backgroundColor: colors.muted }]}>
                      <View
                        style={[
                          styles.subjectFill,
                          {
                            width: `${Math.max(2, pct * 100)}%` as `${number}%`,
                            backgroundColor: subject.color,
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.subjectTimes}>
                      <Text style={[styles.subjectToday, { color: subject.color }]}>
                        {formatMinutes(today)} today
                      </Text>
                      <Text style={[styles.subjectTotal, { color: colors.mutedForeground }]}>
                        {formatMinutes(total)} total
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Recent Sessions */}
        {recentSessions.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Recent Sessions
            </Text>
            {recentSessions.map((session) => {
              const subject = subjects.find((s) => s.id === session.subjectId);
              const date = new Date(session.completedAt);
              const isToday = session.date === getTodayStr();
              const timeStr = date.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              });
              return (
                <View
                  key={session.id}
                  style={[styles.sessionRow, { borderBottomColor: colors.border }]}
                >
                  <View
                    style={[
                      styles.sessionDot,
                      { backgroundColor: subject?.color ?? colors.primary },
                    ]}
                  />
                  <View style={styles.sessionInfo}>
                    <Text style={[styles.sessionSubject, { color: colors.foreground }]}>
                      {session.subjectName}
                    </Text>
                    <Text style={[styles.sessionMeta, { color: colors.mutedForeground }]}>
                      {isToday ? "Today" : session.date} · {timeStr}
                    </Text>
                  </View>
                  <View style={styles.sessionRight}>
                    <Text style={[styles.sessionDuration, { color: colors.foreground }]}>
                      {formatMinutes(session.durationMinutes)}
                    </Text>
                    {session.type === "pomodoro" && (
                      <View style={[styles.pomoBadge, { backgroundColor: colors.secondary }]}>
                        <Text style={[styles.pomoBadgeText, { color: colors.primary }]}>
                          Pomodoro
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {sessions.length === 0 && (
          <View
            style={[
              styles.emptyBox,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="bar-chart-2" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No study sessions yet
            </Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              Start a Pomodoro session on the Study tab
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 18 },
  headline: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  summaryLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    marginBottom: -4,
  },
  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 100,
    gap: 4,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    height: "100%",
    justifyContent: "flex-end",
  },
  barValue: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  barTrack: {
    width: "100%",
    flex: 1,
    borderRadius: 4,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFill: {
    width: "100%",
  },
  barLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  subjectRow: {
    gap: 8,
  },
  subjectMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  subjectDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  subjectName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  subjectBar: { gap: 4 },
  subjectTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  subjectFill: {
    height: "100%",
    borderRadius: 3,
  },
  subjectTimes: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  subjectToday: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  subjectTotal: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sessionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  sessionInfo: { flex: 1 },
  sessionSubject: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  sessionMeta: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  sessionRight: { alignItems: "flex-end", gap: 3 },
  sessionDuration: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  pomoBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  pomoBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 48,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    borderStyle: "dashed",
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
  emptyHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 24,
  },
});
