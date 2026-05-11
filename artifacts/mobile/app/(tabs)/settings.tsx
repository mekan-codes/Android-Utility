import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoutine } from "@/context/RoutineContext";
import { useStudy } from "@/context/StudyContext";
import { useColors } from "@/hooks/useColors";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, exportStudyData, importStudyData, resetStudyData } = useStudy();
  const { exportRoutineData, importRoutineData, resetRoutineData } = useRoutine();

  const [workInput, setWorkInput] = useState(String(settings.workMinutes));
  const [breakInput, setBreakInput] = useState(String(settings.breakMinutes));

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const applySettings = () => {
    const work = parseInt(workInput, 10);
    const brk = parseInt(breakInput, 10);
    if (isNaN(work) || work < 1 || work > 120) {
      Alert.alert("Invalid Value", "Work duration must be 1–120 minutes.");
      return;
    }
    if (isNaN(brk) || brk < 1 || brk > 60) {
      Alert.alert("Invalid Value", "Break duration must be 1–60 minutes.");
      return;
    }
    updateSettings({ workMinutes: work, breakMinutes: brk });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Saved", "Pomodoro settings updated.");
  };

  const handleExport = async () => {
    try {
      const routineData = exportRoutineData();
      const studyData = exportStudyData();
      const exportObj = {
        version: 1,
        exportedAt: new Date().toISOString(),
        routine: routineData,
        study: studyData,
      };
      const json = JSON.stringify(exportObj, null, 2);
      if (Platform.OS === "web") {
        Alert.alert("Export", "Copy this JSON to save your data:\n\n" + json.substring(0, 200) + "...");
      } else {
        await Share.share({ message: json, title: "ResetFlow Data Export" });
      }
    } catch (e) {
      Alert.alert("Error", "Export failed.");
    }
  };

  const handleResetAll = () => {
    Alert.alert(
      "Reset All Data",
      "This will permanently delete all tasks, subjects, and study sessions. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset Everything",
          style: "destructive",
          onPress: async () => {
            await Promise.all([resetStudyData(), resetRoutineData()]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert("Done", "All data has been reset.");
          },
        },
      ]
    );
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
        <Text style={[styles.headline, { color: colors.foreground }]}>
          Settings
        </Text>

        {/* Pomodoro Settings */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Feather name="clock" size={16} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Pomodoro Timer
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>
              Focus Duration
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.numInput,
                  {
                    backgroundColor: colors.muted,
                    color: colors.foreground,
                    borderRadius: 8,
                  },
                ]}
                value={workInput}
                onChangeText={setWorkInput}
                keyboardType="number-pad"
                maxLength={3}
                returnKeyType="done"
              />
              <Text style={[styles.unitText, { color: colors.mutedForeground }]}>
                min
              </Text>
            </View>
          </View>

          <View style={[styles.separator, { backgroundColor: colors.border }]} />

          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>
              Break Duration
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.numInput,
                  {
                    backgroundColor: colors.muted,
                    color: colors.foreground,
                    borderRadius: 8,
                  },
                ]}
                value={breakInput}
                onChangeText={setBreakInput}
                keyboardType="number-pad"
                maxLength={2}
                returnKeyType="done"
              />
              <Text style={[styles.unitText, { color: colors.mutedForeground }]}>
                min
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={applySettings}
            style={[
              styles.saveBtn,
              { backgroundColor: colors.primary, borderRadius: 10 },
            ]}
          >
            <Text style={[styles.saveBtnText, { color: "#fff" }]}>
              Save Settings
            </Text>
          </TouchableOpacity>
        </View>

        {/* Data */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Feather name="database" size={16} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Data
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleExport}
            style={styles.row}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <Feather name="share" size={16} color={colors.primary} />
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                Export Data
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>

          <View style={[styles.separator, { backgroundColor: colors.border }]} />

          <View style={styles.infoRow}>
            <Feather name="info" size={14} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              All data is stored locally on your device. No account or internet connection required.
            </Text>
          </View>
        </View>

        {/* About */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Feather name="info" size={16} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              About
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>
              App
            </Text>
            <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
              ResetFlow
            </Text>
          </View>
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>
              Version
            </Text>
            <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
              1.0.0
            </Text>
          </View>
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>
              Daily Reset
            </Text>
            <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
              Midnight
            </Text>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.destructive + "30" }]}>
          <View style={styles.sectionHeader}>
            <Feather name="alert-triangle" size={16} color={colors.destructive} />
            <Text style={[styles.sectionTitle, { color: colors.destructive }]}>
              Danger Zone
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleResetAll}
            style={[
              styles.dangerBtn,
              { borderColor: colors.destructive, borderRadius: 10 },
            ]}
            activeOpacity={0.7}
          >
            <Feather name="trash-2" size={16} color={colors.destructive} />
            <Text style={[styles.dangerBtnText, { color: colors.destructive }]}>
              Reset All Data
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 18 },
  headline: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7F0",
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowLabel: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  rowValue: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  numInput: {
    width: 56,
    paddingVertical: 7,
    paddingHorizontal: 10,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  unitText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  saveBtn: {
    margin: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 18,
  },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    margin: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },
  dangerBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
