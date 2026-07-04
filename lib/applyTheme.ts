import { type ThemeName, type ThemeMode } from "./theme";
import { setThemeCookies } from "./theme-cookies";

export function applyTheme(t: ThemeName, m: ThemeMode) {
  if (typeof window === "undefined") return;
  console.log("[applyTheme] setting DOM attributes", { theme: t, mode: m });
  document.documentElement.setAttribute("data-theme", t);
  document.documentElement.setAttribute("data-mode", m);
  if (m === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  // Local cookie fallback so the login page can render the same theme after logout.
  // DB remains the authoritative source for signed-in users.
  setThemeCookies(t, m);
  window.dispatchEvent(
    new CustomEvent("suki-theme-change", { detail: { theme: t, mode: m } })
  );
}

/** Clear the local cookie fallback and legacy localStorage cache. */
export function clearStoredTheme() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("suki-theme");
    localStorage.removeItem("suki-mode");
  } catch {
    // ignore private-mode / disabled localStorage
  }
  // Note: we do NOT clear theme cookies here because the user wants the theme
  // to persist across logout. Call clearThemeCookies() explicitly if needed.
}
