import React, { useState } from "react";
import {
  Alert,
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
import { isValidDeadline } from "@/context/RoutineContext";
import { useColors } from "@/hooks/useColors";
import { ReminderOffsetMinutes } from "@/utils/notifications";

interface AddTaskModalProps {
  visible: boolean;
  type: "daily" | "temp";
  onClose: () => void;
  onAdd: (name: string, deadline?: string, reminderOffsetMinutes?: ReminderOffsetMinutes) => void;
}

const REMINDER_OPTIONS: { label: string; value: ReminderOffsetMinutes }[] = [
  { label: "None", value: null },
  { label: "At time", value: 0 },
  { label: "5m", value: 5 },
  { label: "10m", value: 10 },
  { label: "30m", value: 30 },
];

export default function AddTaskModal({ visible, type, onClose, onAdd }: AddTaskModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [reminderOffsetMinutes, setReminderOffsetMinutes] = useState<ReminderOffsetMinutes>(null);

  const reset = () => {
    setName("");
    setDeadline("");
    setReminderOffsetMinutes(null);
  };

  const handleAdd = () => {
    const trimmed = name.trim();
    const deadlineValue = deadline.trim();
    if (!trimmed) return;
    if (deadlineValue && !isValidDeadline(deadlineValue)) {
      Alert.alert("Invalid Deadline", "Use 24-hour time like 09:30 or 22:00.");
      return;
    }
    onAdd(trimmed, deadlineValue || undefined, deadlineValue ? reminderOffsetMinutes : null);
    reset();
    onClose();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "position"}
          pointerEvents="box-none"
          style={styles.kavWrapper}
          contentContainerStyle={styles.kavContent}
        >
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <ScrollView
              keyboardShouldPersistTaps="always"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + 16 }]}
            >
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
              <Text style={[styles.title, { color: colors.foreground }]}>
                {type === "daily" ? "Add Daily Task" : "Add Task for Today"}
              </Text>
              {type === "temp" && (
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                  This task disappears after today unless you move it forward.
                </Text>
              )}

              <TextInput
                style={[styles.input, { backgroundColor: colors.input, color: colors.foreground }]}
                placeholder="Task name"
                placeholderTextColor={colors.mutedForeground}
                value={name}
                onChangeText={setName}
                autoFocus
                returnKeyType="next"
                onSubmitEditing={handleAdd}
              />

              <TextInput
                style={[styles.input, { backgroundColor: colors.input, color: colors.foreground }]}
                placeholder="Deadline, optional (22:00)"
                placeholderTextColor={colors.mutedForeground}
                value={deadline}
                onChangeText={setDeadline}
                returnKeyType="done"
                onSubmitEditing={handleAdd}
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
                style={[styles.addBtn, { backgroundColor: name.trim() ? colors.primary : colors.muted }]}
                onPress={handleAdd}
                disabled={!name.trim()}
              >
                <Text style={[styles.addBtnText, { color: name.trim() ? colors.primaryForeground : colors.mutedForeground }]}>
                  Add Task
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
  backdrop: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  kavWrapper: { flex: 1, justifyContent: "flex-end", zIndex: 1 },
  kavContent: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "92%",
    overflow: "hidden",
    elevation: 8,
  },
  sheetContent: { paddingTop: 12, paddingHorizontal: 20, gap: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 8 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: -6 },
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
    letterSpacing: 0,
  },
  reminderRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reminderChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  reminderChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  addBtn: { paddingVertical: 15, alignItems: "center", borderRadius: 12, marginTop: 4 },
  addBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
