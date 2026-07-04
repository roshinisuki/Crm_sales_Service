// Single source of truth for theme names, modes, and default values.
export type ThemeName = "blue" | "green" | "purple" | "orange";
export type ThemeMode = "light" | "dark";

export const validThemes: ThemeName[] = ["blue", "green", "purple", "orange"];
export const validModes: ThemeMode[] = ["light", "dark"];

/** New users and logged-out users always start with BLUE. */
export const DEFAULT_THEME_NAME: ThemeName = "blue";
export const DEFAULT_THEME_MODE: ThemeMode = "light";

/** Legacy Prisma names → new theme keys. */
export const LEGACY_THEME_MAP: Record<string, ThemeName> = {
  ember:    "orange",
  ocean:    "blue",
  forest:   "green",
  obsidian: "purple",
  black:    "purple",  // fallback black to purple
  orange:   "orange",
  dark:     "purple",  // fallback dark to purple
};

/** New theme keys → legacy Prisma names for database persistence. */
export const THEME_TO_LEGACY: Record<ThemeName, string> = {
  blue:   "ocean",
  green:  "forest",
  purple: "obsidian",
  orange: "ember",
};

/** Prisma default value for the User.theme field. */
export const DB_DEFAULT_THEME = THEME_TO_LEGACY[DEFAULT_THEME_NAME];

/** Normalize any incoming theme value to a valid ThemeName. */
export function migrateTheme(t: string | null | undefined): ThemeName {
  if (!t) return DEFAULT_THEME_NAME;
  const normalized = t.toLowerCase().trim();
  if (validThemes.includes(normalized as ThemeName)) return normalized as ThemeName;
  if (LEGACY_THEME_MAP[normalized]) return LEGACY_THEME_MAP[normalized];
  return DEFAULT_THEME_NAME;
}

/** Normalize any incoming mode value to a valid ThemeMode. */
export function migrateMode(m: string | null | undefined): ThemeMode {
  if (!m) return DEFAULT_THEME_MODE;
  if (validModes.includes(m as ThemeMode)) return m as ThemeMode;
  return DEFAULT_THEME_MODE;
}
