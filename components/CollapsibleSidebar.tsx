"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/ui-utils";
import Logo from "@/components/Logo";
import { useLogoTheme } from "@/lib/use-logo-theme";
import {
  LayoutDashboard,
  Users,
  Activity,
  ContactRound,
  ListTodo,
  MapPin,
  Briefcase,
  TrendingUp,
  LineChart,
  BookUser,
  PieChart,
  Settings,
  ChevronLeft,
  ChevronRight,
  Building2,
  ShieldCheck,
  CheckSquare,
  Menu,
  X,
  Package,
  FolderTree,
  SlidersHorizontal,
  FileText,
  BookOpen,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
  badge?: number;
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

interface CollapsibleSidebarProps {
  user?: any;
  loading?: boolean;
  onLogout?: () => void;
}

export default function CollapsibleSidebar({ user, loading, onLogout }: CollapsibleSidebarProps) {
  const pathname = usePathname();
  const logoTheme = useLogoTheme({ initialColor: user?.theme, initialIsDark: user?.themeMode === "dark" });
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar-collapsed") === "true";
  });
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  const toggleCollapse = () => setCollapsed(!collapsed);

  const isActive = (item: NavItem) =>
    item.end ? pathname === item.href : pathname.startsWith(item.href);

  // Navigation items
  const mainNavItems: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={20} />, end: true },
    { href: "/overview", label: "Overview", icon: <PieChart size={20} />, end: true },
    { href: "/notifications", label: "Notifications", icon: <Activity size={20} />, end: true, badge: 10 },
    { href: "/analytics", label: "Analytics", icon: <LineChart size={20} />, end: true },
    { href: "/saved-reports", label: "Saved Reports", icon: <Settings size={20} />, end: true },
  ];

  const secondaryNavItems: NavItem[] = [
    { href: "/orders", label: "Orders", icon: <Briefcase size={20} />, end: true },
    { href: "/user-reports", label: "User Reports", icon: <Users size={20} />, end: true },
    { href: "/manage-notifications", label: "Manage Notifications", icon: <Settings size={20} />, end: true },
  ];

  const catalogueNavItems: NavItem[] = [
    { href: "/catalogue/categories", label: "Categories", icon: <FolderTree size={20} /> },
    { href: "/catalogue/products", label: "Products", icon: <Package size={20} /> },
    { href: "/catalogue/specifications", label: "Specifications", icon: <SlidersHorizontal size={20} /> },
    { href: "/catalogue/datasheets", label: "Datasheets", icon: <FileText size={20} /> },
    { href: "/catalogue/brochures", label: "Brochures", icon: <BookOpen size={20} /> },
  ];

  const settingsNavItems: NavItem[] = [
    { href: "/settings", label: "Settings", icon: <Settings size={20} />, end: true },
  ];

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        "flex flex-col h-full border-r border-white/[0.08] transition-all duration-300 ease-in-out",
        collapsed ? "w-[72px]" : "w-[220px]"
      )}
      style={{
        background: "linear-gradient(170deg, #13182E 0%, #0C1020 50%, #080C18 100%)",
        boxShadow: "4px 0 32px rgba(0,0,0,0.45), inset -1px 0 0 rgba(255,255,255,0.05)"
      }}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Logo Section */}
      <div
        className={cn(
          "flex items-center justify-center border-b border-white/[0.06] relative",
          collapsed ? "px-2 pt-6 pb-5" : "px-4 pt-6 pb-5"
        )}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-6 h-6 flex items-center justify-center shrink-0 rounded-lg">
            <Logo theme={logoTheme} variant="mark-only" size={24} />
          </div>
          {!collapsed && (
            <div className="overflow-hidden whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-200">
              <p className="text-white text-[18px] font-bold leading-none tracking-[-0.3px] whitespace-nowrap">SUKI CRM</p>
            </div>
          )}
        </div>
        <button
          onClick={toggleCollapse}
          className={cn(
            "absolute right-2 flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200",
            "text-white/60 hover:text-white hover:bg-white/[0.1]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 focus:ring-offset-[var(--sidebar-bg)]"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={collapsed}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Main Navigation */}
        <div className="space-y-1">
          {!collapsed && (
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2 animate-in fade-in slide-in-from-left-2 duration-200" style={{ color: "var(--sidebar-heading)" }}>
              Main
            </p>
          )}
          {mainNavItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item)}
              collapsed={collapsed}
              onHover={setHoveredItem}
            />
          ))}
        </div>

        {/* Secondary Navigation */}
        <div className="space-y-1">
          {!collapsed && (
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2 animate-in fade-in slide-in-from-left-2 duration-200" style={{ color: "var(--sidebar-heading)" }}>
              Management
            </p>
          )}
          {secondaryNavItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item)}
              collapsed={collapsed}
              onHover={setHoveredItem}
            />
          ))}
        </div>

        {/* Product Catalogue */}
        <div className="space-y-1">
          {!collapsed && (
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2 animate-in fade-in slide-in-from-left-2 duration-200" style={{ color: "var(--sidebar-heading)" }}>
              Product Catalogue
            </p>
          )}
          {catalogueNavItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item)}
              collapsed={collapsed}
              onHover={setHoveredItem}
            />
          ))}
        </div>

        {/* Settings */}
        <div className="space-y-1 pt-4 border-t border-white/[0.06]">
          {settingsNavItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item)}
              collapsed={collapsed}
              onHover={setHoveredItem}
            />
          ))}
        </div>
      </nav>

    </aside>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  onHover,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onHover: (label: string | null) => void;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200",
        active
          ? "text-white font-semibold"
          : "",
        collapsed ? "justify-center" : ""
      )}
      style={active ? { background: "var(--sidebar-active-bg)", color: "var(--sidebar-text-act)" } : { color: "var(--sidebar-text)" }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.color = "var(--sidebar-text-act)"; e.currentTarget.style.background = "var(--sidebar-hover)"; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.color = "var(--sidebar-text)"; e.currentTarget.style.background = "transparent"; } }}
      title={collapsed ? item.label : undefined}
    >
      {/* Active indicator */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ background: "var(--sidebar-text-act)" }} />
      )}

      {/* Icon */}
      <span
        className={cn(
          "shrink-0 transition-colors",
        )}
        style={{ color: active ? "var(--sidebar-text-act)" : "var(--sidebar-heading)" }}
      >
        {item.icon}
      </span>

      {/* Label */}
      {!collapsed && (
        <span className="whitespace-nowrap overflow-hidden animate-in fade-in slide-in-from-left-2 duration-200">
          {item.label}
        </span>
      )}

      {/* Badge */}
      {item.badge && !collapsed && (
        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center animate-in fade-in zoom-in-50 duration-200">
          {item.badge}
        </span>
      )}

      {/* Tooltip for collapsed state */}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 animate-in fade-in slide-in-from-left-1 duration-200">
          {item.label}
        </div>
      )}
    </Link>
  );
}
