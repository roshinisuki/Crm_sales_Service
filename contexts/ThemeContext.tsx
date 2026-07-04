"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { type ThemeName, type ThemeMode, DEFAULT_THEME_NAME, DEFAULT_THEME_MODE, migrateTheme, migrateMode } from "@/lib/theme";
import { ThemeConfirmDialog } from "@/components/ThemeConfirmDialog";
import { applyTheme } from "@/lib/applyTheme";

interface ThemeContextValue {
  theme: ThemeName;
  mode: ThemeMode;
  setTheme: (t: ThemeName) => void;
  setMode: (m: ThemeMode) => void;
  toggleMode: () => void;
  requestThemeChange: (newTheme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME_NAME,
  mode: DEFAULT_THEME_MODE,
  setTheme: () => {},
  setMode: () => {},
  toggleMode: () => {},
  requestThemeChange: () => {},
});

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
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (initialTheme) {
      return migrateTheme(initialTheme);
    }
    return DEFAULT_THEME_NAME;
  });

  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (initialMode) {
      return migrateMode(initialMode);
    }
    return DEFAULT_THEME_MODE;
  });

  const [pendingTheme, setPendingTheme] = useState<ThemeName | null>(null);

  // Initialize and merge client localStorage preferences if logged out / not stored in DB
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedTheme = localStorage.getItem("suki-theme");
      const storedMode = localStorage.getItem("suki-mode");

      // Migrate 'orange'/'ember' to 'blue'
      if (storedTheme === "orange" || storedTheme === "ember") {
        localStorage.setItem("suki-theme", "blue");
      }

      const activeTheme = migrateTheme(initialTheme || localStorage.getItem("suki-theme") || DEFAULT_THEME_NAME);
      const activeMode = migrateMode(initialMode || localStorage.getItem("suki-mode") || DEFAULT_THEME_MODE);

      setThemeState(activeTheme);
      setModeState(activeMode);
      applyTheme(activeTheme, activeMode);
    }
  }, [initialTheme, initialMode]);

  // Apply theme changes to document & cache
  useEffect(() => {
    applyTheme(theme, mode);
  }, [theme, mode]);

  // Sync tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "suki-theme") setThemeState(migrateTheme(e.newValue));
      if (e.key === "suki-mode") setModeState(migrateMode(e.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persistPreferences = useCallback(async (newTheme?: ThemeName, newMode?: ThemeMode) => {
    if (userId) {
      try {
        await fetch("/api/me/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            theme: newTheme,
            themeMode: newMode,
          }),
        });
      } catch (err) {
        console.error("Failed to persist theme preferences", err);
      }
    }
  }, [userId]);

  const setTheme = useCallback((t: ThemeName) => {
    setThemeState(t);
    persistPreferences(t, undefined);
  }, [persistPreferences]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    persistPreferences(undefined, m);
  }, [persistPreferences]);

  const toggleMode = useCallback(() => {
    const nextMode = mode === "light" ? "dark" : "light";
    setModeState(nextMode);
    persistPreferences(undefined, nextMode);
  }, [mode, persistPreferences]);

  const requestThemeChange = useCallback((newTheme: ThemeName) => {
    if (newTheme === theme) return;
    setPendingTheme(newTheme);
  }, [theme]);

  const confirmThemeChange = useCallback(() => {
    if (!pendingTheme) return;
    setThemeState(pendingTheme);
    persistPreferences(pendingTheme, undefined);
    setPendingTheme(null);
  }, [pendingTheme, persistPreferences]);

  const cancelThemeChange = useCallback(() => {
    setPendingTheme(null);
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme, mode, setTheme, setMode, toggleMode, requestThemeChange }}
    >
      {children}

      {pendingTheme && (
        <ThemeConfirmDialog
          currentTheme={theme}
          pendingTheme={pendingTheme}
          onConfirm={confirmThemeChange}
          onCancel={cancelThemeChange}
        />
      )}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
