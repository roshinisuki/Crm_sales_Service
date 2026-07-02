"use client";

// Backward-compatible exports for the single theme source of truth.
export { useTheme, ThemeProvider } from "@/components/ThemeProvider";
export type { ThemeName, ThemeMode } from "@/lib/theme";
export {
  validThemes,
  validModes,
  DEFAULT_THEME_NAME,
  DEFAULT_THEME_MODE,
  DB_DEFAULT_THEME,
  THEME_TO_LEGACY,
  migrateTheme,
  migrateMode,
} from "@/lib/theme";
