import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
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
import BrandMark from "@/components/BrandMark";
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
  const carryForwardPromptActiveRef = useRef(false);

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

  React.useEffect(() => {
    if (carryForwardTasks.length === 0) {
      carryForwardPromptActiveRef.current = false;
      return;
    }

    if (carryForwardPromptActiveRef.current) return;
    carryForwardPromptActiveRef.current = true;

      const decideOneByOne = (index = 0) => {
        const task = carryForwardTasks[index];
        if (!task) return;
        Alert.alert(
          "Move unfinished task?",
          task.name,
          [
            { text: "Delete", style: "destructive", onPress: () => {
              resolveCarryForward("delete", [task.id]);
              decideOneByOne(index + 1);
            } },
            { text: "Keep hidden", style: "cancel", onPress: () => {
              resolveCarryForward("keep", [task.id]);
              decideOneByOne(index + 1);
            } },
            { text: "Move", onPress: () => {
              resolveCarryForward("move", [task.id]);
              decideOneByOne(index + 1);
            } },
          ]
        );
      };

      Alert.alert(
        "Unfinished Tasks",
        `You have ${carryForwardTasks.length} unfinished task${carryForwardTasks.length > 1 ? "s" : ""} from yesterday. What would you like to do?`,
        [
          { text: "Delete All", style: "destructive", onPress: () => resolveCarryForward("delete") },
          { text: "Move to Today", onPress: () => resolveCarryForward("move") },
          { text: "Decide", onPress: () => decideOneByOne() },
        ]
      );
  }, [carryForwardTasks, resolveCarryForward]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 16, paddingBottom: bottomPad + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerArea}>
          <View style={styles.titleCluster}>
            <BrandMark size={46} />
            <View style={styles.titleCopy}>
              <Text style={[styles.dateText, { color: colors.mutedForeground }]}>{formatDate()}</Text>
              <Text style={[styles.headline, { color: colors.foreground }]}>Today</Text>
            </View>
          </View>
          <View style={[styles.progressBadge, { backgroundColor: colors.successLight, borderColor: colors.success + "35" }]}>
            <Text style={[styles.progressBadgeText, { color: colors.successForeground }]}>
              {totalDone}/{totalTasks} done
            </Text>
          </View>
        </View>

        {totalTasks > 0 && (
          <View style={[styles.progressPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.progressPanelHeader}>
              <Text style={[styles.progressTitle, { color: colors.foreground }]}>Daily progress</Text>
              <Text style={[styles.progressPercent, { color: progressPct === 1 ? colors.success : colors.primary }]}>
                {Math.round(progressPct * 100)}%
              </Text>
            </View>
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
            <Text style={[styles.progressHint, { color: colors.mutedForeground }]}>
              {totalTasks - totalDone === 0 ? "All tasks are complete." : `${totalTasks - totalDone} task${totalTasks - totalDone === 1 ? "" : "s"} left for today.`}
            </Text>
          </View>
        )}

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
                reminderOffsetMinutes={task.reminderOffsetMinutes}
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
                reminderOffsetMinutes={task.reminderOffsetMinutes}
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
        initialReminderOffsetMinutes={editingTask?.task.reminderOffsetMinutes ?? null}
        onClose={() => setEditingTask(null)}
        onSave={(name, deadline, reminderOffsetMinutes) => {
          if (!editingTask) return;
          if (editingTask.type === "daily") {
            editDailyTask(editingTask.task.id, { name, deadline, reminderOffsetMinutes });
          } else {
            editTempTask(editingTask.task.id, { name, deadline, reminderOffsetMinutes });
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
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  titleCluster: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 },
  titleCopy: { flex: 1, minWidth: 0 },
  dateText: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  headline: { fontSize: 29, fontFamily: "Inter_700Bold", letterSpacing: 0 },
  progressBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  progressBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  progressPanel: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10, marginBottom: 22 },
  progressPanelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  progressTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  progressBarBg: { height: 8, borderRadius: 999, overflow: "hidden" },
  progressBarFill: { height: 8, borderRadius: 999 },
  progressPercent: { fontSize: 14, fontFamily: "Inter_700Bold" },
  progressHint: { fontSize: 12, fontFamily: "Inter_500Medium" },
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
  addBtn: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 28,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    borderStyle: "dashed",
  },
  emptyText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  emptyHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
