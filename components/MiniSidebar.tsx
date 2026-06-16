"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/ui-utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
};

type SubMenuItem = {
  href: string;
  label: string;
};

type NavSection = {
  label: string;
  icon: React.ReactNode;
  subItems: SubMenuItem[];
};

interface MiniSidebarProps {
  /** Navigation items (flat links) */
  items?: NavItem[];
  /** Navigation sections (with expandable submenus) */
  sections?: NavSection[];
  /** Sidebar header content */
  brand?: React.ReactNode;
  /** Footer content (user profile, etc.) */
  footer?: React.ReactNode;
  /** Additional className for the aside */
  className?: string;
  /** Callback when collapse state changes */
  onCollapseChange?: (collapsed: boolean) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MiniSidebar({
  items = [],
  sections = [],
  brand,
  footer,
  className,
  onCollapseChange,
}: MiniSidebarProps) {
  const pathname = usePathname();

  // Initialize from localStorage (SSR-safe)
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar-collapsed") === "true";
  });

  // Persist to localStorage whenever changed
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
    onCollapseChange?.(collapsed);
  }, [collapsed, onCollapseChange]);

  const toggle = () => setCollapsed((c) => !c);

  const isActive = (item: NavItem) =>
    item.end ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <aside
      className={cn(
        "sidebar-container flex flex-col h-full shrink-0",
        "transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        collapsed ? "w-[72px] collapsed" : "w-[240px]",
        className
      )}
      style={{ background: "var(--sidebar-bg)" }}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* ── Toggle + Brand ── */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          {brand}
        </div>
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "sidebar-toggle flex items-center justify-center w-8 h-8 rounded-lg",
            "text-white/60 hover:text-white hover:bg-white/[0.1]",
            "transition-colors duration-200"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          )}
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
        {/* Flat nav items */}
        {items.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(item)}
            collapsed={collapsed}
          />
        ))}

        {/* Expandable sections */}
        {sections.map((section) => (
          <ExpandableSection
            key={section.label}
            section={section}
            pathname={pathname}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* ── Footer ── */}
      {footer && (
        <div className="shrink-0 px-3 py-4 border-t border-white/[0.06]">
          {footer}
        </div>
      )}
    </aside>
  );
}

// ─── NavLink (flat item) ─────────────────────────────────────────────────────

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl",
        "text-[13.5px] font-medium transition-all duration-150",
        active
          ? "bg-[var(--sidebar-active-bg)] text-white font-semibold"
          : "text-white/70 hover:text-white hover:bg-white/[0.06]",
        collapsed && "justify-center px-2"
      )}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
    >
      {/* Active indicator strip */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[var(--primary)] rounded-r-full" />
      )}

      {/* Icon */}
      <span
        className={cn(
          "nav-icon shrink-0 transition-colors duration-150",
          active ? "text-[var(--primary)]" : "text-white/70 group-hover:text-white"
        )}
      >
        {item.icon}
      </span>

      {/* Label */}
      <span
        className={cn(
          "nav-label whitespace-nowrap overflow-hidden",
          "transition-[opacity,width] duration-200 ease-out"
        )}
      >
        {item.label}
      </span>

      {/* Tooltip (visible only when collapsed) */}
      {collapsed && (
        <span className="sidebar-tooltip">{item.label}</span>
      )}
    </Link>
  );
}

// ─── ExpandableSection (with submenu) ──────────────────────────────────────────

function ExpandableSection({
  section,
  pathname,
  collapsed,
}: {
  section: NavSection;
  pathname: string;
  collapsed: boolean;
}) {
  const isSectionActive = section.subItems.some((sub) =>
    pathname.startsWith(sub.href.split("?")[0])
  );
  const [isOpen, setIsOpen] = useState(isSectionActive);

  useEffect(() => {
    if (isSectionActive) setIsOpen(true);
  }, [isSectionActive]);

  // When collapsed, show as hover overlay instead of inline expand
  if (collapsed) {
    return (
      <div className="group relative">
        <button
          type="button"
          className={cn(
            "w-full flex items-center justify-center px-2 py-2.5 rounded-xl",
            "text-white/70 hover:text-white hover:bg-white/[0.06]",
            "transition-all duration-150",
            isSectionActive && "bg-[var(--sidebar-active-bg)]/60"
          )}
          title={section.label}
          aria-label={section.label}
        >
          <span
            className={cn(
              "shrink-0",
              isSectionActive ? "text-[var(--primary)]" : "text-white/70"
            )}
          >
            {section.icon}
          </span>
          <span className="sidebar-tooltip">{section.label}</span>
        </button>

        {/* Hover overlay submenu */}
        <div className="absolute left-full top-0 ml-2 w-[200px] bg-[#1f2937] rounded-xl shadow-2xl border border-white/10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 py-2">
          <p className="px-3 py-2 text-[10px] font-bold text-white/40 uppercase tracking-widest border-b border-white/10 mb-1">
            {section.label}
          </p>
          {section.subItems.map((sub) => {
            const isActive = pathname.startsWith(sub.href.split("?")[0]);
            return (
              <Link
                key={sub.href}
                href={sub.href}
                className={cn(
                  "block px-3 py-2 text-[12.5px] font-medium transition-colors",
                  isActive
                    ? "text-[var(--primary)] font-semibold"
                    : "text-white/70 hover:text-white hover:bg-white/[0.06]"
                )}
              >
                {sub.label}
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  // Expanded: inline accordion
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2.5 rounded-xl",
          "text-[13.5px] font-medium text-white/70 hover:text-white hover:bg-white/[0.06]",
          "transition-all duration-150 group",
          isSectionActive && "bg-white/[0.04]"
        )}
      >
        <div className="flex items-center gap-3">
          <span className={cn("shrink-0", isSectionActive ? "text-[var(--primary)]" : "text-white/70")}>
            {section.icon}
          </span>
          <span className="nav-label whitespace-nowrap transition-all duration-300 overflow-hidden">
            {section.label}
          </span>
        </div>
        <span className="nav-label text-white/40 group-hover:text-white transition-colors overflow-hidden">
          {isOpen ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          )}
        </span>
      </button>

      {isOpen && (
        <div className="nav-label overflow-hidden pl-4 pr-1 py-1 space-y-1 border-l border-white/10 ml-5">
          {section.subItems.map((sub) => {
            const isActive = pathname.startsWith(sub.href.split("?")[0]);
            return (
              <Link
                key={sub.href}
                href={sub.href}
                className={cn(
                  "flex items-center py-1.5 px-2 rounded-lg text-[12.5px] font-medium transition-all duration-100",
                  isActive
                    ? "text-[var(--primary)] font-semibold bg-white/[0.04]"
                    : "text-white/70 hover:text-white hover:bg-white/[0.02]"
                )}
              >
                {sub.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
