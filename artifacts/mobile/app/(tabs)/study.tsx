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
import PomodoroDisplay from "@/components/PomodoroDisplay";
import SubjectCard from "@/components/SubjectCard";
import { useStudy } from "@/context/StudyContext";
import { useColors } from "@/hooks/useColors";

export default function StudyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    subjects,
    pomodoro,
    addSubject,
    deleteSubject,
    startPomodoro,
    pausePomodoro,
    resumePomodoro,
    stopPomodoro,
    getTodayMinutes,
    getAllTimeMinutes,
    settings,
  } = useStudy();

  const [showAddSubject, setShowAddSubject] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const handleStartSubject = (id: string, name: string) => {
    if (pomodoro && pomodoro.subjectId === id) {
      Alert.alert("Session Active", "Stop the current session first.", [
        { text: "OK" },
      ]);
      return;
    }
    if (pomodoro) {
      Alert.alert(
        "Session Active",
        `Stop current session for "${pomodoro.subjectName}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Stop & Switch",
            onPress: () => {
              stopPomodoro();
              setTimeout(() => startPomodoro(id, name), 100);
            },
          },
        ]
      );
      return;
    }
    startPomodoro(id, name);
  };

  const handleStop = () => {
    Alert.alert("Stop Session?", "The elapsed time will be saved.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Stop",
        style: "destructive",
        onPress: stopPomodoro,
      },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 16, paddingBottom: bottomPad + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.headline, { color: colors.foreground }]}>
              Study
            </Text>
            <Text style={[styles.subhead, { color: colors.mutedForeground }]}>
              {settings.workMinutes}min focus · {settings.breakMinutes}min break
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowAddSubject(true);
            }}
            style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: 12 }]}
          >
            <Feather name="plus" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Active Pomodoro */}
        {pomodoro && (
          <PomodoroDisplay
            pomodoro={pomodoro}
            onPause={pausePomodoro}
            onResume={resumePomodoro}
            onStop={handleStop}
          />
        )}

        {/* Subjects */}
        {subjects.length === 0 ? (
          <View
            style={[
              styles.emptyBox,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Feather name="book-open" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No subjects yet
            </Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              Add a subject to start tracking study time
            </Text>
            <TouchableOpacity
              onPress={() => setShowAddSubject(true)}
              style={[
                styles.emptyBtn,
                { backgroundColor: colors.primary, borderRadius: 10 },
              ]}
            >
              <Text style={[styles.emptyBtnText, { color: "#fff" }]}>
                Add Subject
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          subjects.map((subject) => (
            <SubjectCard
              key={subject.id}
              id={subject.id}
              name={subject.name}
              color={subject.color}
              todayMinutes={getTodayMinutes(subject.id)}
              totalMinutes={getAllTimeMinutes(subject.id)}
              isActive={pomodoro?.subjectId === subject.id}
              onStart={() => handleStartSubject(subject.id, subject.name)}
              onDelete={() => deleteSubject(subject.id)}
            />
          ))
        )}
      </ScrollView>

      <AddSubjectModal
        visible={showAddSubject}
        onClose={() => setShowAddSubject(false)}
        onAdd={addSubject}
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
    marginBottom: 24,
  },
  headline: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  subhead: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  addBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 40,
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
  emptyBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  emptyBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
