import React, { useState } from "react";
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
import { Subject } from "@/context/StudyContext";
import { useColors } from "@/hooks/useColors";

interface ManualSessionModalProps {
  visible: boolean;
  subjects: Subject[];
  defaultSubjectId?: string;
  onClose: () => void;
  onAdd: (subjectId: string, subjectName: string, durationMinutes: number, date: string, note?: string) => void;
}

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0] as string;
}

export default function ManualSessionModal({
  visible,
  subjects,
  defaultSubjectId,
  onClose,
  onAdd,
}: ManualSessionModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selectedSubjectId, setSelectedSubjectId] = useState(defaultSubjectId ?? subjects[0]?.id ?? "");
  const [durationStr, setDurationStr] = useState("");
  const [date, setDate] = useState(getTodayStr());
  const [note, setNote] = useState("");

  const reset = () => {
    setSelectedSubjectId(defaultSubjectId ?? subjects[0]?.id ?? "");
    setDurationStr("");
    setDate(getTodayStr());
    setNote("");
  };

  const handleClose = () => { reset(); onClose(); };

  const handleAdd = () => {
    const mins = parseInt(durationStr, 10);
    if (!selectedSubjectId || isNaN(mins) || mins < 1) return;
    const subject = subjects.find((s) => s.id === selectedSubjectId);
    if (!subject) return;
    onAdd(selectedSubjectId, subject.name, mins, date, note.trim() || undefined);
    reset();
    onClose();
  };

  const canAdd = !!selectedSubjectId && !!durationStr && parseInt(durationStr, 10) >= 1;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.kavWrapper}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.handle} />
            <Text style={[styles.title, { color: colors.foreground }]}>Add Study Time</Text>

            {/* Subject Selector */}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Subject</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectRow}>
              {subjects.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setSelectedSubjectId(s.id)}
                  style={[
                    styles.subjectChip,
                    {
                      backgroundColor: selectedSubjectId === s.id ? s.color : colors.muted,
                      borderColor: selectedSubjectId === s.id ? s.color : "transparent",
                      borderRadius: 10,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.subjectChipText,
                      { color: selectedSubjectId === s.id ? "#fff" : colors.foreground },
                    ]}
                  >
                    {s.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Duration */}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Duration (minutes)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: 10 }]}
              placeholder="e.g. 45"
              placeholderTextColor={colors.mutedForeground}
              value={durationStr}
              onChangeText={setDurationStr}
              keyboardType="number-pad"
              returnKeyType="next"
            />

            {/* Date */}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Date (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: 10 }]}
              placeholder={getTodayStr()}
              placeholderTextColor={colors.mutedForeground}
              value={date}
              onChangeText={setDate}
              returnKeyType="next"
            />

            {/* Note */}
            <TextInput
              style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: 10 }]}
              placeholder="Note (optional)"
              placeholderTextColor={colors.mutedForeground}
              value={note}
              onChangeText={setNote}
              returnKeyType="done"
              onSubmitEditing={handleAdd}
            />

            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: canAdd ? colors.primary : colors.muted, borderRadius: 12 }]}
              onPress={handleAdd}
              disabled={!canAdd}
            >
              <Text style={[styles.addBtnText, { color: canAdd ? "#fff" : colors.mutedForeground }]}>
                Save Session
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
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingHorizontal: 20, gap: 8 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB", alignSelf: "center", marginBottom: 8 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 4 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  subjectRow: { marginBottom: 4 },
  subjectChip: { paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 2 },
  subjectChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  input: { paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  addBtn: { paddingVertical: 15, alignItems: "center", marginTop: 6 },
  addBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
