import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
  onDelete: () => void;
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
  onDelete,
  onEdit,
  onAddManual,
}: SubjectCardProps) {
  const colors = useColors();
  const router = useRouter();

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStart();
  };

  const handlePress = () => {
    router.push(`/subject/${id}`);
  };

  const handleLongPress = () => {
    Alert.alert(name, "What would you like to do?", [
      { text: "Cancel", style: "cancel" },
      { text: "View Details", onPress: handlePress },
      { text: "Add Manual Time", onPress: onAddManual },
      { text: "Edit Subject", onPress: onEdit },
      { text: "Delete", style: "destructive", onPress: onDelete },
    ]);
  };

  return (
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
});
