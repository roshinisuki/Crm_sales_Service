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

  // DEBUG: log the initial props received from the server
  if (typeof window !== "undefined") {
    console.log("[ThemeProvider] initial props", { initialTheme, initialMode, userId });
  }

  // Hydration guard: ensure the server-rendered theme attributes are re-applied
  // to the document after React mounts. We do NOT read localStorage here —
  // initialTheme/initialMode from the root layout are the single source of truth.
  useEffect(() => {
    console.log("[ThemeProvider] applying theme", { theme, mode });
    applyTheme(theme, mode);
  }, [theme, mode]);

  const persistPreferences = useCallback(async (newTheme?: ThemeName, newMode?: ThemeMode) => {
    console.log("[ThemeProvider] persisting preferences", { userId, newTheme, newMode });
    if (userId) {
      try {
        const res = await fetch("/api/me/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            theme: newTheme,
            themeMode: newMode,
          }),
        });
        const data = await res.json();
        console.log("[ThemeProvider] preferences response", data);
      } catch (err) {
        console.error("[ThemeProvider] failed to persist theme preferences", err);
      }
    }
  }, [userId]);

  const setTheme = useCallback((t: ThemeName) => {
    console.log("[ThemeProvider] setTheme called", t);
    setThemeState(t);
    persistPreferences(t, undefined);
  }, [persistPreferences]);

  const setMode = useCallback((m: ThemeMode) => {
    console.log("[ThemeProvider] setMode called", m);
    setModeState(m);
    persistPreferences(undefined, m);
  }, [persistPreferences]);

  const toggleMode = useCallback(() => {
    const nextMode = mode === "light" ? "dark" : "light";
    console.log("[ThemeProvider] toggleMode", { from: mode, to: nextMode });
    setModeState(nextMode);
    persistPreferences(undefined, nextMode);
  }, [mode, persistPreferences]);

  const requestThemeChange = useCallback((newTheme: ThemeName) => {
    console.log("[ThemeProvider] requestThemeChange", { current: theme, requested: newTheme });
    if (newTheme === theme) return;
    setPendingTheme(newTheme);
  }, [theme]);

  const confirmThemeChange = useCallback(() => {
    console.log("[ThemeProvider] confirmThemeChange", pendingTheme);
    if (!pendingTheme) return;
    setThemeState(pendingTheme);
    persistPreferences(pendingTheme, undefined);
    setPendingTheme(null);
  }, [pendingTheme, persistPreferences]);

  const cancelThemeChange = useCallback(() => {
    console.log("[ThemeProvider] cancelThemeChange");
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
