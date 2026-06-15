import React from "react";
import { cn } from "@/lib/ui-utils";

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ label, required, error, hint, children, className }: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="form-label">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="form-error">{error}</p>}
      {hint && !error && <p className="text-[11px] text-slate-400 font-medium">{hint}</p>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Primitive input/select wrappers for consistent styling

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn("input-field", className)}
      {...props}
    />
  );
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

export function Textarea({ className, ...props }: TextAreaProps) {
  return (
    <textarea
      className={cn("input-field resize-none", className)}
      {...props}
    />
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  className?: string;
  children: React.ReactNode;
}

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn("select-field", className)}
      {...props}
    >
      {children}
    </select>
  );
}
