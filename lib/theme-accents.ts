"use client";

import { useState, useEffect } from "react";

export const THEME_ACCENTS = {
  blue:    "#2090FF",
  green:   "#7f9e15",
  purple:  "#CD69ED",
  dark:    "#FFFFFF",
  // Legacy names kept for backward compatibility
  orange:  "#F77F00",
} as const;

export type ThemeAccentKey = keyof typeof THEME_ACCENTS;

function colorKeyToAccent(colorKey: string): ThemeAccentKey {
  if (colorKey === "forest" || colorKey === "green")       return "green";
  if (colorKey === "ember"  || colorKey === "orange")      return "orange";
  if (colorKey === "ocean"  || colorKey === "blue")        return "blue";
  if (colorKey === "purple" || colorKey === "obsidian" || colorKey === "black") return "purple";
  if (colorKey === "dark")                                 return "dark";
  return "blue";
}

function readAccentFromDOM(): ThemeAccentKey {
  if (typeof window === "undefined") return "blue";
  // New system: separate data-theme attribute
  const attr = document.documentElement.getAttribute("data-theme") ?? "blue";
  // Could be "blue", "green", "purple", "dark" (new) or "ember-light" (legacy)
  const sep = attr.lastIndexOf("-");
  const color = sep > 0 ? attr.slice(0, sep) : attr;
  return colorKeyToAccent(color);
}

export function useThemeAccent(): string {
  const [accent, setAccent] = useState<string>(() => {
    if (typeof window !== "undefined") return THEME_ACCENTS[readAccentFromDOM()];
    return THEME_ACCENTS.blue;
  });

  useEffect(() => {
    const update = () => setAccent(THEME_ACCENTS[readAccentFromDOM()]);
    update();

    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    const onThemeChange = () => update();
    window.addEventListener("suki-theme-change", onThemeChange);

    return () => {
      mo.disconnect();
      window.removeEventListener("suki-theme-change", onThemeChange);
    };
  }, []);

  return accent;
}
