import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { DeadlineStatus, getDeadlineStatus } from "@/context/RoutineContext";
import { useColors } from "@/hooks/useColors";

interface TaskCardProps {
  id: string;
  name: string;
  deadline?: string;
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
  if (status === "due_soon") return `due soon · ${deadline}`;
  return `before ${deadline}`;
}

export default function TaskCard({
  name,
  deadline,
  category,
  isDone,
  onToggle,
  onDelete,
  onEdit,
  onMoveToTomorrow,
  type,
}: TaskCardProps) {
  const colors = useColors();
  const dlStatus = getDeadlineStatus(deadline, isDone);

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
    const options: {
      text: string;
      onPress?: () => void;
      style?: "destructive" | "cancel" | "default";
    }[] = [{ text: "Cancel", style: "cancel" }];

    if (onEdit) {
      options.push({ text: "Edit", onPress: onEdit });
    }
    if (type === "temp" && onMoveToTomorrow) {
      options.push({ text: "Move to Tomorrow", onPress: onMoveToTomorrow });
    }
    options.push({ text: "Delete", style: "destructive", onPress: onDelete });

    Alert.alert(name, undefined, options);
  };

  return (
    <TouchableOpacity
      onPress={handleToggle}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
      style={[
        styles.card,
        {
          backgroundColor: isDone ? colors.muted : colors.card,
          borderColor: isDone ? colors.border : dlStatus === "overdue" ? colors.destructive + "40" : colors.border,
          borderRadius: 12,
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
        {(deadline || category) ? (
          <View style={styles.metaRow}>
            {deadline && !isDone ? (
              <View style={[styles.badge, { backgroundColor: deadlineBgColor }]}>
                <Feather name="clock" size={10} color={deadlineTextColor} />
                <Text style={[styles.badgeText, { color: deadlineTextColor }]}>
                  {deadlineLabel(deadline, dlStatus)}
                </Text>
              </View>
            ) : deadline && isDone ? (
              <View style={[styles.badge, { backgroundColor: colors.muted }]}>
                <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
                  {deadline}
                </Text>
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
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
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
  donePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  doneText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});
