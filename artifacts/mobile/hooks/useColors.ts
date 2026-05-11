import { useTheme } from "@/context/ThemeContext";
import colors from "@/constants/colors";

/**
 * Returns the design tokens for the currently active theme.
 *
 * Uses ThemeContext which supports System / Light / Dark preferences.
 * System mode follows the device color scheme and updates automatically.
 */
export function useColors() {
  const { resolvedTheme } = useTheme();
  const palette = resolvedTheme === "dark" ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
