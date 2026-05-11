import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

interface EditTaskModalProps {
  visible: boolean;
  initialName: string;
  initialDeadline?: string;
  onClose: () => void;
  onSave: (name: string, deadline?: string) => void;
}

export default function EditTaskModal({
  visible,
  initialName,
  initialDeadline,
  onClose,
  onSave,
}: EditTaskModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initialName);
  const [deadline, setDeadline] = useState(initialDeadline ?? "");

  useEffect(() => {
    if (visible) {
      setName(initialName);
      setDeadline(initialDeadline ?? "");
    }
  }, [visible, initialName, initialDeadline]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, deadline.trim() || undefined);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.kavWrapper}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.handle} />
            <Text style={[styles.title, { color: colors.foreground }]}>Edit Task</Text>

            <TextInput
              style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: 10 }]}
              placeholder="Task name"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={setName}
              autoFocus
              returnKeyType="next"
            />

            <TextInput
              style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: 10 }]}
              placeholder="Deadline (e.g. 22:00) — optional"
              placeholderTextColor={colors.mutedForeground}
              value={deadline}
              onChangeText={setDeadline}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: name.trim() ? colors.primary : colors.muted, borderRadius: 12 }]}
              onPress={handleSave}
              disabled={!name.trim()}
            >
              <Text style={[styles.saveBtnText, { color: name.trim() ? "#fff" : colors.mutedForeground }]}>
                Save Changes
              </Text>
            </TouchableOpacity>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  kavWrapper: { justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingHorizontal: 20, gap: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB", alignSelf: "center", marginBottom: 8 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  input: { paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, fontFamily: "Inter_400Regular" },
  saveBtn: { paddingVertical: 15, alignItems: "center", marginTop: 4 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
