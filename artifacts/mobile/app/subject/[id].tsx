import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EditSubjectModal from "@/components/EditSubjectModal";
import ManualSessionModal from "@/components/ManualSessionModal";
import { useStudy } from "@/context/StudyContext";
import { useColors } from "@/hooks/useColors";
import { formatLocalDate } from "@/utils/localDate";

function formatMinutes(minutes: number): string {
  if (minutes === 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getDateDaysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function SubjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    subjects,
    sessions,
    startPomodoro,
    pomodoro,
    deleteSubject,
    editSubject,
    addManualSession,
    deleteSession,
    getTodayMinutes,
    getAllTimeMinutes,
  } = useStudy();

  const [showEdit, setShowEdit] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const subject = subjects.find((s) => s.id === id);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  if (!subject) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headline, { color: colors.foreground }]}>
            Subject not found
          </Text>
        </View>
      </View>
    );
  }

  const subjectSessions = sessions
    .filter((s) => s.subjectId === id)
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

  const todayStr = formatLocalDate(new Date());
  const recentSessions = subjectSessions.slice(0, 20);

  const getMinutesSince = (days: number) => {
    const since = getDateDaysAgo(days);
    return subjectSessions
      .filter((s) => new Date(s.completedAt) >= since)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
  };

  const stats = [
    { label: "Today", value: formatMinutes(getTodayMinutes(id)) },
    { label: "7 Days", value: formatMinutes(getMinutesSince(7)) },
    { label: "30 Days", value: formatMinutes(getMinutesSince(30)) },
    { label: "Year", value: formatMinutes(getMinutesSince(365)) },
    { label: "All Time", value: formatMinutes(getAllTimeMinutes(id)) },
  ];

  const handleStartPomodoro = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (pomodoro) {
      Alert.alert("Session Active", `Stop current session for "${pomodoro.subjectName}" first.`, [{ text: "OK" }]);
      return;
    }
    startPomodoro(id, subject.name);
    router.back();
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Subject",
      "This removes the subject. Existing study sessions are kept in your history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteSubject(id);
            router.back();
          },
        },
      ]
    );
  };

  const handleDeleteSession = (sessionId: string) => {
    Alert.alert("Delete Session", "Remove this study session?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteSession(sessionId) },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 8, paddingBottom: bottomPad + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: colors.muted, borderRadius: 10 }]}
          >
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <View style={[styles.colorDot, { backgroundColor: subject.color }]} />
            <Text style={[styles.headline, { color: colors.foreground }]} numberOfLines={1}>
              {subject.name}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowEdit(true)}
            style={[styles.iconBtn, { backgroundColor: colors.muted, borderRadius: 10 }]}
          >
            <Feather name="edit-2" size={18} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {stats.map((stat) => (
            <View
              key={stat.label}
              style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 12 }]}
            >
              <Text style={[styles.statValue, { color: subject.color }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={handleStartPomodoro}
            style={[styles.actionBtn, { backgroundColor: subject.color, borderRadius: 12, flex: 1 }]}
          >
            <Feather name="play" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Start Pomodoro</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowManual(true)}
            style={[styles.actionBtn, { backgroundColor: colors.secondary, borderRadius: 12 }]}
          >
            <Feather name="plus" size={18} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Manual</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Sessions */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Recent Sessions
          </Text>
          {subjectSessions.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No sessions yet. Start a Pomodoro or add manual time.
              </Text>
            </View>
          ) : (
            recentSessions.map((session, idx) => {
              const date = new Date(session.completedAt);
              const isToday = session.date === todayStr;
              const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
              const dateLabel = isToday
                ? "Today"
                : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

              return (
                <TouchableOpacity
                  key={session.id}
                  onLongPress={() => handleDeleteSession(session.id)}
                  activeOpacity={0.7}
                  style={[
                    styles.sessionRow,
                    {
                      borderBottomColor: colors.border,
                      borderBottomWidth: idx < recentSessions.length - 1 ? StyleSheet.hairlineWidth : 0,
                    },
                  ]}
                >
                  <View style={[styles.sessionDot, { backgroundColor: subject.color }]} />
                  <View style={styles.sessionInfo}>
                    <Text style={[styles.sessionDate, { color: colors.foreground }]}>{dateLabel} - {timeStr}</Text>
                    {session.note ? (
                      <Text style={[styles.sessionNote, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {session.note}
                      </Text>
                    ) : null}
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
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Delete */}
        <TouchableOpacity
          onPress={handleDelete}
          style={[styles.deleteBtn, { borderColor: colors.destructive + "50", borderRadius: 12 }]}
        >
          <Feather name="trash-2" size={16} color={colors.destructive} />
          <Text style={[styles.deleteBtnText, { color: colors.destructive }]}>Delete Subject</Text>
        </TouchableOpacity>
      </ScrollView>

      <EditSubjectModal
        visible={showEdit}
        initialName={subject.name}
        initialColor={subject.color}
        onClose={() => setShowEdit(false)}
        onSave={(name, color) => editSubject(id, { name, color })}
      />

      <ManualSessionModal
        visible={showManual}
        subjects={subjects}
        defaultSubjectId={id}
        onClose={() => setShowManual(false)}
        onAdd={addManualSession}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 18 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerTitle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  headline: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: 0 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: "30%",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 10, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0 },
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  actionBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7F0",
  },
  emptyRow: { padding: 20, alignItems: "center" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sessionDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  sessionInfo: { flex: 1 },
  sessionDate: { fontSize: 13, fontFamily: "Inter_500Medium" },
  sessionNote: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  sessionRight: { alignItems: "flex-end", gap: 3 },
  sessionDuration: { fontSize: 14, fontFamily: "Inter_700Bold" },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  typeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderWidth: 1,
    marginBottom: 12,
  },
  deleteBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
