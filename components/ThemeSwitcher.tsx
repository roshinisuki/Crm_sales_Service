"use client";

import { cn } from "@/lib/ui-utils";
import { useTheme, type ThemeName } from "@/lib/useTheme";
import { Sun, Moon } from "lucide-react";

const THEME_DOTS: { key: ThemeName; color: string; label: string }[] = [
  { key: "blue",   color: "#2090FF", label: "Blue" },
  { key: "green",  color: "#BBDD48", label: "Green" },
  { key: "purple", color: "#CD69ED", label: "Purple" },
  { key: "orange", color: "#FF6901", label: "Orange" },
];

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, mode, setTheme, toggleMode } = useTheme();

  return (
    <div className={cn("flex items-center gap-1.5 px-2 py-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg", className)}>
      {THEME_DOTS.map((dot) => (
        <button
          key={dot.key}
          onClick={() => setTheme(dot.key)}
          title={dot.label}
          className={cn(
            "w-3 h-3 rounded-full border transition-transform hover:scale-110",
            theme === dot.key ? "ring-2 ring-offset-1 ring-[var(--border)]" : ""
          )}
          style={{
            backgroundColor: dot.color,
            borderColor: "rgba(0,0,0,0.1)",
          }}
        />
      ))}
      <div className="w-px h-3 bg-slate-300 dark:bg-slate-700 mx-0.5" />
      <button
        onClick={toggleMode}
        title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-0.5 flex items-center"
      >
        {mode === "dark" ? <Moon size={11} /> : <Sun size={11} />}
      </button>
    </div>
  );
}
