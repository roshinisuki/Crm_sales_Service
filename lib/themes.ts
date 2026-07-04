/**
 * lib/themes.ts
 *
 * Theme metadata for UI rendering (labels, dot colours, button text).
 * This is NOT where CSS variables are defined — those live in styles/themes.css.
 * This file is used only for the confirmation dialog and the theme switcher dots.
 */

export type ThemeKey = "blue" | "green" | "purple" | "orange";

export interface ThemeMeta {
  label: string;
  /** Colour shown in the theme-switcher dot and the confirm dialog preview. */
  dot: string;
  /** Text colour for the "Switch to X" button in the confirm dialog. */
  buttonText: string;
}

export const THEMES: Record<ThemeKey, ThemeMeta> = {
  blue: {
    label: "Blue",
    dot: "#2090FF",
    buttonText: "#FFFFFF",
  },
  green: {
    label: "Green",
    dot: "#7f9e15",
    buttonText: "#234302",
  },
  purple: {
    label: "Purple",
    dot: "#CD69ED",
    buttonText: "#FFFFFF",
  },
  orange: {
    label: "Orange",
    dot: "#FF6901",
    buttonText: "#FFFFFF",
  },
};

export const DEFAULT_THEME: ThemeKey = "blue";
