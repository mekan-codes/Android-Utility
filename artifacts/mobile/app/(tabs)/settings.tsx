import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoutine } from "@/context/RoutineContext";
import { useStudy } from "@/context/StudyContext";
import { useTheme, ThemePreference } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { themePreference, setThemePreference } = useTheme();
  const {
    settings,
    updateSettings,
    exportStudyData,
    importStudyData,
    resetStudyData,
    sessions,
    subjects,
    lastBackupDate,
    setLastBackupDate,
  } = useStudy();
  const {
    exportRoutineData,
    importRoutineData,
    resetRoutineData,
    dailyTasks,
    tempTasks,
  } = useRoutine();

  const [workInput, setWorkInput] = useState(String(settings.workMinutes));
  const [breakInput, setBreakInput] = useState(String(settings.breakMinutes));
  const [cyclesInput, setCyclesInput] = useState(String(settings.cycles));
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const applySettings = () => {
    const work = parseInt(workInput, 10);
    const brk = parseInt(breakInput, 10);
    const cyc = parseInt(cyclesInput, 10);
    if (isNaN(work) || work < 1 || work > 120) {
      Alert.alert("Invalid Value", "Work duration must be 1–120 minutes.");
      return;
    }
    if (isNaN(brk) || brk < 1 || brk > 60) {
      Alert.alert("Invalid Value", "Break duration must be 1–60 minutes.");
      return;
    }
    if (isNaN(cyc) || cyc < 1 || cyc > 10) {
      Alert.alert("Invalid Value", "Cycles must be 1–10.");
      return;
    }
    updateSettings({ workMinutes: work, breakMinutes: brk, cycles: cyc });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Saved", "Timer settings updated.");
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const routineData = exportRoutineData();
      const studyData = exportStudyData();
      const exportObj = {
        version: 1,
        exportedAt: new Date().toISOString(),
        tasks: (routineData as Record<string, unknown>).dailyTasks ?? [],
        tempTasks: (routineData as Record<string, unknown>).tempTasks ?? [],
        subjects: (studyData as Record<string, unknown>).subjects ?? [],
        studySessions: (studyData as Record<string, unknown>).sessions ?? [],
        pomodoroSettings: (studyData as Record<string, unknown>).settings ?? {},
        settings: { theme: themePreference },
        items: [],
        checklists: [],
      };
      const json = JSON.stringify(exportObj, null, 2);
      const now = new Date().toISOString().split("T")[0] as string;

      if (Platform.OS === "web") {
        Alert.alert("Backup Ready", "Web export: Copy the JSON below.\n\n" + json.substring(0, 200) + "...");
      } else {
        const fileName = `resetflow_backup_${now}.json`;
        const fileUri = FileSystem.cacheDirectory + fileName;
        await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType: "application/json",
            dialogTitle: "Save Backup",
            UTI: "public.json",
          });
          setLastBackupDate(now);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Alert.alert("Error", "Sharing is not available on this device.");
        }
      }
    } catch {
      Alert.alert("Export Failed", "Could not export backup. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    if (importing) return;
    setImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setImporting(false);
        return;
      }

      const asset = result.assets[0];
      if (!asset) {
        setImporting(false);
        return;
      }
      const fileUri = asset.uri;
      const raw = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.UTF8 });

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw);
      } catch {
        Alert.alert("Invalid File", "The selected file is not valid JSON.");
        setImporting(false);
        return;
      }

      if (!parsed.version) {
        Alert.alert("Invalid Backup", "This file does not appear to be a ResetFlow backup.");
        setImporting(false);
        return;
      }

      const taskCount = Array.isArray(parsed.tasks) ? parsed.tasks.length : 0;
      const subjectCount = Array.isArray(parsed.subjects) ? parsed.subjects.length : 0;
      const sessionCount = Array.isArray(parsed.studySessions) ? parsed.studySessions.length : 0;
      const hasSettings = !!parsed.pomodoroSettings || !!parsed.settings;

      const preview =
        `Tasks: ${taskCount}\n` +
        `Subjects: ${subjectCount}\n` +
        `Study sessions: ${sessionCount}\n` +
        `Settings: ${hasSettings ? "Found" : "Not found"}`;

      setImporting(false);

      Alert.alert(
        "Import Preview",
        preview + "\n\nThis will replace your current app data. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Import",
            onPress: async () => {
              try {
                if (Array.isArray(parsed.tasks) || Array.isArray(parsed.tempTasks)) {
                  await importRoutineData({
                    dailyTasks: Array.isArray(parsed.tasks) ? parsed.tasks : undefined,
                    tempTasks: Array.isArray(parsed.tempTasks) ? parsed.tempTasks : undefined,
                  });
                }
                await importStudyData({
                  subjects: Array.isArray(parsed.subjects) ? parsed.subjects : undefined,
                  sessions: Array.isArray(parsed.studySessions) ? parsed.studySessions : undefined,
                  settings: parsed.pomodoroSettings as { workMinutes: number; breakMinutes: number; cycles: number } | undefined,
                });
                if (parsed.settings && typeof parsed.settings === "object") {
                  const s = parsed.settings as Record<string, unknown>;
                  if (s.theme === "light" || s.theme === "dark" || s.theme === "system") {
                    setThemePreference(s.theme as ThemePreference);
                  }
                }
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert("Imported", "Your backup has been restored successfully.");
              } catch {
                Alert.alert("Import Failed", "Something went wrong during import. Your data was not changed.");
              }
            },
          },
        ]
      );
    } catch {
      Alert.alert("Import Failed", "Could not read the selected file.");
      setImporting(false);
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

  const lastBackupLabel = lastBackupDate
    ? (() => {
        const days = Math.floor(
          (Date.now() - new Date(lastBackupDate).getTime()) / 86400000
        );
        if (days === 0) return "Today";
        if (days === 1) return "Yesterday";
        return `${days} days ago`;
      })()
    : "Never";

  const THEME_OPTIONS: { value: ThemePreference; label: string; icon: string }[] = [
    { value: "system", label: "System", icon: "smartphone" },
    { value: "light", label: "Light", icon: "sun" },
    { value: "dark", label: "Moon", icon: "moon" },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 16, paddingBottom: bottomPad + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.headline, { color: colors.foreground }]}>Settings</Text>

        {/* Appearance */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
            <Feather name="eye" size={16} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Appearance</Text>
          </View>
          <View style={styles.themeRow}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>Theme</Text>
            <View style={styles.themeOptions}>
              {THEME_OPTIONS.map((opt) => {
                const active = themePreference === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => {
                      setThemePreference(opt.value);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[
                      styles.themeBtn,
                      {
                        backgroundColor: active ? colors.primary : colors.muted,
                        borderColor: active ? colors.primary : colors.border,
                        borderRadius: 10,
                      },
                    ]}
                  >
                    <Feather
                      name={opt.icon as "smartphone" | "sun" | "moon"}
                      size={14}
                      color={active ? "#fff" : colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.themeBtnText,
                        { color: active ? "#fff" : colors.mutedForeground },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Pomodoro Timer */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
            <Feather name="clock" size={16} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Pomodoro Timer</Text>
          </View>

          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>Focus Duration</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.numInput, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: 8 }]}
                value={workInput}
                onChangeText={setWorkInput}
                keyboardType="number-pad"
                maxLength={3}
                returnKeyType="next"
              />
              <Text style={[styles.unitText, { color: colors.mutedForeground }]}>min</Text>
            </View>
          </View>

          <View style={[styles.separator, { backgroundColor: colors.border }]} />

          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>Break Duration</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.numInput, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: 8 }]}
                value={breakInput}
                onChangeText={setBreakInput}
                keyboardType="number-pad"
                maxLength={2}
                returnKeyType="next"
              />
              <Text style={[styles.unitText, { color: colors.mutedForeground }]}>min</Text>
            </View>
          </View>

          <View style={[styles.separator, { backgroundColor: colors.border }]} />

          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>Cycles per Session</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.numInput, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: 8 }]}
                value={cyclesInput}
                onChangeText={setCyclesInput}
                keyboardType="number-pad"
                maxLength={2}
                returnKeyType="done"
                onSubmitEditing={applySettings}
              />
              <Text style={[styles.unitText, { color: colors.mutedForeground }]}>cycles</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={applySettings}
            style={[styles.saveBtn, { backgroundColor: colors.primary, borderRadius: 10 }]}
          >
            <Text style={styles.saveBtnText}>Save Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Backup */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
            <Feather name="archive" size={16} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Backup</Text>
          </View>

          <TouchableOpacity onPress={handleExport} style={styles.row} activeOpacity={0.7} disabled={exporting}>
            <View style={styles.rowLeft}>
              <Feather name="upload" size={16} color={colors.primary} />
              <View>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>Export Backup</Text>
                <Text style={[styles.rowSubLabel, { color: colors.mutedForeground }]}>
                  Save resetflow_backup_YYYY-MM-DD.json
                </Text>
              </View>
            </View>
            {exporting
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Feather name="chevron-right" size={16} color={colors.mutedForeground} />}
          </TouchableOpacity>

          <View style={[styles.separator, { backgroundColor: colors.border }]} />

          <TouchableOpacity onPress={handleImport} style={styles.row} activeOpacity={0.7} disabled={importing}>
            <View style={styles.rowLeft}>
              <Feather name="download" size={16} color={colors.primary} />
              <View>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>Import Backup</Text>
                <Text style={[styles.rowSubLabel, { color: colors.mutedForeground }]}>
                  Restore from JSON file
                </Text>
              </View>
            </View>
            {importing
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Feather name="chevron-right" size={16} color={colors.mutedForeground} />}
          </TouchableOpacity>

          <View style={[styles.separator, { backgroundColor: colors.border }]} />

          <View style={styles.infoRow}>
            <Feather name="shield" size={14} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              All data is stored locally on this device. No account or internet required.
            </Text>
          </View>
        </View>

        {/* Storage */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
            <Feather name="database" size={16} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Storage</Text>
          </View>

          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>Type</Text>
            <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>Local only</Text>
          </View>
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>Tasks</Text>
            <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{dailyTasks.length + tempTasks.length}</Text>
          </View>
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>Subjects</Text>
            <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{subjects.length}</Text>
          </View>
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>Study sessions</Text>
            <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{sessions.length}</Text>
          </View>
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>Last backup</Text>
            <Text
              style={[
                styles.rowValue,
                { color: lastBackupDate ? colors.success : colors.warning },
              ]}
            >
              {lastBackupLabel}
            </Text>
          </View>
        </View>

        {/* About */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
            <Feather name="info" size={16} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>About</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>App</Text>
            <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>ResetFlow</Text>
          </View>
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>Version</Text>
            <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>1.0.0</Text>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.destructive + "30" }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
            <Feather name="alert-triangle" size={16} color={colors.destructive} />
            <Text style={[styles.sectionTitle, { color: colors.destructive }]}>Danger Zone</Text>
          </View>
          <TouchableOpacity
            onPress={handleResetAll}
            style={[styles.dangerBtn, { borderColor: colors.destructive, borderRadius: 10 }]}
            activeOpacity={0.7}
          >
            <Feather name="trash-2" size={16} color={colors.destructive} />
            <Text style={[styles.dangerBtnText, { color: colors.destructive }]}>Reset All Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 18 },
  headline: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5, marginBottom: 20 },
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
  },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  themeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  themeOptions: { flexDirection: "row", gap: 6 },
  themeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
  },
  themeBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  rowSubLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  rowValue: { fontSize: 14, fontFamily: "Inter_500Medium" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  numInput: {
    width: 60,
    paddingVertical: 7,
    paddingHorizontal: 10,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  unitText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  separator: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  saveBtn: { margin: 16, paddingVertical: 12, alignItems: "center" },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  infoText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    margin: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },
  dangerBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
