"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, X, ArrowRight } from "lucide-react";

export interface SuccessAction {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export interface SuccessOverlayProps {
  open: boolean;
  title?: string;
  message: string;
  primary: SuccessAction;
  secondary?: SuccessAction;
  alternate?: SuccessAction;
  onClose?: () => void;
}

export function SuccessOverlay({
  open,
  title = "Success!",
  message,
  primary,
  secondary,
  alternate,
  onClose,
}: SuccessOverlayProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [open]);

  if (!open) return null;

  const handleNavigate = (action: SuccessAction) => {
    setVisible(false);
    if (onClose) onClose();
    if (action.onClick) {
      action.onClick();
    } else if (action.href) {
      router.push(action.href);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`bg-white dark:bg-[var(--surface)] rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 transition-all duration-300 ${
          visible ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
        }`}
      >
        {/* Close icon */}
        {onClose && (
          <button
            onClick={() => { setVisible(false); onClose(); }}
            className="absolute top-4 right-4 text-slate-400 dark:text-[var(--text-secondary)] hover:text-slate-600 dark:hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={20} />
          </button>
        )}

        {/* Success icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 size={36} className="text-emerald-600" />
          </div>
        </div>

        {/* Title + message */}
        <h2 className="text-xl font-bold text-slate-800 dark:text-[var(--text-primary)] text-center mb-2">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-[var(--text-secondary)] text-center mb-6">{message}</p>

        {/* Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => handleNavigate(primary)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--primary)] text-white font-semibold text-sm hover:opacity-90 transition-opacity min-h-[48px]"
          >
            {primary.icon || <ArrowRight size={16} />}
            {primary.label}
          </button>

          {secondary && (
            <button
              onClick={() => handleNavigate(secondary)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-[var(--border)] text-slate-600 dark:text-[var(--text-secondary)] font-semibold text-sm hover:bg-slate-50 dark:hover:bg-[var(--surface-2)] transition-colors"
            >
              {secondary.label}
            </button>
          )}

          {alternate && (
            <button
              onClick={() => handleNavigate(alternate)}
              className="w-full text-center text-xs text-slate-400 dark:text-[var(--text-muted)] hover:text-slate-600 dark:hover:text-[var(--text-primary)] transition-colors pt-1"
            >
              {alternate.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
