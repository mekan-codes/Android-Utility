import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
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
import AddSubjectModal from "@/components/AddSubjectModal";
import EditSubjectModal from "@/components/EditSubjectModal";
import ManualSessionModal from "@/components/ManualSessionModal";
import PomodoroDisplay from "@/components/PomodoroDisplay";
import SubjectCard from "@/components/SubjectCard";
import { useStudy } from "@/context/StudyContext";
import { useColors } from "@/hooks/useColors";

function formatMinutes(minutes: number): string {
  if (minutes === 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getDateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0] as string;
}

export default function StudyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    activeSubjects,
    sessions,
    pomodoro,
    lastSavedSession,
    addSubject,
    deleteSubject,
    archiveSubject,
    editSubject,
    startPomodoro,
    pausePomodoro,
    resumePomodoro,
    stopPomodoro,
    getPartialStudyMinutes,
    undoLastSession,
    addManualSession,
    getTodayMinutes,
    getWeekMinutes,
    getMinutesForDate,
    getTodayTotalMinutes,
    settings,
  } = useStudy();

  const [showAddSubject, setShowAddSubject] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [editingSubject, setEditingSubject] = useState<{ id: string; name: string; color: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState(getDateStr(0));
  const [undoDismissed, setUndoDismissed] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const todayTotal = getTodayTotalMinutes();
  const dailyGoal = activeSubjects.reduce((sum, s) => sum + (s.dailyGoalMinutes ?? 0), 0) || 180;
  const remainingGoal = Math.max(0, dailyGoal - todayTotal);
  const isToday = selectedDate === getDateStr(0);

  const dateStrip = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split("T")[0] as string;
    const isSelected = dateStr === selectedDate;
    const dayLabel = i === 6 ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" });
    const hasStudy = sessions.some((s) => s.date === dateStr);
    return { dateStr, label: dayLabel, dayNum: d.getDate(), isSelected, hasStudy };
  });

  const confirmStop = (onAfterStop?: () => void) => {
    const partial = getPartialStudyMinutes();
    Alert.alert(
      "Stop Session?",
      partial >= 1 ? `Save ${partial}m of study time?` : "No study time will be saved.",
      [
        { text: "Cancel", style: "cancel" },
        ...(partial >= 1 ? [{ text: "Save", onPress: () => { stopPomodoro(true); onAfterStop?.(); } }] : []),
        { text: "Discard", style: "destructive", onPress: () => { stopPomodoro(false); onAfterStop?.(); } },
      ]
    );
  };

  const handleStartSubject = (id: string, name: string, minutes?: number, cycles = 1) => {
    if (pomodoro) {
      if (pomodoro.subjectId === id) {
        confirmStop();
      } else {
        Alert.alert("Session Active", `Stop "${pomodoro.subjectName}" before starting another subject.`, [
          { text: "Cancel", style: "cancel" },
          { text: "Stop Current", style: "destructive", onPress: () => confirmStop(() => startPomodoro(id, name, minutes, cycles)) },
        ]);
      }
      return;
    }
    startPomodoro(id, name, minutes, cycles);
  };

  const showUndoBanner = lastSavedSession !== null && lastSavedSession.id !== undoDismissed;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 16, paddingBottom: bottomPad + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.headline, { color: colors.foreground }]}>Study</Text>
            <Text style={[styles.subhead, { color: colors.mutedForeground }]}>
              {settings.workMinutes}m focus - {settings.breakMinutes}m break - {settings.cycles} cycles
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => setShowManual(true)}
              style={[styles.iconBtn, { backgroundColor: colors.secondary }]}
            >
              <Feather name="plus-circle" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowAddSubject(true);
              }}
              style={[styles.iconBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="plus" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.goalPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.goalItem}>
            <Text style={[styles.goalLabel, { color: colors.mutedForeground }]}>Today</Text>
            <Text style={[styles.goalValue, { color: colors.foreground }]}>{formatMinutes(todayTotal)}</Text>
          </View>
          <View style={[styles.goalDivider, { backgroundColor: colors.border }]} />
          <View style={styles.goalItem}>
            <Text style={[styles.goalLabel, { color: colors.mutedForeground }]}>Goal</Text>
            <Text style={[styles.goalValue, { color: colors.foreground }]}>{formatMinutes(dailyGoal)}</Text>
          </View>
          <View style={[styles.goalDivider, { backgroundColor: colors.border }]} />
          <View style={styles.goalItem}>
            <Text style={[styles.goalLabel, { color: colors.mutedForeground }]}>Remaining</Text>
            <Text style={[styles.goalValue, { color: remainingGoal === 0 ? colors.success : colors.primary }]}>
              {formatMinutes(remainingGoal)}
            </Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateStripScroll} contentContainerStyle={styles.dateStrip}>
          {dateStrip.map((day) => (
            <TouchableOpacity
              key={day.dateStr}
              onPress={() => setSelectedDate(day.dateStr)}
              style={[
                styles.dateItem,
                {
                  backgroundColor: day.isSelected ? colors.primary : colors.card,
                  borderColor: day.isSelected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.dateItemDay, { color: day.isSelected ? "#fff" : colors.mutedForeground }]}>
                {day.label}
              </Text>
              <Text style={[styles.dateItemNum, { color: day.isSelected ? "#fff" : colors.foreground }]}>
                {day.dayNum}
              </Text>
              {day.hasStudy && !day.isSelected && <View style={[styles.studyDot, { backgroundColor: colors.primary }]} />}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {pomodoro && (
          <PomodoroDisplay
            pomodoro={pomodoro}
            onPause={pausePomodoro}
            onResume={resumePomodoro}
            onStop={() => confirmStop()}
          />
        )}

        {showUndoBanner && lastSavedSession && (
          <View style={[styles.undoBanner, { backgroundColor: colors.foreground }]}>
            <Text style={styles.undoText} numberOfLines={1}>
              Saved: {lastSavedSession.subjectName} +{lastSavedSession.durationMinutes}m
            </Text>
            <View style={styles.undoActions}>
              <TouchableOpacity
                onPress={() => { undoLastSession(); setUndoDismissed(lastSavedSession.id); }}
                style={styles.undoBtn}
              >
                <Text style={styles.undoBtnText}>Undo</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setUndoDismissed(lastSavedSession.id)}>
                <Feather name="x" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeSubjects.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="book-open" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No subjects yet</Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              Add a subject to start tracking study time.
            </Text>
            <TouchableOpacity
              onPress={() => setShowAddSubject(true)}
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.emptyBtnText}>Add Subject</Text>
            </TouchableOpacity>
          </View>
        ) : (
          activeSubjects.map((subject) => {
            const displayMinutes = isToday ? getTodayMinutes(subject.id) : getMinutesForDate(subject.id, selectedDate);
            return (
              <SubjectCard
                key={subject.id}
                id={subject.id}
                name={subject.name}
                color={subject.color}
                todayMinutes={displayMinutes}
                weekMinutes={getWeekMinutes(subject.id)}
                isActive={pomodoro?.subjectId === subject.id}
                onStart={() => handleStartSubject(subject.id, subject.name)}
                onStart25={() => handleStartSubject(subject.id, subject.name, 25, 1)}
                onStart50={() => handleStartSubject(subject.id, subject.name, 50, 1)}
                onDelete={() => deleteSubject(subject.id)}
                onArchive={() => archiveSubject(subject.id)}
                onEdit={() => setEditingSubject({ id: subject.id, name: subject.name, color: subject.color })}
                onAddManual={() => setShowManual(true)}
              />
            );
          })
        )}
      </ScrollView>

      <AddSubjectModal visible={showAddSubject} onClose={() => setShowAddSubject(false)} onAdd={addSubject} />

      {editingSubject && (
        <EditSubjectModal
          visible
          initialName={editingSubject.name}
          initialColor={editingSubject.color}
          onClose={() => setEditingSubject(null)}
          onSave={(name, color) => {
            editSubject(editingSubject.id, { name, color });
            setEditingSubject(null);
          }}
        />
      )}

      <ManualSessionModal
        visible={showManual}
        subjects={activeSubjects}
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
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  headline: { fontSize: 28, fontFamily: "Inter_700Bold" },
  subhead: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  iconBtn: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  goalPanel: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  goalItem: { flex: 1, alignItems: "center", gap: 3 },
  goalDivider: { width: StyleSheet.hairlineWidth },
  goalLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase" },
  goalValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  dateStripScroll: { marginBottom: 16 },
  dateStrip: { flexDirection: "row", gap: 8, paddingRight: 4 },
  dateItem: {
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
    minWidth: 56,
    gap: 2,
  },
  dateItemDay: { fontSize: 10, fontFamily: "Inter_500Medium", textTransform: "uppercase" },
  dateItemNum: { fontSize: 17, fontFamily: "Inter_700Bold" },
  studyDot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 1 },
  undoBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    gap: 10,
    borderRadius: 12,
  },
  undoText: { color: "#fff", fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  undoActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  undoBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.16)" },
  undoBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 40,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    borderStyle: "dashed",
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  emptyHint: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 24 },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 8 },
  emptyBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
