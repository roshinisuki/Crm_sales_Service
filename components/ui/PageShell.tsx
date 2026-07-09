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
  const cleanTitle = title.toLowerCase().endsWith("overview") ? "Overview" : title;
  const cleanBreadcrumb = breadcrumb?.map((item) => ({
    ...item,
    label: item.label.toLowerCase().endsWith("overview") ? "Overview" : item.label,
  }));

  return (
    <div className={cn("page-shell", className)}>
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          {cleanBreadcrumb && cleanBreadcrumb.length > 0 && (
            <nav className="flex items-center gap-1.5 mb-1.5">
              {cleanBreadcrumb.map((item, i) => (
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
          <h1 className="tracking-tight leading-none" style={{ fontSize: "22px", fontWeight: 500, color: "var(--text-primary)" }}>{cleanTitle}</h1>
          {subtitle && <p className="mt-1" style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{subtitle}</p>}
        </div>
        {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}
