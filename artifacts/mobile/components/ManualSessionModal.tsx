import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Keyboard,
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

const QUICK_DURATIONS = [15, 25, 30, 45, 50, 60];

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayStr(): string {
  return formatLocalDate(new Date());
}

function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatLocalDate(date);
}

function dateFromStr(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function addDays(date: string, days: number): string {
  const next = dateFromStr(date);
  next.setDate(next.getDate() + days);
  return formatLocalDate(next);
}

function formatReadableDate(date: string): string {
  return dateFromStr(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function normalizeDateInput(input: string): string | null {
  const parts = input.trim().split(/[-/.]/);
  if (parts.length !== 3) return null;
  const [yearRaw, monthRaw, dayRaw] = parts;
  if (!yearRaw || !monthRaw || !dayRaw) return null;
  if (!/^\d{4}$/.test(yearRaw) || !/^\d{1,2}$/.test(monthRaw) || !/^\d{1,2}$/.test(dayRaw)) {
    return null;
  }

  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (month < 1 || month > 12) return null;
  const maxDay = new Date(year, month, 0).getDate();
  if (day < 1 || day > maxDay) return null;

  return `${yearRaw}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDuration(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const minutes = Number(trimmed);
  return minutes >= 1 && minutes <= 1440 ? minutes : null;
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
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [manualDate, setManualDate] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!visible) return;
    setSelectedSubjectId((current) => {
      if (defaultSubjectId && subjects.some((subject) => subject.id === defaultSubjectId)) {
        return defaultSubjectId;
      }
      if (current && subjects.some((subject) => subject.id === current)) {
        return current;
      }
      return subjects[0]?.id ?? "";
    });
  }, [defaultSubjectId, subjects, visible]);

  const reset = () => {
    setSelectedSubjectId(defaultSubjectId ?? subjects[0]?.id ?? "");
    setDurationStr("");
    setSelectedDate(getTodayStr());
    setManualDate("");
    setDateError(null);
    setNote("");
  };

  const chooseDate = (date: string) => {
    setSelectedDate(date);
    setManualDate("");
    setDateError(null);
  };

  const applyManualDate = (): string | null => {
    const trimmed = manualDate.trim();
    if (!trimmed) return selectedDate;
    const normalized = normalizeDateInput(trimmed);
    if (!normalized) {
      setDateError("Invalid date. Use YYYY-MM-DD or select a day.");
      return null;
    }
    setSelectedDate(normalized);
    setManualDate(normalized);
    setDateError(null);
    return normalized;
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleAdd = () => {
    const mins = parseDuration(durationStr);
    if (!mins) {
      Alert.alert("Invalid Duration", "Enter study time in minutes.");
      return;
    }

    const normalizedDate = applyManualDate();
    if (!normalizedDate) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD or select a day.");
      return;
    }

    const subject = subjects.find((s) => s.id === selectedSubjectId);
    if (!subject) return;
    onAdd(selectedSubjectId, subject.name, mins, normalizedDate, note.trim() || undefined);
    reset();
    onClose();
  };

  const canAdd = !!selectedSubjectId && parseDuration(durationStr) !== null;

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
              <View style={styles.handle} />
              <Text style={[styles.title, { color: colors.foreground }]}>Add Study Time</Text>

              <Text style={[styles.label, { color: colors.mutedForeground }]}>Subject</Text>
              {subjects.length === 0 ? (
                <View style={styles.emptySubjectRow}>
                  <Text style={[styles.emptySubjectText, { color: colors.mutedForeground }]}>
                    Add a subject first.
                  </Text>
                </View>
              ) : (
                <View style={styles.subjectRow}>
                  {subjects.map((s) => {
                    const selected = selectedSubjectId === s.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        activeOpacity={0.8}
                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`Choose ${s.name}`}
                        onPress={() => {
                          Keyboard.dismiss();
                          setSelectedSubjectId(s.id);
                        }}
                        style={[
                          styles.subjectChip,
                          {
                            backgroundColor: selected ? s.color : colors.muted,
                            borderColor: selected ? s.color : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.subjectChipText,
                            { color: selected ? "#fff" : colors.foreground },
                          ]}
                          numberOfLines={1}
                        >
                          {s.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={[styles.label, { color: colors.mutedForeground }]}>Duration</Text>
              <View style={styles.quickRow}>
                {QUICK_DURATIONS.map((minutes) => {
                  const active = durationStr === String(minutes);
                  return (
                    <TouchableOpacity
                      key={minutes}
                      onPress={() => setDurationStr(String(minutes))}
                      style={[
                        styles.quickChip,
                        {
                          backgroundColor: active ? colors.primary : colors.muted,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.quickChipText, { color: active ? "#fff" : colors.mutedForeground }]}>
                        {minutes}m
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput
                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground }]}
                placeholder="Custom minutes"
                placeholderTextColor={colors.mutedForeground}
                value={durationStr}
                onChangeText={setDurationStr}
                keyboardType="number-pad"
                returnKeyType="next"
                maxLength={4}
              />

              <Text style={[styles.label, { color: colors.mutedForeground }]}>Date</Text>
              <View style={styles.quickRow}>
                {[
                  { label: "Today", date: getDateDaysAgo(0) },
                  { label: "Yesterday", date: getDateDaysAgo(1) },
                  { label: "2 days ago", date: getDateDaysAgo(2) },
                ].map((option) => {
                  const active = selectedDate === option.date && manualDate.trim().length === 0;
                  return (
                    <TouchableOpacity
                      key={option.label}
                      onPress={() => chooseDate(option.date)}
                      style={[
                        styles.quickChip,
                        {
                          backgroundColor: active ? colors.primary : colors.muted,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.quickChipText, { color: active ? "#fff" : colors.mutedForeground }]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={[styles.dateStepper, { backgroundColor: colors.muted }]}>
                <TouchableOpacity onPress={() => chooseDate(addDays(selectedDate, -1))} style={styles.stepBtn}>
                  <Feather name="chevron-left" size={18} color={colors.foreground} />
                  <Text style={[styles.stepText, { color: colors.foreground }]}>Previous</Text>
                </TouchableOpacity>
                <View style={styles.dateReadout}>
                  <Text style={[styles.dateReadable, { color: colors.foreground }]}>{formatReadableDate(selectedDate)}</Text>
                  <Text style={[styles.dateIso, { color: colors.mutedForeground }]}>{selectedDate}</Text>
                </View>
                <TouchableOpacity onPress={() => chooseDate(addDays(selectedDate, 1))} style={styles.stepBtn}>
                  <Text style={[styles.stepText, { color: colors.foreground }]}>Next</Text>
                  <Feather name="chevron-right" size={18} color={colors.foreground} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground }]}
                placeholder="Manual date, optional"
                placeholderTextColor={colors.mutedForeground}
                value={manualDate}
                onChangeText={(value) => {
                  setManualDate(value);
                  setDateError(null);
                }}
                onBlur={applyManualDate}
                autoCapitalize="none"
                returnKeyType="next"
              />
              {dateError ? <Text style={[styles.errorText, { color: colors.destructive }]}>{dateError}</Text> : null}

              <TextInput
                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground }]}
                placeholder="Note (optional)"
                placeholderTextColor={colors.mutedForeground}
                value={note}
                onChangeText={setNote}
                returnKeyType="done"
                onSubmitEditing={handleAdd}
              />

              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: canAdd ? colors.primary : colors.muted }]}
                onPress={handleAdd}
                disabled={!canAdd}
              >
                <Text style={[styles.addBtnText, { color: canAdd ? "#fff" : colors.mutedForeground }]}>
                  Save Session
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
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "92%", overflow: "hidden", elevation: 8 },
  sheetContent: { paddingTop: 12, paddingHorizontal: 20, gap: 9 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB", alignSelf: "center", marginBottom: 8 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 4 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0 },
  subjectRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, paddingBottom: 2 },
  subjectChip: { maxWidth: "100%", minHeight: 38, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderRadius: 10 },
  subjectChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  emptySubjectRow: { paddingVertical: 2 },
  emptySubjectText: { fontSize: 13, fontFamily: "Inter_500Medium", paddingVertical: 8 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, borderWidth: 1 },
  quickChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  input: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, fontSize: 15, fontFamily: "Inter_400Regular" },
  dateStepper: { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 8, gap: 8 },
  stepBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", minWidth: 78, paddingVertical: 8 },
  stepText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  dateReadout: { flex: 1, alignItems: "center", gap: 2 },
  dateReadable: { fontSize: 14, fontFamily: "Inter_700Bold", textAlign: "center" },
  dateIso: { fontSize: 12, fontFamily: "Inter_500Medium" },
  errorText: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: -4 },
  addBtn: { paddingVertical: 15, alignItems: "center", marginTop: 6, borderRadius: 12 },
  addBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
