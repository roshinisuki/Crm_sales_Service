import { type ThemeName, type ThemeMode } from "./theme";

export function applyTheme(t: ThemeName, m: ThemeMode) {
  if (typeof window === "undefined") return;
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
}
