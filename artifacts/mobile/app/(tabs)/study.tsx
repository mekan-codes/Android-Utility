import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { usePathname } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AddSubjectModal from "@/components/AddSubjectModal";
import BrandMark from "@/components/BrandMark";
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

function dateToStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return dateToStr(d);
}

function formatDateLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function StudyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
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
    getPartialStudySeconds,
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
  const [manualSubjectId, setManualSubjectId] = useState<string | undefined>(undefined);
  const [selectedDate, setSelectedDate] = useState(getDateStr(0));
  const [undoDismissed, setUndoDismissed] = useState<string | null>(null);
  const [stopDialog, setStopDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => void;
  } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const todayTotal = getTodayTotalMinutes();
  const dailyGoal = activeSubjects.reduce((sum, s) => sum + (s.dailyGoalMinutes ?? 0), 0) || 180;
  const remainingGoal = Math.max(0, dailyGoal - todayTotal);
  const isToday = selectedDate === getDateStr(0);
  const selectedTimeLabel = isToday ? "Today" : formatDateLabel(selectedDate);
  const isStudyFocused = pathname === "/study";
  const compactHeader = width < 430;

  const dateStrip = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = dateToStr(d);
    const isSelected = dateStr === selectedDate;
    const dayLabel = i === 6 ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" });
    const hasStudy = sessions.some((s) => s.date === dateStr);
    return { dateStr, label: dayLabel, dayNum: d.getDate(), isSelected, hasStudy };
  });

  const confirmStop = (onAfterStop?: () => void) => {
    if (!pomodoro) return;

    const elapsedSeconds = getPartialStudySeconds();
    if (elapsedSeconds <= 0) {
      setStopDialog({
        title: "Stop Session?",
        message: "No focus time has been recorded yet. Stop without saving?",
        confirmLabel: "Stop",
        destructive: true,
        onConfirm: () => {
          stopPomodoro(false);
          onAfterStop?.();
        },
      });
      return;
    }

    const elapsedMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    if (pomodoro.phase === "break") {
      stopPomodoro(true);
      onAfterStop?.();
      return;
    }

    setStopDialog({
      title: "Stop and save session?",
      message: elapsedSeconds < 60
        ? "Less than 1 minute focused. Save as 1 minute?"
        : `Save ${elapsedMinutes}m of focus time?`,
      confirmLabel: elapsedSeconds < 60 ? "Save 1m" : "Stop & Save",
      onConfirm: () => {
        stopPomodoro(true);
        onAfterStop?.();
      },
    });
  };

  const handleStartSubject = (id: string, name: string, minutes?: number, cycles?: number) => {
    if (pomodoro) {
      if (pomodoro.subjectId === id) {
        confirmStop();
      } else {
        confirmStop(() => startPomodoro(id, name, minutes, cycles));
      }
      return;
    }
    startPomodoro(id, name, minutes, cycles);
  };

  const showUndoBanner = lastSavedSession !== null && lastSavedSession.id !== undoDismissed;

  useEffect(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    if (!showUndoBanner || !lastSavedSession) return;
    const sessionId = lastSavedSession.id;
    undoTimerRef.current = setTimeout(() => {
      setUndoDismissed(sessionId);
      undoTimerRef.current = null;
    }, 3000);

    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
      }
    };
  }, [lastSavedSession, showUndoBanner]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 16, paddingBottom: bottomPad + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, compactHeader && styles.headerCompact]}>
          <View style={styles.titleCluster}>
            <BrandMark size={46} />
            <View style={styles.headerCopy}>
              <Text style={[styles.headline, { color: colors.foreground }]} numberOfLines={1}>Study</Text>
              <Text style={[styles.subhead, { color: colors.mutedForeground }]} numberOfLines={1}>
                {settings.workMinutes}m focus - {settings.breakMinutes}m break - {settings.cycles} cycles
              </Text>
            </View>
          </View>
          <View style={[styles.headerActions, compactHeader && styles.headerActionsCompact]}>
            <TouchableOpacity
              onPress={() => {
                setManualSubjectId(undefined);
                setShowManual(true);
              }}
              style={[
                styles.headerActionBtn,
                compactHeader && styles.headerActionBtnCompact,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
            >
              <Feather name="plus-circle" size={16} color={colors.primary} />
              <Text style={[styles.headerActionText, { color: colors.primary }]}>Add Time</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowAddSubject(true);
              }}
              style={[
                styles.headerActionBtn,
                compactHeader && styles.headerActionBtnCompact,
                { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
            >
              <Feather name="plus" size={16} color="#fff" />
              <Text style={[styles.headerActionText, { color: "#fff" }]}>Add Subject</Text>
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

        {isStudyFocused && pomodoro && (
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
                onPress={() => {
                  if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
                  undoTimerRef.current = null;
                  undoLastSession();
                  setUndoDismissed(lastSavedSession.id);
                }}
                style={styles.undoBtn}
              >
                <Text style={styles.undoBtnText}>Undo</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
                undoTimerRef.current = null;
                setUndoDismissed(lastSavedSession.id);
              }}>
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
                timeLabel={selectedTimeLabel}
                onStart={() => handleStartSubject(subject.id, subject.name)}
                onStart25={() => handleStartSubject(subject.id, subject.name, 25)}
                onStart50={() => handleStartSubject(subject.id, subject.name, 50)}
                onDelete={() => deleteSubject(subject.id)}
                onArchive={() => archiveSubject(subject.id)}
                onEdit={() => setEditingSubject({ id: subject.id, name: subject.name, color: subject.color })}
                onAddManual={() => {
                  setManualSubjectId(subject.id);
                  setShowManual(true);
                }}
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
        defaultSubjectId={manualSubjectId}
        onClose={() => setShowManual(false)}
        onAdd={addManualSession}
      />

      <Modal visible={stopDialog !== null} transparent animationType="fade" onRequestClose={() => setStopDialog(null)}>
        <View style={styles.dialogOverlay}>
          <Pressable style={styles.dialogBackdrop} onPress={() => setStopDialog(null)} />
          <View style={[styles.dialogCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.dialogTitle, { color: colors.foreground }]}>{stopDialog?.title}</Text>
            <Text style={[styles.dialogMessage, { color: colors.mutedForeground }]}>{stopDialog?.message}</Text>
            <View style={styles.dialogActions}>
              <TouchableOpacity
                onPress={() => setStopDialog(null)}
                style={[styles.dialogButton, styles.dialogCancel, { borderColor: colors.border }]}
              >
                <Text style={[styles.dialogButtonText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const action = stopDialog?.onConfirm;
                  setStopDialog(null);
                  action?.();
                }}
                style={[
                  styles.dialogButton,
                  { backgroundColor: stopDialog?.destructive ? colors.destructive : colors.primary },
                ]}
              >
                <Text style={[styles.dialogButtonText, { color: "#fff" }]}>{stopDialog?.confirmLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 18 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  headerCompact: { flexDirection: "column", alignItems: "stretch", gap: 12 },
  titleCluster: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 },
  headerCopy: { flex: 1, minWidth: 0 },
  headline: { fontSize: 29, fontFamily: "Inter_700Bold", letterSpacing: 0 },
  subhead: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 8 },
  headerActionsCompact: { width: "100%" },
  headerActionBtn: {
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  headerActionBtnCompact: { flex: 1, minHeight: 46, borderRadius: 14 },
  headerActionText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  goalPanel: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 12,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
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
  dialogOverlay: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: "rgba(0,0,0,0.42)" },
  dialogBackdrop: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  dialogCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 12,
    zIndex: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },
  dialogTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  dialogMessage: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  dialogActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 },
  dialogButton: { minWidth: 104, alignItems: "center", justifyContent: "center", paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10 },
  dialogCancel: { borderWidth: 1 },
  dialogButtonText: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
