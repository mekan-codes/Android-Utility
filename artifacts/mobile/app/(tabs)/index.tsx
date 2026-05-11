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
import AddTaskModal from "@/components/AddTaskModal";
import EditTaskModal from "@/components/EditTaskModal";
import TaskCard from "@/components/TaskCard";
import { DailyTask, TempTask, sortTasks, useRoutine } from "@/context/RoutineContext";
import { useColors } from "@/hooks/useColors";

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

type EditingTask =
  | { type: "daily"; task: DailyTask }
  | { type: "temp"; task: TempTask }
  | null;

export default function RoutineScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    dailyTasks,
    tempTasks,
    carryForwardTasks,
    resolveCarryForward,
    toggleDailyTask,
    deleteDailyTask,
    editDailyTask,
    toggleTempTask,
    deleteTempTask,
    editTempTask,
    moveTempToTomorrow,
    addDailyTask,
    addTempTask,
  } = useRoutine();

  const [addModal, setAddModal] = useState<{ visible: boolean; type: "daily" | "temp" }>({
    visible: false,
    type: "daily",
  });
  const [editingTask, setEditingTask] = useState<EditingTask>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const sortedDaily = sortTasks(dailyTasks);
  const sortedTemp = sortTasks(tempTasks);

  const doneDaily = dailyTasks.filter((t) => t.isDone).length;
  const doneTemp = tempTasks.filter((t) => t.isDone).length;
  const totalDone = doneDaily + doneTemp;
  const totalTasks = dailyTasks.length + tempTasks.length;
  const progressPct = totalTasks > 0 ? totalDone / totalTasks : 0;

  const openAddModal = (type: "daily" | "temp") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAddModal({ visible: true, type });
  };

  // Carry-forward prompt
  React.useEffect(() => {
    if (carryForwardTasks.length > 0) {
      Alert.alert(
        "Unfinished Tasks",
        `You have ${carryForwardTasks.length} unfinished task${carryForwardTasks.length > 1 ? "s" : ""} from yesterday. What would you like to do?`,
        [
          { text: "Delete All", style: "destructive", onPress: () => resolveCarryForward("delete") },
          { text: "Move to Today", onPress: () => resolveCarryForward("move") },
          { text: "Keep (hidden)", style: "cancel", onPress: () => resolveCarryForward("keep") },
        ]
      );
    }
  }, [carryForwardTasks.length]);

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
        <View style={styles.headerArea}>
          <View>
            <Text style={[styles.dateText, { color: colors.mutedForeground }]}>{formatDate()}</Text>
            <Text style={[styles.headline, { color: colors.foreground }]}>Today</Text>
          </View>
          <View style={[styles.progressBadge, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.progressBadgeText, { color: colors.successForeground }]}>
              {totalDone}/{totalTasks} done
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        {totalTasks > 0 && (
          <View style={styles.progressBarWrapper}>
            <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.round(progressPct * 100)}%` as `${number}%`,
                    backgroundColor: progressPct === 1 ? colors.success : colors.primary,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressPercent, { color: colors.mutedForeground }]}>
              {Math.round(progressPct * 100)}%
            </Text>
          </View>
        )}

        {/* Daily Tasks */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Daily Routine</Text>
              <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>
                {doneDaily}/{dailyTasks.length}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => openAddModal("daily")}
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="plus" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          {sortedDaily.length === 0 ? (
            <TouchableOpacity
              onPress={() => openAddModal("daily")}
              style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Feather name="repeat" size={22} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No daily tasks yet</Text>
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                Add tasks that repeat every day
              </Text>
            </TouchableOpacity>
          ) : (
            sortedDaily.map((task) => (
              <TaskCard
                key={task.id}
                id={task.id}
                name={task.name}
                deadline={task.deadline}
                category={task.category}
                isDone={task.isDone}
                onToggle={() => toggleDailyTask(task.id)}
                onDelete={() => deleteDailyTask(task.id)}
                onEdit={() => setEditingTask({ type: "daily", task })}
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
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Today&apos;s Tasks</Text>
              <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>
                {doneTemp}/{tempTasks.length}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => openAddModal("temp")}
              style={[styles.addBtn, { backgroundColor: colors.warning }]}
            >
              <Feather name="plus" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          {sortedTemp.length === 0 ? (
            <TouchableOpacity
              onPress={() => openAddModal("temp")}
              style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Feather name="calendar" size={22} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No extra tasks today</Text>
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                These disappear at end of day
              </Text>
            </TouchableOpacity>
          ) : (
            sortedTemp.map((task) => (
              <TaskCard
                key={task.id}
                id={task.id}
                name={task.name}
                deadline={task.deadline}
                isDone={task.isDone}
                onToggle={() => toggleTempTask(task.id)}
                onDelete={() => deleteTempTask(task.id)}
                onEdit={() => setEditingTask({ type: "temp", task })}
                onMoveToTomorrow={() => moveTempToTomorrow(task.id)}
                type="temp"
              />
            ))
          )}
        </View>
      </ScrollView>

      <AddTaskModal
        visible={addModal.visible}
        type={addModal.type}
        onClose={() => setAddModal((m) => ({ ...m, visible: false }))}
        onAdd={addModal.type === "daily" ? addDailyTask : addTempTask}
      />

      <EditTaskModal
        visible={editingTask !== null}
        initialName={editingTask?.task.name ?? ""}
        initialDeadline={editingTask?.task.deadline}
        onClose={() => setEditingTask(null)}
        onSave={(name, deadline) => {
          if (!editingTask) return;
          if (editingTask.type === "daily") {
            editDailyTask(editingTask.task.id, { name, deadline });
          } else {
            editTempTask(editingTask.task.id, { name, deadline });
          }
          setEditingTask(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 18 },
  headerArea: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  dateText: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 2 },
  headline: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  progressBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginTop: 8 },
  progressBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  progressBarWrapper: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 24 },
  progressBarBg: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  progressBarFill: { height: 6, borderRadius: 3 },
  progressPercent: { fontSize: 12, fontFamily: "Inter_600SemiBold", width: 32, textAlign: "right" },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  sectionCount: { fontSize: 13, fontFamily: "Inter_500Medium" },
  addBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 28,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    borderStyle: "dashed",
  },
  emptyText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  emptyHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
