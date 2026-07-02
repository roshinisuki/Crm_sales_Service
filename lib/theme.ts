// Single source of truth for theme names, modes, and default values.
export type ThemeName = "orange" | "blue" | "green" | "purple";
export type ThemeMode = "light" | "dark";

export const validThemes: ThemeName[] = ["orange", "blue", "green", "purple"];
export const validModes: ThemeMode[] = ["light", "dark"];

/** New users and logged-out users always start with BLUE. */
export const DEFAULT_THEME_NAME: ThemeName = "blue";
export const DEFAULT_THEME_MODE: ThemeMode = "light";

/** Legacy Prisma names → new theme keys. */
export const LEGACY_THEME_MAP: Record<string, ThemeName> = {
  ember: "orange",
  ocean: "blue",
  forest: "green",
  obsidian: "purple",
  black: "purple",
};

/** New theme keys → legacy Prisma names for database persistence. */
export const THEME_TO_LEGACY: Record<ThemeName, string> = {
  orange: "ember",
  blue: "ocean",
  green: "forest",
  purple: "obsidian",
};

/** Prisma default value for the User.theme field. */
export const DB_DEFAULT_THEME = THEME_TO_LEGACY[DEFAULT_THEME_NAME];

/** Normalize any incoming theme value to a valid ThemeName. */
export function migrateTheme(t: string | null | undefined): ThemeName {
  if (!t) return DEFAULT_THEME_NAME;
  if (validThemes.includes(t as ThemeName)) return t as ThemeName;
  if (LEGACY_THEME_MAP[t]) return LEGACY_THEME_MAP[t];
  return DEFAULT_THEME_NAME;
}

/** Normalize any incoming mode value to a valid ThemeMode. */
export function migrateMode(m: string | null | undefined): ThemeMode {
  if (!m) return DEFAULT_THEME_MODE;
  if (validModes.includes(m as ThemeMode)) return m as ThemeMode;
  return DEFAULT_THEME_MODE;
}
