import React, { useState } from "react";
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

interface AddTaskModalProps {
  visible: boolean;
  type: "daily" | "temp";
  onClose: () => void;
  onAdd: (name: string, deadline?: string) => void;
}

export default function AddTaskModal({
  visible,
  type,
  onClose,
  onAdd,
}: AddTaskModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [deadline, setDeadline] = useState("");

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed, deadline.trim() || undefined);
    setName("");
    setDeadline("");
    onClose();
  };

  const handleClose = () => {
    setName("");
    setDeadline("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.kavWrapper}
        >
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.card,
                paddingBottom: insets.bottom + 16,
              },
            ]}
          >
            <View style={styles.handle} />

            <Text style={[styles.title, { color: colors.foreground }]}>
              {type === "daily" ? "Add Daily Task" : "Add Task for Today"}
            </Text>
            {type === "temp" && (
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                This task will disappear at end of day
              </Text>
            )}

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.muted,
                  color: colors.foreground,
                  borderRadius: 10,
                },
              ]}
              placeholder="Task name"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={setName}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={handleAdd}
            />

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.muted,
                  color: colors.foreground,
                  borderRadius: 10,
                },
              ]}
              placeholder="Deadline (e.g. 22:00) — optional"
              placeholderTextColor={colors.mutedForeground}
              value={deadline}
              onChangeText={setDeadline}
              returnKeyType="done"
              onSubmitEditing={handleAdd}
            />

            <TouchableOpacity
              style={[
                styles.addBtn,
                {
                  backgroundColor: name.trim() ? colors.primary : colors.muted,
                  borderRadius: 12,
                },
              ]}
              onPress={handleAdd}
              disabled={!name.trim()}
            >
              <Text
                style={[
                  styles.addBtnText,
                  {
                    color: name.trim()
                      ? colors.primaryForeground
                      : colors.mutedForeground,
                  },
                ]}
              >
                Add Task
              </Text>
            </TouchableOpacity>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  kavWrapper: {
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 20,
    gap: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: -6,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  addBtn: {
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  addBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
