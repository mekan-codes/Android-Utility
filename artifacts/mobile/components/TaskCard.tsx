import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { DeadlineStatus, getDeadlineStatus } from "@/context/RoutineContext";
import { useColors } from "@/hooks/useColors";

interface TaskCardProps {
  id: string;
  name: string;
  deadline?: string;
  reminderOffsetMinutes?: number | null;
  category?: string;
  isDone: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit?: () => void;
  onMoveToTomorrow?: () => void;
  type: "daily" | "temp";
}

function deadlineLabel(deadline: string, status: DeadlineStatus): string {
  if (status === "overdue") return `missed ${deadline}`;
  if (status === "due_soon") return `due soon - ${deadline}`;
  return `before ${deadline}`;
}

function reminderLabel(minutes?: number | null): string | null {
  if (minutes === null || minutes === undefined) return null;
  return minutes === 0 ? "at time" : `${minutes}m before`;
}

export default function TaskCard({
  name,
  deadline,
  reminderOffsetMinutes,
  category,
  isDone,
  onToggle,
  onDelete,
  onEdit,
  onMoveToTomorrow,
  type,
}: TaskCardProps) {
  const colors = useColors();
  const [actionsVisible, setActionsVisible] = useState(false);
  const dlStatus = getDeadlineStatus(deadline, isDone);
  const reminder = reminderLabel(reminderOffsetMinutes);

  const deadlineBgColor =
    dlStatus === "overdue"
      ? colors.destructive + "18"
      : dlStatus === "due_soon"
      ? colors.warning + "20"
      : colors.muted;

  const deadlineTextColor =
    dlStatus === "overdue"
      ? colors.destructive
      : dlStatus === "due_soon"
      ? colors.warning
      : colors.mutedForeground;

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle();
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionsVisible(true);
  };

  const runAction = (action?: () => void) => {
    setActionsVisible(false);
    if (action) setTimeout(action, 160);
  };

  return (
    <>
      <TouchableOpacity
        onPress={handleToggle}
        onLongPress={handleLongPress}
        activeOpacity={0.75}
        style={[
          styles.card,
          {
            backgroundColor: isDone ? colors.muted : colors.card,
            borderColor: isDone ? colors.border : dlStatus === "overdue" ? colors.destructive + "40" : colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.checkbox,
            {
              borderColor: isDone ? colors.success : dlStatus === "overdue" ? colors.destructive : colors.border,
              backgroundColor: isDone ? colors.success : "transparent",
            },
          ]}
        >
          {isDone && <Feather name="check" size={14} color="#fff" />}
        </View>

        <View style={styles.content}>
          <Text
            style={[
              styles.name,
              {
                color: isDone ? colors.mutedForeground : colors.foreground,
                textDecorationLine: isDone ? "line-through" : "none",
              },
            ]}
            numberOfLines={2}
          >
            {name}
          </Text>
          {deadline || category || reminder ? (
            <View style={styles.metaRow}>
              {deadline ? (
                <View style={[styles.badge, { backgroundColor: isDone ? colors.muted : deadlineBgColor }]}>
                  <Feather name="clock" size={10} color={isDone ? colors.mutedForeground : deadlineTextColor} />
                  <Text style={[styles.badgeText, { color: isDone ? colors.mutedForeground : deadlineTextColor }]}>
                    {isDone ? deadline : deadlineLabel(deadline, dlStatus)}
                  </Text>
                </View>
              ) : null}
              {reminder ? (
                <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
                  <Feather name="bell" size={10} color={colors.primary} />
                  <Text style={[styles.badgeText, { color: colors.primary }]}>{reminder}</Text>
                </View>
              ) : null}
              {category ? (
                <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.badgeText, { color: colors.primary }]}>{category}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {isDone && (
          <View style={[styles.donePill, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.doneText, { color: colors.successForeground }]}>Done</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={actionsVisible} transparent animationType="fade" onRequestClose={() => setActionsVisible(false)}>
        <View style={styles.actionOverlay}>
          <Pressable style={styles.actionBackdrop} onPress={() => setActionsVisible(false)} />
          <View style={[styles.actionSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.actionHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.actionTitle, { color: colors.foreground }]} numberOfLines={2}>{name}</Text>

            {onEdit ? (
              <TouchableOpacity onPress={() => runAction(onEdit)} style={[styles.actionButton, { backgroundColor: colors.muted }]}>
                <Feather name="edit-2" size={17} color={colors.foreground} />
                <Text style={[styles.actionText, { color: colors.foreground }]}>Edit</Text>
              </TouchableOpacity>
            ) : null}

            {type === "temp" && onMoveToTomorrow ? (
              <TouchableOpacity onPress={() => runAction(onMoveToTomorrow)} style={[styles.actionButton, { backgroundColor: colors.muted }]}>
                <Feather name="calendar" size={17} color={colors.foreground} />
                <Text style={[styles.actionText, { color: colors.foreground }]}>Move to Tomorrow</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity onPress={() => runAction(onDelete)} style={[styles.actionButton, { backgroundColor: colors.destructive + "15" }]}>
              <Feather name="trash-2" size={17} color={colors.destructive} />
              <Text style={[styles.actionText, { color: colors.destructive }]}>Delete</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setActionsVisible(false)} style={[styles.cancelButton, { borderColor: colors.border }]}>
              <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  content: { flex: 1, gap: 5 },
  name: { fontSize: 15, fontFamily: "Inter_500Medium", lineHeight: 20 },
  metaRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  donePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  doneText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  actionOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  actionBackdrop: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  actionSheet: {
    margin: 16,
    padding: 14,
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    zIndex: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },
  actionHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  actionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 4 },
  actionButton: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14 },
  actionText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cancelButton: { alignItems: "center", justifyContent: "center", paddingVertical: 13, borderRadius: 14, borderWidth: 1, marginTop: 2 },
  cancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
