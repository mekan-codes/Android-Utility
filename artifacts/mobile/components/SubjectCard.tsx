import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface SubjectCardProps {
  id: string;
  name: string;
  color: string;
  todayMinutes: number;
  totalMinutes: number;
  isActive: boolean;
  onStart: () => void;
  onDelete: () => void;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function SubjectCard({
  name,
  color,
  todayMinutes,
  totalMinutes,
  isActive,
  onStart,
  onDelete,
}: SubjectCardProps) {
  const colors = useColors();

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStart();
  };

  const handleLongPress = () => {
    Alert.alert(name, "Delete this subject?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onDelete },
    ]);
  };

  return (
    <TouchableOpacity
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
      <View style={[styles.colorDot, { backgroundColor: color }]} />

      <View style={styles.content}>
        <Text style={[styles.name, { color: colors.foreground }]}>{name}</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              Today
            </Text>
            <Text style={[styles.statValue, { color: color }]}>
              {formatMinutes(todayMinutes)}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              Total
            </Text>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {formatMinutes(totalMinutes)}
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
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statItem: {
    alignItems: "flex-start",
  },
  statLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  divider: {
    width: 1,
    height: 24,
  },
  startBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
