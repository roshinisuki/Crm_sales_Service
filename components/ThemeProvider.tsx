"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { saveUserThemeAction, saveUserThemeModeAction } from "@/app/actions/auth";
import {
  type ThemeName,
  type ThemeMode,
  DEFAULT_THEME_NAME,
  DEFAULT_THEME_MODE,
  migrateTheme,
  migrateMode,
  THEME_TO_LEGACY,
} from "@/lib/theme";

interface ThemeContextValue {
  theme: ThemeName;
  mode: ThemeMode;
  setTheme: (t: ThemeName) => void;
  setMode: (m: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME_NAME,
  mode: DEFAULT_THEME_MODE,
  setTheme: () => {},
  setMode: () => {},
  toggleMode: () => {},
});

/** The single theme source of truth for the entire application. */
export function ThemeProvider({
  children,
  initialTheme,
  initialMode,
  userId,
}: {
  children: ReactNode;
  initialTheme?: string | null;
  initialMode?: string | null;
  userId?: string | null;
}) {
  const [theme, setThemeState] = useState<ThemeName>(() =>
    migrateTheme(initialTheme || DEFAULT_THEME_NAME)
  );
  const [mode, setModeState] = useState<ThemeMode>(() =>
    migrateMode(initialMode || DEFAULT_THEME_MODE)
  );

  // Keep client state in sync with the server-provided DB value on navigation/refresh.
  useEffect(() => {
    setThemeState(migrateTheme(initialTheme || DEFAULT_THEME_NAME));
    setModeState(migrateMode(initialMode || DEFAULT_THEME_MODE));
  }, [initialTheme, initialMode]);

  // Apply theme to DOM and localStorage cache on every change.
  const applyTheme = useCallback((t: ThemeName, m: ThemeMode) => {
    document.documentElement.setAttribute("data-theme", t);
    document.documentElement.setAttribute("data-mode", m);
    if (m === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("suki-theme", t);
    localStorage.setItem("suki-mode", m);
    window.dispatchEvent(
      new CustomEvent("suki-theme-change", { detail: { theme: t, mode: m } })
    );
  }, []);

  useEffect(() => {
    applyTheme(theme, mode);
  }, [theme, mode, applyTheme]);

  // Cross-tab sync via storage event.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "suki-theme") setThemeState(migrateTheme(e.newValue));
      if (e.key === "suki-mode") setModeState(migrateMode(e.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Persist to DB as the ultimate source of truth whenever the theme/mode changes.
  useEffect(() => {
    if (userId) {
      const legacy = THEME_TO_LEGACY[theme] || THEME_TO_LEGACY[DEFAULT_THEME_NAME];
      saveUserThemeAction(legacy).catch(() => {});
    }
  }, [theme, userId]);

  useEffect(() => {
    if (userId) {
      saveUserThemeModeAction(mode).catch(() => {});
    }
  }, [mode, userId]);

  const setTheme = useCallback((t: ThemeName) => {
    setThemeState(t);
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((m) => (m === "light" ? "dark" : "light"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, mode, setTheme, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Read from the single theme context. */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
