"use client";

import React from "react";
import { cn } from "@/lib/ui-utils";

/* ──────────────────────────────────────────────────────────────────────────────
   CompactFormContainer — max-width wrapper for create/edit forms
   Prevents forms from stretching edge-to-edge on wide screens.
   ────────────────────────────────────────────────────────────────────────────── */
interface CompactFormContainerProps {
  children: React.ReactNode;
  className?: string;
  /** "narrow" for simple forms, "normal" for standard, "wide" for forms with tables/line items */
  width?: "narrow" | "normal" | "wide";
}

export function CompactFormContainer({
  children,
  className,
  width = "normal",
}: CompactFormContainerProps) {
  const widthMap = {
    narrow: "max-w-2xl",
    normal: "max-w-4xl",
    wide: "max-w-5xl",
  };
  return (
    <div className={cn("mx-auto w-full", widthMap[width], className)}>
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   FormSection — card-like container for grouping form fields
   Provides consistent border, padding, background, and optional title.
   ────────────────────────────────────────────────────────────────────────────── */
interface FormSectionProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function FormSection({
  title,
  description,
  icon,
  actions,
  children,
  className,
  bodyClassName,
}: FormSectionProps) {
  return (
    <div className={cn("form-section", className)}>
      {(title || actions) && (
        <div className="form-section-header">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <span className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--surface-2)] text-[var(--text-secondary)]">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h3 className="text-[13px] font-semibold text-[var(--text-primary)] tracking-tight">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-[11.5px] text-[var(--text-tertiary)] mt-0.5">
                  {description}
                </p>
              )}
            </div>
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      <div className={cn("form-section-body", bodyClassName)}>
        {children}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   FormGrid — responsive 2-column grid for form fields
   Collapses to 1 column on mobile.
   ────────────────────────────────────────────────────────────────────────────── */
interface FormGridProps {
  children: React.ReactNode;
  className?: string;
  /** Number of columns on desktop. Default 2. */
  cols?: 2 | 3;
}

export function FormGrid({ children, className, cols = 2 }: FormGridProps) {
  const colsMap = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
  };
  return (
    <div className={cn("grid grid-cols-1 gap-x-5 gap-y-4", colsMap[cols], className)}>
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   FormActions — footer with aligned action buttons
   ────────────────────────────────────────────────────────────────────────────── */
interface FormActionsProps {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}

export function FormActions({
  children,
  className,
  align = "right",
}: FormActionsProps) {
  const alignMap = {
    left: "justify-start",
    right: "justify-end",
    center: "justify-center",
  };
  return (
    <div className={cn("form-actions", alignMap[align], className)}>
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   FormButton — standardized button for form submit/cancel
   ────────────────────────────────────────────────────────────────────────────── */
interface FormButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md";
}

export function FormButton({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: FormButtonProps) {
  const variantMap = {
    primary:
      "form-btn-primary",
    secondary:
      "form-btn-secondary",
    danger:
      "form-btn-danger",
  };
  const sizeMap = {
    sm: "px-2.5 py-1 text-xs rounded-md",
    md: "",
  };
  return (
    <button
      className={cn("form-btn", variantMap[variant], sizeMap[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}
