import * as DocumentPicker from "expo-document-picker";
import { File as ExpoFile, Paths } from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoutine } from "@/context/RoutineContext";
import { PomodoroSettings, useStudy } from "@/context/StudyContext";
import { ThemePreference, useTheme } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";
import {
  BackupReminderIntervalDays,
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationSettings,
  requestNotificationPermission,
} from "@/utils/notifications";
import { getLocalDateDiffFromToday } from "@/utils/localDate";

type BackupData = {
  version: number;
  exportedAt: string;
  tasks: unknown[];
  tempTasks: unknown[];
  subjects: unknown[];
  studySessions: unknown[];
  pomodoroSettings: Partial<PomodoroSettings>;
  settings: { themePreference?: ThemePreference; lastBackupDate?: string | null; backupVersion?: number };
  notificationSettings: Partial<NotificationSettings>;
  items: unknown[];
  checklists: unknown[];
};

function toDateFilePart() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function normalizeBackup(raw: unknown): BackupData | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (typeof data.version !== "number") return null;
  const hasResetFlowData = [
    "tasks",
    "tempTasks",
    "subjects",
    "studySessions",
    "pomodoroSettings",
    "settings",
    "notificationSettings",
  ].some((key) => key in data);
  if (!hasResetFlowData) return null;
  return {
    version: data.version,
    exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : new Date().toISOString(),
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
    tempTasks: Array.isArray(data.tempTasks) ? data.tempTasks : [],
    subjects: Array.isArray(data.subjects) ? data.subjects : [],
    studySessions: Array.isArray(data.studySessions) ? data.studySessions : [],
    pomodoroSettings: typeof data.pomodoroSettings === "object" && data.pomodoroSettings !== null
      ? data.pomodoroSettings as Partial<PomodoroSettings>
      : {},
    settings: typeof data.settings === "object" && data.settings !== null
      ? data.settings as BackupData["settings"]
      : {},
    notificationSettings: typeof data.notificationSettings === "object" && data.notificationSettings !== null
      ? data.notificationSettings as Partial<NotificationSettings>
      : {},
    items: Array.isArray(data.items) ? data.items : [],
    checklists: Array.isArray(data.checklists) ? data.checklists : [],
  };
}

function createBackupFile(fileName: string, contents: string): string {
  const file = new ExpoFile(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create({ intermediates: true, overwrite: true });
  file.write(contents);
  return file.uri;
}

async function readBackupFile(uri: string): Promise<string> {
  return new ExpoFile(uri).text();
}

function Section({
  title,
  icon,
  children,
  danger,
}: {
  title: string;
  icon: keyof typeof Feather.glyphMap;
  children: React.ReactNode;
  danger?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: danger ? colors.destructive + "40" : colors.border }]}>
      <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
        <Feather name={icon} size={16} color={danger ? colors.destructive : colors.primary} />
        <Text style={[styles.sectionTitle, { color: danger ? colors.destructive : colors.foreground }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Row({
  label,
  sublabel,
  icon,
  right,
  onPress,
  disabled,
}: {
  label: string;
  sublabel?: string;
  icon?: keyof typeof Feather.glyphMap;
  right?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  const content = (
    <View style={styles.rowLeft}>
      {icon ? <Feather name={icon} size={16} color={colors.primary} /> : null}
      <View style={styles.rowTextBlock}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
        {sublabel ? <Text style={[styles.rowSubLabel, { color: colors.mutedForeground }]}>{sublabel}</Text> : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled} style={styles.row} activeOpacity={0.7}>
        {content}
        {right ?? <Feather name="chevron-right" size={16} color={colors.mutedForeground} />}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.row}>
      {content}
      {right}
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { themePreference, setThemePreference } = useTheme();
  const {
    settings,
    notificationSettings,
    updateSettings,
    updateNotificationSettings,
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
    rescheduleTaskNotifications,
    dailyTasks,
    allTempTasks,
  } = useRoutine();

  const [workInput, setWorkInput] = useState(String(settings.workMinutes));
  const [breakInput, setBreakInput] = useState(String(settings.breakMinutes));
  const [cyclesInput, setCyclesInput] = useState(String(settings.cycles));
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const saveTimer = () => {
    const work = parseInt(workInput, 10);
    const brk = parseInt(breakInput, 10);
    const cyc = parseInt(cyclesInput, 10);
    if (Number.isNaN(work) || work < 1 || work > 120) {
      Alert.alert("Invalid Value", "Focus duration must be 1-120 minutes.");
      return;
    }
    if (Number.isNaN(brk) || brk < 1 || brk > 60) {
      Alert.alert("Invalid Value", "Break duration must be 1-60 minutes.");
      return;
    }
    if (Number.isNaN(cyc) || cyc < 1 || cyc > 10) {
      Alert.alert("Invalid Value", "Cycles must be 1-10.");
      return;
    }
    updateSettings({ workMinutes: work, breakMinutes: brk, cycles: cyc });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Saved", "Pomodoro settings updated.");
  };

  const updateNotifications = async (patch: Partial<NotificationSettings>) => {
    const nextPatch = { ...patch };
    try {
      const needsPermission =
        nextPatch.enabled === true ||
        (notificationSettings.enabled && (
          nextPatch.taskRemindersEnabled === true ||
          nextPatch.pomodoroNotificationsEnabled === true ||
          (nextPatch.backupReminderIntervalDays !== undefined && nextPatch.backupReminderIntervalDays !== null)
        ));

      if (needsPermission) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          Alert.alert("Notifications Disabled", "Permission was not granted. ResetFlow will keep working without reminders.");
          if (nextPatch.enabled === true) nextPatch.enabled = false;
        }
      }

      await updateNotificationSettings(nextPatch);
      await rescheduleTaskNotifications();
    } catch {
      Alert.alert("Notifications", "Could not update reminder settings. Please try again.");
    }
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const routineData = exportRoutineData() as { dailyTasks?: unknown[]; tempTasks?: unknown[] };
      const studyData = exportStudyData() as {
        subjects?: unknown[];
        sessions?: unknown[];
        settings?: PomodoroSettings;
        notificationSettings?: NotificationSettings;
      };

      const now = toDateFilePart();
      const exportObj: BackupData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        tasks: routineData.dailyTasks ?? [],
        tempTasks: routineData.tempTasks ?? [],
        subjects: studyData.subjects ?? [],
        studySessions: studyData.sessions ?? [],
        pomodoroSettings: studyData.settings ?? settings,
        settings: {
          themePreference,
          lastBackupDate: now,
          backupVersion: 1,
        },
        notificationSettings: studyData.notificationSettings ?? notificationSettings,
        items: [],
        checklists: [],
      };

      if (Platform.OS === "web") {
        Alert.alert("Export unavailable", "Use the Android app to create a backup file.");
      } else {
        const fileName = `resetflow_backup_${now}.json`;
        const fileUri = createBackupFile(fileName, JSON.stringify(exportObj, null, 2));
        if (!(await Sharing.isAvailableAsync())) {
          Alert.alert("Export unavailable", "Your device does not have a share/save target available right now.");
          return;
        }
        await Sharing.shareAsync(fileUri, {
          mimeType: "application/json",
          dialogTitle: "Save ResetFlow Backup",
          UTI: "public.json",
        });
        setLastBackupDate(now);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Backup Exported", "A JSON backup file was created and the share sheet was opened.");
      }
    } catch {
      Alert.alert("Export Failed", "Could not create the backup file. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    if (importing) return;
    setImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/json", "text/plain", "*/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        setImporting(false);
        return;
      }

      const raw = await readBackupFile(result.assets[0].uri);

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        Alert.alert("Invalid File", "The selected file is not valid JSON.");
        setImporting(false);
        return;
      }

      const backup = normalizeBackup(parsed);
      if (!backup) {
        Alert.alert("Invalid Backup", "This does not look like a ResetFlow backup.");
        setImporting(false);
        return;
      }

      const preview =
        `Daily tasks: ${backup.tasks.length}\n` +
        `Temporary tasks: ${backup.tempTasks.length}\n` +
        `Subjects: ${backup.subjects.length}\n` +
        `Study sessions: ${backup.studySessions.length}\n` +
        `Settings: ${Object.keys(backup.settings).length > 0 ? "Found" : "Not found"}\n` +
        `Notifications: ${Object.keys(backup.notificationSettings).length > 0 ? "Found" : "Not found"}`;

      setImporting(false);

      Alert.alert(
        "Import Preview",
        `${preview}\n\nThis will replace your current app data. Continue?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Import",
            onPress: async () => {
              setImporting(true);
              const routineSnapshot = { dailyTasks, tempTasks: allTempTasks };
              const studySnapshot = { subjects, sessions, settings, notificationSettings, lastBackupDate };
              const themeSnapshot = themePreference;
              try {
                await importStudyData({
                  subjects: backup.subjects,
                  sessions: backup.studySessions,
                  settings: backup.pomodoroSettings,
                  notificationSettings: {
                    ...DEFAULT_NOTIFICATION_SETTINGS,
                    ...backup.notificationSettings,
                  },
                  lastBackupDate: backup.settings.lastBackupDate,
                });
                const pref = backup.settings.themePreference;
                if (pref === "light" || pref === "dark" || pref === "system") setThemePreference(pref);
                await importRoutineData({ dailyTasks: backup.tasks, tempTasks: backup.tempTasks });
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert("Imported", "Backup restored successfully.");
              } catch {
                try {
                  await importStudyData(studySnapshot);
                  await importRoutineData(routineSnapshot);
                  setThemePreference(themeSnapshot);
                } catch {}
                Alert.alert("Import Failed", "Nothing was changed. Please check the backup file and try again.");
              } finally {
                setImporting(false);
              }
            },
          },
        ]
      );
    } catch {
      Alert.alert("Import Failed", "Could not read the selected backup file.");
      setImporting(false);
    }
  };

  const resetAll = () => {
    Alert.alert(
      "Reset All Data",
      "This permanently deletes local tasks, subjects, sessions, and active timers on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset Everything",
          style: "destructive",
          onPress: async () => {
            await Promise.all([resetStudyData(), resetRoutineData()]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert("Done", "All local data has been reset.");
          },
        },
      ]
    );
  };

  const lastBackupLabel = lastBackupDate
    ? (() => {
        const days = getLocalDateDiffFromToday(lastBackupDate);
        if (days === null) return lastBackupDate;
        if (days <= 0) return "Today";
        if (days === 1) return "Yesterday";
        return `${days} days ago`;
      })()
    : "Never";

  const themeOptions: { value: ThemePreference; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { value: "system", label: "System", icon: "smartphone" },
    { value: "light", label: "Light", icon: "sun" },
    { value: "dark", label: "Dark", icon: "moon" },
  ];

  const backupOptions: { label: string; value: BackupReminderIntervalDays }[] = [
    { label: "Off", value: null },
    { label: "7 days", value: 7 },
    { label: "14 days", value: 14 },
    { label: "30 days", value: 30 },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 16, paddingBottom: bottomPad + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.headline, { color: colors.foreground }]}>Settings</Text>

        <Section title="Appearance" icon="eye">
          <View style={styles.themeOptions}>
            {themeOptions.map((option) => {
              const active = themePreference === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setThemePreference(option.value)}
                  style={[
                    styles.themeButton,
                    {
                      backgroundColor: active ? colors.primary : colors.muted,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Feather name={option.icon} size={15} color={active ? "#fff" : colors.mutedForeground} />
                  <Text style={[styles.themeButtonText, { color: active ? "#fff" : colors.mutedForeground }]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Section>

        <Section title="Pomodoro Timer" icon="clock">
          <View style={styles.timerGrid}>
            <View style={styles.timerField}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Focus</Text>
              <TextInput
                style={[styles.numInput, { backgroundColor: colors.input, color: colors.foreground }]}
                value={workInput}
                onChangeText={setWorkInput}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>
            <View style={styles.timerField}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Break</Text>
              <TextInput
                style={[styles.numInput, { backgroundColor: colors.input, color: colors.foreground }]}
                value={breakInput}
                onChangeText={setBreakInput}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
            <View style={styles.timerField}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Cycles</Text>
              <TextInput
                style={[styles.numInput, { backgroundColor: colors.input, color: colors.foreground }]}
                value={cyclesInput}
                onChangeText={setCyclesInput}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
          </View>
          <TouchableOpacity onPress={saveTimer} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.saveBtnText}>Save Timer</Text>
          </TouchableOpacity>
        </Section>

        <Section title="Notifications" icon="bell">
          <Row
            label="Enable notifications"
            sublabel="Local reminders only"
            right={
              <Switch
                value={notificationSettings.enabled}
                onValueChange={(enabled) => updateNotifications({ enabled })}
                thumbColor={notificationSettings.enabled ? colors.primary : colors.mutedForeground}
                trackColor={{ false: colors.muted, true: colors.primary + "55" }}
              />
            }
          />
          <Separator />
          <Row
            label="Task reminders"
            right={
              <Switch
                value={notificationSettings.taskRemindersEnabled}
                onValueChange={(taskRemindersEnabled) => updateNotifications({ taskRemindersEnabled })}
                disabled={!notificationSettings.enabled}
                thumbColor={notificationSettings.taskRemindersEnabled ? colors.primary : colors.mutedForeground}
                trackColor={{ false: colors.muted, true: colors.primary + "55" }}
              />
            }
          />
          <Separator />
          <Row
            label="Pomodoro notifications"
            right={
              <Switch
                value={notificationSettings.pomodoroNotificationsEnabled}
                onValueChange={(pomodoroNotificationsEnabled) => updateNotifications({ pomodoroNotificationsEnabled })}
                disabled={!notificationSettings.enabled}
                thumbColor={notificationSettings.pomodoroNotificationsEnabled ? colors.primary : colors.mutedForeground}
                trackColor={{ false: colors.muted, true: colors.primary + "55" }}
              />
            }
          />
          <Separator />
          <View style={styles.backupReminderBlock}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>Backup reminder</Text>
            <View style={styles.intervalRow}>
              {backupOptions.map((option) => {
                const active = notificationSettings.backupReminderIntervalDays === option.value;
                return (
                  <TouchableOpacity
                    key={option.label}
                    onPress={() => updateNotifications(
                      option.value === null
                        ? { backupReminderIntervalDays: null }
                        : { enabled: true, backupReminderIntervalDays: option.value }
                    )}
                    style={[
                      styles.intervalChip,
                      {
                        backgroundColor: active ? colors.primary : colors.muted,
                        borderColor: active ? colors.primary : colors.border,
                        opacity: notificationSettings.enabled || option.value === null || active ? 1 : 0.72,
                      },
                    ]}
                  >
                    <Text style={[styles.intervalChipText, { color: active ? "#fff" : colors.mutedForeground }]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Section>

        <Section title="Backup" icon="archive">
          <Row
            label="Export Backup"
            sublabel="Creates resetflow_backup_YYYY-MM-DD.json"
            icon="upload"
            onPress={handleExport}
            disabled={exporting}
            right={exporting ? <ActivityIndicator size="small" color={colors.primary} /> : undefined}
          />
          <Separator />
          <Row
            label="Import Backup"
            sublabel="Preview and confirm before replacing data"
            icon="download"
            onPress={handleImport}
            disabled={importing}
            right={importing ? <ActivityIndicator size="small" color={colors.primary} /> : undefined}
          />
          <Separator />
          <View style={styles.infoRow}>
            <Feather name="shield" size={14} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              ResetFlow stores app data only on this device unless you export a backup.
            </Text>
          </View>
        </Section>

        <Section title="Storage" icon="database">
          <Row label="Type" right={<Text style={[styles.rowValue, { color: colors.mutedForeground }]}>Local only</Text>} />
          <Separator />
          <Row label="Tasks" right={<Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{dailyTasks.length + allTempTasks.length}</Text>} />
          <Separator />
          <Row label="Subjects" right={<Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{subjects.length}</Text>} />
          <Separator />
          <Row label="Study sessions" right={<Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{sessions.length}</Text>} />
          <Separator />
          <Row label="Last backup" right={<Text style={[styles.rowValue, { color: lastBackupDate ? colors.success : colors.warning }]}>{lastBackupLabel}</Text>} />
        </Section>

        <Section title="About" icon="info">
          <Row label="App" right={<Text style={[styles.rowValue, { color: colors.mutedForeground }]}>ResetFlow</Text>} />
          <Separator />
          <Row label="Version" right={<Text style={[styles.rowValue, { color: colors.mutedForeground }]}>1.0.1</Text>} />
          <Separator />
          <Row label="Network" right={<Text style={[styles.rowValue, { color: colors.success }]}>Offline</Text>} />
        </Section>

        <Section title="Danger Zone" icon="alert-triangle" danger>
          <TouchableOpacity onPress={resetAll} style={[styles.dangerBtn, { borderColor: colors.destructive }]}>
            <Feather name="trash-2" size={16} color={colors.destructive} />
            <Text style={[styles.dangerBtnText, { color: colors.destructive }]}>Reset All Data</Text>
          </TouchableOpacity>
        </Section>
      </ScrollView>
    </View>
  );
}

function Separator() {
  const colors = useColors();
  return <View style={[styles.separator, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 18 },
  headline: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 20 },
  section: { borderRadius: 14, borderWidth: 1, marginBottom: 16, overflow: "hidden" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  rowTextBlock: { flex: 1 },
  rowLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  rowSubLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  rowValue: { fontSize: 14, fontFamily: "Inter_500Medium" },
  separator: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  themeOptions: { flexDirection: "row", gap: 8, padding: 16 },
  themeButton: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center", gap: 5 },
  themeButtonText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  timerGrid: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 14 },
  timerField: { flex: 1, gap: 6 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" },
  numInput: { borderRadius: 10, paddingVertical: 10, textAlign: "center", fontSize: 16, fontFamily: "Inter_700Bold" },
  saveBtn: { margin: 16, paddingVertical: 12, alignItems: "center", borderRadius: 10 },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  backupReminderBlock: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  intervalRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  intervalChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  intervalChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  infoText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  dangerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, margin: 16, paddingVertical: 12, borderWidth: 1, borderRadius: 10 },
  dangerBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
