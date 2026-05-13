import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";

const TAB_ICONS = {
  index: "check-square",
  study: "book-open",
  stats: "bar-chart-2",
  settings: "settings",
} as const;

export default function TabLayout() {
  const colors = useColors();
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: colors.card,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 24,
          left: 16,
          right: 16,
          bottom: isWeb ? 16 : 12,
          height: isWeb ? 78 : 68,
          paddingTop: 7,
          paddingBottom: isWeb ? 8 : 7,
          shadowColor: "#111827",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.12,
          shadowRadius: 18,
          elevation: 12,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: "Inter_600SemiBold",
          marginTop: 1,
          marginBottom: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarIcon: ({ color, focused }) => {
          const name = TAB_ICONS[route.name as keyof typeof TAB_ICONS] ?? "circle";
          return (
            <View style={[styles.iconWrap, focused && { backgroundColor: colors.secondary }]}>
              <Feather name={name} size={19} color={color} />
            </View>
          );
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Routine" }} />
      <Tabs.Screen name="study" options={{ title: "Study" }} />
      <Tabs.Screen name="stats" options={{ title: "Stats" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 34,
    height: 28,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
