"use client";

import { THEMES, ThemeKey } from "@/lib/themes";

interface Props {
  currentTheme: ThemeKey;
  pendingTheme: ThemeKey;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Displayed when the user clicks a new theme dot. Requires explicit confirmation. */
export function ThemeConfirmDialog({
  currentTheme,
  pendingTheme,
  onConfirm,
  onCancel,
}: Props) {
  const current = THEMES[currentTheme];
  const pending = THEMES[pendingTheme];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-dialog-title"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) onCancel();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          background: "var(--surface, #fff)",
          border: "1px solid var(--border, #E5E7EB)",
          borderRadius: 16,
          padding: "28px 32px",
          maxWidth: 380,
          width: "90%",
          textAlign: "center",
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
        }}
      >
        {/* Colour preview dots */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            marginBottom: 20,
          }}
        >
          {/* Current theme dot */}
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: current.dot,
                border: "3px solid var(--border, #E5E7EB)",
                margin: "0 auto 6px",
              }}
            />
            <span style={{ fontSize: 11, color: "var(--text-muted, #9CA3AF)" }}>
              Current
            </span>
          </div>

          {/* Arrow */}
          <span style={{ color: "var(--text-muted, #9CA3AF)", fontSize: 20 }}>→</span>

          {/* Pending theme dot */}
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: pending.dot,
                border: "3px solid var(--border, #E5E7EB)",
                margin: "0 auto 6px",
              }}
            />
            <span style={{ fontSize: 11, color: "var(--text-muted, #9CA3AF)" }}>
              New
            </span>
          </div>
        </div>

        <h2
          id="theme-dialog-title"
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: "var(--text-primary, #111827)",
            marginBottom: 8,
          }}
        >
          Switch theme?
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-secondary, #6B7280)",
            marginBottom: 24,
            lineHeight: 1.5,
          }}
        >
          Switch from{" "}
          <strong style={{ color: "var(--text-primary, #111827)" }}>
            {current.label}
          </strong>{" "}
          to{" "}
          <strong style={{ color: "var(--text-primary, #111827)" }}>
            {pending.label}
          </strong>
          ? This updates the colour scheme across the entire app.
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "9px 20px",
              borderRadius: 10,
              border: "1px solid var(--border, #D3D1C7)",
              background: "var(--surface-2, #F3F4F6)",
              color: "var(--text-primary, #111827)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "background 0.15s",
            }}
          >
            Keep {current.label}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "9px 20px",
              borderRadius: 10,
              border: "none",
              background: pending.dot,
              color: pending.buttonText,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "opacity 0.15s",
            }}
          >
            Switch to {pending.label}
          </button>
        </div>
      </div>
    </div>
  );
}
