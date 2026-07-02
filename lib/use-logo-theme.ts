"use client";

import { useState, useEffect } from "react";

export type LogoTheme = "orange" | "blue" | "green" | "purple" | "dark" | "neutral";

/**
 * Maps a raw data-theme color key + dark-mode flag to a LogoTheme.
 * Handles both original Prisma names (ember/ocean/forest/obsidian)
 * and any renamed variants.
 */
export function getLogoTheme(colorKey: string, _isDark: boolean): LogoTheme {
  // Never override the accent color in dark mode.
  // The sidebar background is always dark — orange/blue/green/purple stays visible.
  // theme="dark" (all-white logo) is only used explicitly on the login page.
  if (colorKey === "obsidian" || colorKey === "neutral") return "dark";
  if (colorKey === "purple" || colorKey === "black")    return "purple";
  if (colorKey === "forest"   || colorKey === "green")   return "green";
  if (colorKey === "ember"    || colorKey === "orange")  return "orange";
  if (colorKey === "ocean"    || colorKey === "blue")    return "blue";
  return "blue"; // fallback
}

/**
 * Parses the current `data-theme` attribute from <html> into a LogoTheme.
 * Format: "{color}-{mode}", e.g. "ember-light", "forest-dark".
 */
function readFromDOM(): LogoTheme {
  if (typeof window === "undefined") return "blue";
  // New system: separate data-theme attribute (e.g. "orange", "blue")
  const attr = document.documentElement.getAttribute("data-theme") ?? "blue";
  // Could be new format ("orange") or legacy ("ember-light")
  const sep = attr.lastIndexOf("-");
  const color = sep > 0 ? attr.slice(0, sep) : attr;
  const mode  = sep > 0 ? attr.slice(sep + 1) : "light";
  // Also check data-mode attribute (new system)
  const modeAttr = document.documentElement.getAttribute("data-mode");
  const isDark = modeAttr === "dark" || mode === "dark";
  return getLogoTheme(color, isDark);
}

/**
 * Reactively derives the logo theme by watching the `data-theme` attribute
 * on <html> via MutationObserver. Updates instantly on every call to
 * DashboardHeader's changeTheme() or toggleMode() — no custom events needed.
 *
 * Optional opts allow providing server-side initial values to prevent
 * a hydration flash before the first DOM read.
 */
export function useLogoTheme(opts?: {
  initialColor?: string;
  initialIsDark?: boolean;
}): LogoTheme {
  const [logoTheme, setLogoTheme] = useState<LogoTheme>(() => {
    if (typeof window !== "undefined") return readFromDOM();
    if (opts?.initialColor) return getLogoTheme(opts.initialColor, opts?.initialIsDark ?? false);
    return "blue";
  });

  useEffect(() => {
    // Sync immediately (handles hydration drift between SSR and live DOM)
    setLogoTheme(readFromDOM());

    // Layer 1 — MutationObserver: fires on data-theme change (changeTheme / toggleMode direct setAttribute)
    //            also watches class so classList.add("dark") triggers a re-read as a fallback
    const mo = new MutationObserver(() => setLogoTheme(readFromDOM()));
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-mode", "class"],
    });

    // Layer 2 — Custom event: explicit notification dispatched by DashboardHeader
    //            covers edge cases where the DOM mutation fires before React commits
    const onThemeChange = (e: Event) => {
      const detail = (e as CustomEvent<{ theme: string; mode: string; color: string; isDark: boolean }>).detail;
      if (detail?.theme) {
        setLogoTheme(getLogoTheme(detail.theme, detail.mode === "dark"));
      } else if (detail?.color) {
        setLogoTheme(getLogoTheme(detail.color, !!detail.isDark));
      }
    };
    window.addEventListener("suki-theme-change", onThemeChange);
    // Also listen to legacy event for backward compat
    window.addEventListener("crm-theme-change", onThemeChange);

    return () => {
      mo.disconnect();
      window.removeEventListener("suki-theme-change", onThemeChange);
      window.removeEventListener("crm-theme-change", onThemeChange);
    };
  }, []);

  return logoTheme;
}
