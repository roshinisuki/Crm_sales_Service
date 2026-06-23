"use client";
import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/ui-utils";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  headerColor?: string;
  className?: string;
}

const sizeMap = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
  headerColor = "from-orange-50 to-white",
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          "relative bg-white dark:bg-[var(--surface)] rounded-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in",
          sizeMap[size],
          className,
        )}
      >
        {/* Header */}
        <div className={cn("px-6 py-4 border-b border-slate-100 dark:border-[var(--border)] bg-gradient-to-r shrink-0 flex items-center justify-between", headerColor)}>
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-[var(--text-primary)]">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 dark:text-[var(--text-secondary)] mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/80 dark:bg-[var(--surface-2)] border border-slate-200 dark:border-[var(--border)] flex items-center justify-center text-slate-400 dark:text-[var(--text-secondary)] hover:text-slate-700 dark:hover:text-[var(--text-primary)] hover:bg-white dark:hover:bg-[var(--surface-offset)] transition-all flex-shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-[var(--border)] bg-slate-50/60 dark:bg-[var(--surface-2)] flex items-center justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
