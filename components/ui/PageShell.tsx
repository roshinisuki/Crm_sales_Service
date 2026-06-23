import React from "react";
import { cn } from "@/lib/ui-utils";

interface PageShellProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  breadcrumb?: { label: string; href?: string }[];
  children: React.ReactNode;
  className?: string;
}

export function PageShell({ title, subtitle, action, breadcrumb, children, className }: PageShellProps) {
  return (
    <div className={cn("page-shell", className)}>
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          {breadcrumb && breadcrumb.length > 0 && (
            <nav className="flex items-center gap-1.5 mb-1.5">
              {breadcrumb.map((item, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="text-slate-300 text-xs">/</span>}
                  {item.href ? (
                    <a href={item.href} className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors">
                      {item.label}
                    </a>
                  ) : (
                    <span className="text-xs font-medium text-slate-500">{item.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-none">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 font-medium mt-1">{subtitle}</p>}
        </div>
        {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}
