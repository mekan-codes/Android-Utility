import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { PomodoroState } from "@/context/StudyContext";

interface PomodoroDisplayProps {
  pomodoro: PomodoroState;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function PomodoroDisplay({
  pomodoro,
  onPause,
  onResume,
  onStop,
}: PomodoroDisplayProps) {
  const colors = useColors();
  const isWork = pomodoro.phase === "work";
  const progressColor = isWork ? colors.primary : colors.success;
  const totalSeconds = (isWork ? pomodoro.workMinutes : pomodoro.breakMinutes) * 60;
  const progress = Math.min(1, 1 - pomodoro.remainingSeconds / totalSeconds);

  const handlePauseResume = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (pomodoro.isRunning) onPause(); else onResume();
  };

  const handleStop = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onStop();
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.card, borderColor: progressColor + "30", borderRadius: 20 },
      ]}
    >
      <View style={styles.progressBarBg}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${Math.min(100, progress * 100)}%` as `${number}%`, backgroundColor: progressColor },
          ]}
        />
      </View>

      <View style={styles.inner}>
        <View style={styles.topRow}>
          <View style={[styles.phaseBadge, { backgroundColor: progressColor + "20" }]}>
            <Text style={[styles.phaseText, { color: progressColor }]}>
              {isWork ? "Focus" : "Break"}
            </Text>
          </View>
          <View style={[styles.cycleBadge, { backgroundColor: colors.muted }]}>
            <Text style={[styles.cycleText, { color: colors.mutedForeground }]}>
              Cycle {pomodoro.currentCycle}/{pomodoro.totalCycles}
            </Text>
          </View>
        </View>

        <Text style={[styles.subjectName, { color: colors.mutedForeground }]}>
          {pomodoro.subjectName}
        </Text>

        <Text style={[styles.timer, { color: colors.foreground }]}>
          {formatSeconds(pomodoro.remainingSeconds)}
        </Text>

        {!pomodoro.isRunning && (
          <Text style={[styles.pausedLabel, { color: colors.mutedForeground }]}>Paused</Text>
        )}

        <View style={styles.controls}>
          <TouchableOpacity
            onPress={handleStop}
            style={[styles.controlBtn, { backgroundColor: colors.destructive + "15", borderRadius: 12 }]}
          >
            <Feather name="square" size={20} color={colors.destructive} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePauseResume}
            style={[styles.mainBtn, { backgroundColor: progressColor, borderRadius: 16 }]}
          >
            <Feather name={pomodoro.isRunning ? "pause" : "play"} size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    borderWidth: 2,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  progressBarBg: { height: 4, backgroundColor: "#E5E7F0", width: "100%" },
  progressBarFill: { height: 4, borderRadius: 2 },
  inner: { padding: 20, alignItems: "center", gap: 6 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  phaseBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  phaseText: { fontSize: 12, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.5 },
  cycleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  cycleText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  subjectName: { fontSize: 13, fontFamily: "Inter_500Medium" },
  timer: { fontSize: 56, fontFamily: "Inter_700Bold", letterSpacing: -2, lineHeight: 64 },
  pausedLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  controls: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 8 },
  controlBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  mainBtn: { width: 70, height: 70, alignItems: "center", justifyContent: "center" },
});
