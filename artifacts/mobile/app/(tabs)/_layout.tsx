import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
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
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          height: isWeb ? 84 : 64,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: "Inter_500Medium",
          marginBottom: isWeb ? 0 : 5,
        },
        tabBarIcon: ({ color }) => {
          const name = TAB_ICONS[route.name as keyof typeof TAB_ICONS] ?? "circle";
          return <Feather name={name} size={21} color={color} />;
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
