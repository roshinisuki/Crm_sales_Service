"use client";

import { useState, useEffect } from "react";

export const THEME_ACCENTS = {
  orange: "#FF680B",
  blue:   "#009FFD",
  green:  "#95C926",
  dark:   "#FFFFFF",
} as const;

export type ThemeAccentKey = keyof typeof THEME_ACCENTS;

function colorKeyToAccent(colorKey: string): ThemeAccentKey {
  if (colorKey === "forest" || colorKey === "green")   return "green";
  if (colorKey === "ocean"  || colorKey === "blue")    return "blue";
  if (colorKey === "obsidian" || colorKey === "neutral" || colorKey === "dark") return "dark";
  return "orange";
}

function readAccentFromDOM(): ThemeAccentKey {
  if (typeof window === "undefined") return "orange";
  const attr = document.documentElement.getAttribute("data-theme") ?? "ember-light";
  const sep   = attr.lastIndexOf("-");
  const color = sep > 0 ? attr.slice(0, sep) : attr;
  return colorKeyToAccent(color);
}

export function useThemeAccent(): string {
  const [accent, setAccent] = useState<string>(() => {
    if (typeof window !== "undefined") return THEME_ACCENTS[readAccentFromDOM()];
    return THEME_ACCENTS.orange;
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
    window.addEventListener("crm-theme-change", onThemeChange);

    return () => {
      mo.disconnect();
      window.removeEventListener("crm-theme-change", onThemeChange);
    };
  }, []);

  return accent;
}
