import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AddTaskModal from "@/components/AddTaskModal";
import TaskCard from "@/components/TaskCard";
import { useRoutine } from "@/context/RoutineContext";
import { useColors } from "@/hooks/useColors";

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export default function RoutineScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    dailyTasks,
    tempTasks,
    toggleDailyTask,
    deleteDailyTask,
    toggleTempTask,
    deleteTempTask,
    moveTempToTomorrow,
    addDailyTask,
    addTempTask,
  } = useRoutine();

  const [modal, setModal] = useState<{ visible: boolean; type: "daily" | "temp" }>({
    visible: false,
    type: "daily",
  });

  const openModal = (type: "daily" | "temp") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModal({ visible: true, type });
  };

  const doneDaily = dailyTasks.filter((t) => t.isDone).length;
  const doneTemp = tempTasks.filter((t) => t.isDone).length;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

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
            <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
              {formatDate()}
            </Text>
            <Text style={[styles.headline, { color: colors.foreground }]}>
              Today
            </Text>
          </View>
          <View style={styles.headerPills}>
            <View style={[styles.pill, { backgroundColor: colors.successLight }]}>
              <Text style={[styles.pillText, { color: colors.successForeground }]}>
                {doneDaily + doneTemp}/{dailyTasks.length + tempTasks.length} done
              </Text>
            </View>
          </View>
        </View>

        {/* Daily Tasks */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Daily Routine
              </Text>
              <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>
                {doneDaily}/{dailyTasks.length}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => openModal("daily")}
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="plus" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          {dailyTasks.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="repeat" size={22} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No daily tasks yet
              </Text>
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                Add tasks that repeat every day
              </Text>
            </View>
          ) : (
            dailyTasks.map((task) => (
              <TaskCard
                key={task.id}
                id={task.id}
                name={task.name}
                deadline={task.deadline}
                category={task.category}
                isDone={task.isDone}
                onToggle={() => toggleDailyTask(task.id)}
                onDelete={() => deleteDailyTask(task.id)}
                type="daily"
              />
            ))
          )}
        </View>

        {/* Temp Tasks */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionDot, { backgroundColor: colors.warning }]} />
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Today&apos;s Tasks
              </Text>
              <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>
                {doneTemp}/{tempTasks.length}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => openModal("temp")}
              style={[styles.addBtn, { backgroundColor: colors.warning }]}
            >
              <Feather name="plus" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          {tempTasks.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="calendar" size={22} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No extra tasks today
              </Text>
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                These disappear at end of day
              </Text>
            </View>
          ) : (
            tempTasks.map((task) => (
              <TaskCard
                key={task.id}
                id={task.id}
                name={task.name}
                deadline={task.deadline}
                isDone={task.isDone}
                onToggle={() => toggleTempTask(task.id)}
                onDelete={() => deleteTempTask(task.id)}
                onMoveToTomorrow={() => moveTempToTomorrow(task.id)}
                type="temp"
              />
            ))
          )}
        </View>
      </ScrollView>

      <AddTaskModal
        visible={modal.visible}
        type={modal.type}
        onClose={() => setModal((m) => ({ ...m, visible: false }))}
        onAdd={modal.type === "daily" ? addDailyTask : addTempTask}
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
    marginBottom: 28,
  },
  dateText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginBottom: 2,
  },
  headline: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  headerPills: { alignItems: "flex-end", justifyContent: "flex-end", paddingTop: 6 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  pillText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  sectionCount: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 28,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    borderStyle: "dashed",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  emptyHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
