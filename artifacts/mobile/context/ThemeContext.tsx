import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";

export type ThemePreference = "system" | "light" | "dark";

interface ThemeContextValue {
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_KEY = "@resetflow/theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((val) => {
      if (val === "light" || val === "dark" || val === "system") {
        setThemePreferenceState(val);
      }
    }).catch(() => {});
  }, []);

  const setThemePreference = useCallback((pref: ThemePreference) => {
    setThemePreferenceState(pref);
    AsyncStorage.setItem(THEME_KEY, pref).catch(() => {});
  }, []);

  const resolvedTheme: "light" | "dark" =
    themePreference === "system"
      ? systemScheme === "dark" ? "dark" : "light"
      : themePreference;

  return (
    <ThemeContext.Provider value={{ themePreference, setThemePreference, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
