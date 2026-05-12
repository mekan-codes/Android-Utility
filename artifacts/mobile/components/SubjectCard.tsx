import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";

interface SubjectCardProps {
  id: string;
  name: string;
  color: string;
  todayMinutes: number;
  weekMinutes: number;
  isActive: boolean;
  onStart: () => void;
  onStart25?: () => void;
  onStart50?: () => void;
  onDelete: () => void;
  onArchive?: () => void;
  onEdit: () => void;
  onAddManual: () => void;
}

function formatMinutes(minutes: number): string {
  if (minutes === 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function SubjectCard({
  id,
  name,
  color,
  todayMinutes,
  weekMinutes,
  isActive,
  onStart,
  onStart25,
  onStart50,
  onDelete,
  onArchive,
  onEdit,
  onAddManual,
}: SubjectCardProps) {
  const colors = useColors();
  const router = useRouter();
  const [actionsVisible, setActionsVisible] = useState(false);

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStart();
  };

  const handlePress = () => {
    router.push(`/subject/${id}`);
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionsVisible(true);
  };

  const runAction = (action: () => void) => {
    setActionsVisible(false);
    setTimeout(action, 160);
  };

  return (
    <>
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={handleLongPress}
        activeOpacity={0.85}
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: isActive ? color : colors.border,
            borderRadius: 14,
            borderWidth: isActive ? 2 : 1,
          },
        ]}
      >
        <View style={[styles.colorBar, { backgroundColor: color }]} />

        <View style={styles.content}>
          <Text style={[styles.name, { color: colors.foreground }]}>{name}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Today</Text>
              <Text style={[styles.statValue, { color: todayMinutes > 0 ? color : colors.mutedForeground }]}>
                {formatMinutes(todayMinutes)}
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>This Week</Text>
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {formatMinutes(weekMinutes)}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleStart}
          style={[
            styles.startBtn,
            {
              backgroundColor: isActive ? color + "20" : color,
              borderRadius: 10,
            },
          ]}
        >
          <Feather
            name={isActive ? "stop-circle" : "play"}
            size={18}
            color={isActive ? color : "#fff"}
          />
        </TouchableOpacity>
      </TouchableOpacity>

      <Modal visible={actionsVisible} transparent animationType="fade" onRequestClose={() => setActionsVisible(false)}>
        <View style={styles.actionOverlay}>
          <Pressable style={styles.actionBackdrop} onPress={() => setActionsVisible(false)} />
          <View style={[styles.actionSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.actionHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.actionTitle, { color: colors.foreground }]} numberOfLines={2}>{name}</Text>
            <View style={styles.actionGrid}>
              <TouchableOpacity onPress={() => runAction(onStart25 ?? onStart)} style={[styles.actionButton, styles.actionGridButton, { backgroundColor: colors.muted }]}>
                <Feather name="play" size={16} color={colors.foreground} />
                <Text style={[styles.actionText, { color: colors.foreground }]}>Start 25 min</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => runAction(onStart50 ?? onStart)} style={[styles.actionButton, styles.actionGridButton, { backgroundColor: colors.muted }]}>
                <Feather name="fast-forward" size={16} color={colors.foreground} />
                <Text style={[styles.actionText, { color: colors.foreground }]}>Start 50 min</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => runAction(handlePress)} style={[styles.actionButton, { backgroundColor: colors.muted }]}>
              <Feather name="bar-chart-2" size={16} color={colors.foreground} />
              <Text style={[styles.actionText, { color: colors.foreground }]}>View Details</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => runAction(onAddManual)} style={[styles.actionButton, { backgroundColor: colors.muted }]}>
              <Feather name="plus-circle" size={16} color={colors.foreground} />
              <Text style={[styles.actionText, { color: colors.foreground }]}>Add Manual Time</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => runAction(onEdit)} style={[styles.actionButton, { backgroundColor: colors.muted }]}>
              <Feather name="edit-2" size={16} color={colors.foreground} />
              <Text style={[styles.actionText, { color: colors.foreground }]}>Edit Subject</Text>
            </TouchableOpacity>
            {onArchive ? (
              <TouchableOpacity onPress={() => runAction(onArchive)} style={[styles.actionButton, { backgroundColor: colors.muted }]}>
                <Feather name="archive" size={16} color={colors.foreground} />
                <Text style={[styles.actionText, { color: colors.foreground }]}>Archive</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => runAction(onDelete)} style={[styles.actionButton, { backgroundColor: colors.destructive + "15" }]}>
              <Feather name="trash-2" size={16} color={colors.destructive} />
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
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    overflow: "hidden",
  },
  colorBar: {
    width: 4,
    alignSelf: "stretch",
    flexShrink: 0,
  },
  content: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 6,
  },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  statItem: { alignItems: "flex-start" },
  statLabel: { fontSize: 10, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.4 },
  statValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
  divider: { width: 1, height: 24 },
  startBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  actionOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  actionBackdrop: { ...StyleSheet.absoluteFillObject },
  actionSheet: {
    margin: 16,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },
  actionHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  actionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 4 },
  actionGrid: { flexDirection: "row", gap: 8 },
  actionButton: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12 },
  actionGridButton: { flex: 1 },
  actionText: { fontSize: 14, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  cancelButton: { alignItems: "center", justifyContent: "center", paddingVertical: 13, borderRadius: 12, borderWidth: 1, marginTop: 2 },
  cancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
