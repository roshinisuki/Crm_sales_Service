"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/ui-utils";

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  variant?: "default" | "ghost" | "accent";
}

export function CollapsibleSection({
  title,
  subtitle,
  icon,
  badge,
  actions,
  children,
  defaultOpen = true,
  open: controlledOpen,
  onToggle,
  className,
  headerClassName,
  bodyClassName,
  variant = "default",
}: CollapsibleSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const bodyRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<string>(isOpen ? "none" : "0px");

  const toggle = useCallback(() => {
    const next = !isOpen;
    if (controlledOpen === undefined) setInternalOpen(next);
    onToggle?.(next);
  }, [isOpen, controlledOpen, onToggle]);

  // Measure and set max-height for smooth animation
  useEffect(() => {
    if (!bodyRef.current) return;
    if (isOpen) {
      const scrollH = bodyRef.current.scrollHeight;
      setMaxHeight(`${scrollH}px`);
      // After transition, set to none so content can grow freely
      const timer = setTimeout(() => setMaxHeight("none"), 320);
      return () => clearTimeout(timer);
    } else {
      // First set to current height, then to 0 for smooth collapse
      const scrollH = bodyRef.current.scrollHeight;
      setMaxHeight(`${scrollH}px`);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setMaxHeight("0px"));
      });
    }
  }, [isOpen]);

  const variantStyles = {
    default: "crm-card overflow-hidden",
    ghost: "overflow-hidden",
    accent: "rounded-2xl border border-[var(--primary)]/15 bg-gradient-to-br from-[var(--primary)]/[0.03] via-transparent to-transparent overflow-hidden",
  };

  const headerVariantStyles = {
    default: "px-5 py-3.5 bg-[var(--surface)] hover:bg-[var(--surface-2)]",
    ghost: "px-0 py-2 hover:bg-transparent",
    accent: "px-5 py-3.5 hover:bg-[var(--primary)]/[0.04]",
  };

  return (
    <div className={cn(variantStyles[variant], className)}>
      <div
        className={cn(
          "w-full flex items-center justify-between gap-3 transition-colors duration-150 group",
          headerVariantStyles[variant],
          headerClassName
        )}
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isOpen}
          className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
        >
          {icon && (
            <span className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--surface-2)] text-[var(--text-secondary)] group-hover:text-[var(--primary)] transition-colors">
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1 text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-semibold text-[var(--text-primary)] truncate tracking-tight">
                {title}
              </h3>
              {badge}
            </div>
            {subtitle && (
              <p className="text-[11.5px] text-[var(--text-tertiary)] mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          <button
            type="button"
            onClick={toggle}
            aria-expanded={isOpen}
            className="flex items-center justify-center w-6 h-6 rounded-md text-[var(--text-tertiary)] transition-all duration-300"
          >
            <span
              className={cn(
                "flex items-center justify-center transition-all duration-300",
                isOpen ? "rotate-180" : "rotate-0"
              )}
            >
              <ChevronDown size={16} />
            </span>
          </button>
        </div>
      </div>

      <div
        ref={bodyRef}
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight }}
      >
        <div className={cn(variant === "ghost" ? "" : "px-5 pb-5 pt-1", bodyClassName)}>
          {isOpen && <div className="collapsible-body-enter">{children}</div>}
          {!isOpen && children}
        </div>
      </div>
    </div>
  );
}
