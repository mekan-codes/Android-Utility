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

const SUBJECT_COLORS = [
  "#6366F1", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#06B6D4", "#F97316", "#EC4899",
];

interface EditSubjectModalProps {
  visible: boolean;
  initialName: string;
  initialColor: string;
  onClose: () => void;
  onSave: (name: string, color: string) => void;
}

export default function EditSubjectModal({
  visible,
  initialName,
  initialColor,
  onClose,
  onSave,
}: EditSubjectModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initialName);
  const [selectedColor, setSelectedColor] = useState(initialColor);

  useEffect(() => {
    if (visible) {
      setName(initialName);
      setSelectedColor(initialColor);
    }
  }, [visible, initialName, initialColor]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, selectedColor);
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
              <View style={styles.handle} />
              <Text style={[styles.title, { color: colors.foreground }]}>Edit Subject</Text>

              <TextInput
                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: 10 }]}
                placeholder="Subject name"
                placeholderTextColor={colors.mutedForeground}
                value={name}
                onChangeText={setName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />

              <Text style={[styles.colorLabel, { color: colors.mutedForeground }]}>Color</Text>
              <View style={styles.colorRow}>
                {SUBJECT_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setSelectedColor(c)}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      selectedColor === c && styles.colorDotSelected,
                    ]}
                  />
                ))}
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: name.trim() ? selectedColor : colors.muted, borderRadius: 12 }]}
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
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "92%", overflow: "hidden" },
  sheetContent: { paddingTop: 12, paddingHorizontal: 20, gap: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB", alignSelf: "center", marginBottom: 8 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  input: { paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, fontFamily: "Inter_400Regular" },
  colorLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: -4 },
  colorRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotSelected: {
    transform: [{ scale: 1.25 }],
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },
  saveBtn: { paddingVertical: 15, alignItems: "center", marginTop: 4 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
