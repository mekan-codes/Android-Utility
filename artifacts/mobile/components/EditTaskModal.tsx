import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { ReminderOffsetMinutes } from "@/utils/notifications";

interface EditTaskModalProps {
  visible: boolean;
  initialName: string;
  initialDeadline?: string;
  initialReminderOffsetMinutes?: ReminderOffsetMinutes;
  onClose: () => void;
  onSave: (name: string, deadline?: string, reminderOffsetMinutes?: ReminderOffsetMinutes) => void;
}

const REMINDER_OPTIONS: { label: string; value: ReminderOffsetMinutes }[] = [
  { label: "None", value: null },
  { label: "At time", value: 0 },
  { label: "5m", value: 5 },
  { label: "10m", value: 10 },
  { label: "30m", value: 30 },
];

export default function EditTaskModal({
  visible,
  initialName,
  initialDeadline,
  initialReminderOffsetMinutes,
  onClose,
  onSave,
}: EditTaskModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initialName);
  const [deadline, setDeadline] = useState(initialDeadline ?? "");
  const [reminderOffsetMinutes, setReminderOffsetMinutes] =
    useState<ReminderOffsetMinutes>(initialReminderOffsetMinutes ?? null);

  useEffect(() => {
    if (visible) {
      setName(initialName);
      setDeadline(initialDeadline ?? "");
      setReminderOffsetMinutes(initialReminderOffsetMinutes ?? null);
    }
  }, [visible, initialName, initialDeadline, initialReminderOffsetMinutes]);

  const handleSave = () => {
    const trimmed = name.trim();
    const deadlineValue = deadline.trim();
    if (!trimmed) return;
    onSave(trimmed, deadlineValue || undefined, deadlineValue ? reminderOffsetMinutes : null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "position"}
          style={styles.kavWrapper}
          contentContainerStyle={styles.kavContent}
        >
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + 16 }]}
            >
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
              <Text style={[styles.title, { color: colors.foreground }]}>Edit Task</Text>

              <TextInput
                style={[styles.input, { backgroundColor: colors.input, color: colors.foreground }]}
                placeholder="Task name"
                placeholderTextColor={colors.mutedForeground}
                value={name}
                onChangeText={setName}
                autoFocus
                returnKeyType="next"
              />

              <TextInput
                style={[styles.input, { backgroundColor: colors.input, color: colors.foreground }]}
                placeholder="Deadline, optional (22:00)"
                placeholderTextColor={colors.mutedForeground}
                value={deadline}
                onChangeText={setDeadline}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />

              <Text style={[styles.label, { color: colors.mutedForeground }]}>Reminder</Text>
              <View style={styles.reminderRow}>
                {REMINDER_OPTIONS.map((option) => {
                  const active = reminderOffsetMinutes === option.value;
                  return (
                    <TouchableOpacity
                      key={option.label}
                      onPress={() => setReminderOffsetMinutes(option.value)}
                      style={[
                        styles.reminderChip,
                        {
                          backgroundColor: active ? colors.primary : colors.muted,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.reminderChipText, { color: active ? "#fff" : colors.mutedForeground }]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: name.trim() ? colors.primary : colors.muted }]}
                onPress={handleSave}
                disabled={!name.trim()}
              >
                <Text style={[styles.saveBtnText, { color: name.trim() ? "#fff" : colors.mutedForeground }]}>
                  Save Changes
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject },
  kavWrapper: { flex: 1, justifyContent: "flex-end" },
  kavContent: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "92%",
    overflow: "hidden",
  },
  sheetContent: { paddingTop: 12, paddingHorizontal: 20, gap: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 8 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  reminderRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reminderChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  reminderChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  saveBtn: { paddingVertical: 15, alignItems: "center", borderRadius: 12, marginTop: 4 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
