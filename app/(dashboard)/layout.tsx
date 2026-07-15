"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { CurrencyProvider } from "@/components/CurrencyProvider";
import { logoutAction } from "@/app/actions/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import DashboardHeader from "@/components/DashboardHeader";
import MobileBottomNav from "@/components/MobileBottomNav";
import Logo from "@/components/Logo";
import { useLogoTheme } from "@/lib/use-logo-theme";
import { cn } from "@/lib/ui-utils";
import { getSettingsForVariant } from "@/lib/config/variantSettingsMap";
import {
  LayoutDashboard, Users, CalendarClock, Briefcase, BookUser,
  CheckSquare, Settings, LogOut, Menu, X, TrendingUp, Building,
  ChevronDown, ChevronUp, Building2, ShieldCheck, PieChart, Activity, ContactRound, ListTodo,
  Package, FileText, IndianRupee, MessageSquare, Clock, Target, Layers, MapPin, Search,
  Swords, Crown, Globe, Trophy, Wrench, ShieldAlert, Hammer, LifeBuoy, AlertTriangle, HelpCircle, Calendar,
  HardDrive, Award, ChartBar, Star
} from "lucide-react";

// ─── Nav definitions ─────────────────────────────────────────────────────────

type NavItem = { href: string; label: string; icon: React.ReactNode; end?: boolean };

// ─── NavLink ──────────────────────────────────────────────────────────────────

function NavLink({ item, active, onClick, collapsed }: { item: NavItem; active: boolean; onClick?: () => void; collapsed?: boolean }) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={cn(
        "relative rounded-lg font-medium transition-colors group",
        active && "font-semibold",
        collapsed ? "flex items-center justify-center px-2 py-2" : "flex items-center gap-3 px-3 py-2",
      )}
      style={{
        fontSize: collapsed ? undefined : "13.5px",
        color: active ? "var(--sidebar-text-act)" : "var(--sidebar-text)",
        background: active ? "var(--sidebar-active-bg)" : "transparent"
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.color = "var(--sidebar-text-act)"; e.currentTarget.style.background = "var(--sidebar-hover)"; e.currentTarget.style.borderLeft = "3px solid var(--brand-primary)"; e.currentTarget.style.paddingLeft = "10px"; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.color = "var(--sidebar-text)"; e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderLeft = ""; e.currentTarget.style.paddingLeft = ""; } }}
    >
      <span className={cn("transition-colors shrink-0")} style={{ color: active ? "var(--sidebar-text-act)" : "var(--sidebar-heading)" }}>
        {item.icon}
      </span>
      {!collapsed && <span className="whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>}
    </Link>
  );
}

// ─── Route matching helpers ──────────────────────────────────────────────────

function parseQuery(str?: string): Record<string, string> {
  if (!str) return {};
  const params = new URLSearchParams(str);
  const obj: Record<string, string> = {};
  params.forEach((val, key) => {
    obj[key.toLowerCase()] = val.toLowerCase();
  });
  return obj;
}

export function isBasePathActive(currentPath: string, targetHref: string): boolean {
  const targetPath = targetHref.split("?")[0].split("#")[0];
  const currentCleanPath = currentPath.split("?")[0].split("#")[0];

  const getSegments = (p: string) => p.split("/").filter(Boolean);
  const currentSegments = getSegments(currentCleanPath);
  const targetSegments = getSegments(targetPath);

  if (currentSegments.length === 0 || targetSegments.length === 0) {
    return false;
  }

  const parentSegmentsCount = ["admin", "settings", "customer", "reports", "service"].includes(targetSegments[0]) ? 2 : 1;

  for (let i = 0; i < parentSegmentsCount; i++) {
    if (targetSegments[i] !== currentSegments[i]) {
      return false;
    }
  }

  return true;
}

export function isRouteActive(
  currentPath: string,
  currentQueryString: string,
  targetHref: string,
  allSectionHrefs: string[]
): boolean {
  const currentCleanPath = currentPath.split("?")[0].split("#")[0];
  const currentQuery = parseQuery(currentQueryString);

  const getScore = (href: string) => {
    const [targetPath, targetQueryStr] = href.split("?");
    const targetCleanPath = targetPath.split("#")[0];

    const getSegments = (p: string) => p.split("/").filter(Boolean);
    const currentSegments = getSegments(currentCleanPath);
    const targetSegments = getSegments(targetCleanPath);

    // Calculate matching path segments
    let matchingSegments = 0;
    for (let i = 0; i < targetSegments.length; i++) {
      if (currentSegments[i] === targetSegments[i]) {
        matchingSegments++;
      } else {
        break;
      }
    }

    // Target path must match and be a prefix/exact match of the current path
    if (matchingSegments < targetSegments.length) {
      // Special case: sales-pipeline detail pages (/sales-pipeline/[id]/opportunity-detail)
      // should match sidebar items targeting /sales-pipeline/pipeline-list?stage=X
      // as long as the first segment matches and the stage query param matches.
      if (
        targetSegments[0] === "sales-pipeline" &&
        currentSegments[0] === "sales-pipeline" &&
        targetSegments.length >= 2 &&
        currentSegments.length >= 2
      ) {
        matchingSegments = 1; // first segment matches, treat as partial match
      } else {
        return -1;
      }
    }

    // Check if base path matches
    if (!isBasePathActive(currentCleanPath, targetCleanPath)) {
      return -1;
    }

    // Verify all query parameters of the target are present and match
    const targetQuery = parseQuery(targetQueryStr);
    let matchCount = 0;
    for (const [key, val] of Object.entries(targetQuery)) {
      if (currentQuery[key] !== val) {
        return -1;
      }
      matchCount++;
    }

    // Score combines path specificity (number of segments) and query matches
    return matchingSegments * 100 + matchCount;
  };

  const targetScore = getScore(targetHref);
  if (targetScore < 0) return false;

  // Find if there is any other href in this section with a higher score
  for (const siblingHref of allSectionHrefs) {
    if (siblingHref === targetHref) continue;
    const siblingScore = getScore(siblingHref);
    if (siblingScore > targetScore) {
      return false;
    }
  }

  return true;
}

// ─── ExpandableNavSection ─────────────────────────────────────────────────────

function ExpandableNavSection({
  label,
  icon,
  subItems,
  pathname,
  onNavClick,
  collapsed,
  isOpen,
  onToggle,
  onOpen,
}: {
  label: string;
  icon: React.ReactNode;
  subItems: { href?: string; label?: string; divider?: boolean }[];
  pathname: string;
  onNavClick?: () => void;
  collapsed?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const searchParams = useSearchParams();
  const searchString = searchParams ? searchParams.toString() : "";

  const allHrefs = subItems.map(item => item.href).filter((href): href is string => !!href);

  const isSubActive = (href: string): boolean => {
    return isRouteActive(pathname, searchString, href, allHrefs);
  };

  const isSectionActive = subItems.some((item) => {
    if (item.divider || !item.href) return false;
    return isBasePathActive(pathname, item.href);
  });

  useEffect(() => {
    if (isSectionActive) onOpen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSectionActive]);

  if (collapsed) {
    return (
      <div className="relative group">
        <button
          title={label}
          className="w-full flex items-center justify-center px-2 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{
            color: isSectionActive ? "var(--sidebar-text-act)" : "var(--sidebar-text)",
            background: isSectionActive ? "color-mix(in srgb, var(--brand-primary) 20%, transparent)" : "transparent"
          }}
          onMouseEnter={e => { e.currentTarget.style.background = isSectionActive ? "color-mix(in srgb, var(--brand-primary) 35%, transparent)" : "var(--sidebar-hover)"; if (!isSectionActive) { e.currentTarget.style.borderLeft = "3px solid var(--brand-primary)"; e.currentTarget.style.paddingLeft = "11px"; } }}
          onMouseLeave={e => { e.currentTarget.style.background = isSectionActive ? "color-mix(in srgb, var(--brand-primary) 20%, transparent)" : "transparent"; if (!isSectionActive) { e.currentTarget.style.borderLeft = ""; e.currentTarget.style.paddingLeft = ""; } }}
        >
          <span style={{ color: isSectionActive ? "var(--sidebar-active)" : "var(--sidebar-heading)" }}>{icon}</span>
        </button>
        <div className="absolute left-full top-0 ml-2 w-48 py-1.5 rounded-xl shadow-2xl border border-white/10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50"
             style={{ background: "var(--sidebar-bg)" }}>
          <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--sidebar-heading)" }}>{label}</p>
          {subItems.map((sub, idx) => {
            if (sub.divider || !sub.href) {
              return (
                <div key={`divider-${idx}`} className="my-2 border-t border-white/10 mx-3" />
              );
            }
            const href = sub.href;
            const isActive = isSubActive(href);
            return (
              <Link key={href} href={href} onClick={onNavClick}
                className="block px-3 py-1.5 text-[12px] rounded-md mx-1 transition-colors"
                style={{
                  color: isActive ? "var(--sidebar-text-act)" : "var(--sidebar-text)",
                  fontWeight: isActive ? 600 : 500,
                  background: isActive ? "var(--sidebar-active-bg)" : "transparent"
                }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = "var(--sidebar-text-act)"; e.currentTarget.style.background = "var(--sidebar-hover)"; e.currentTarget.style.borderLeft = "2px solid var(--brand-primary)"; e.currentTarget.style.paddingLeft = "11px"; } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = "var(--sidebar-text)"; e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderLeft = ""; e.currentTarget.style.paddingLeft = ""; } }}
              >
                <span className="whitespace-nowrap overflow-hidden text-ellipsis">{sub.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        onClick={() => onToggle()}
        className={cn(
          "w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg font-medium transition-colors group",
        )}
        style={{
          fontSize: collapsed ? undefined : "13.5px",
          color: isSectionActive ? "var(--sidebar-text-act)" : "var(--sidebar-text)",
          background: "transparent"
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "var(--sidebar-hover)"; e.currentTarget.style.borderLeft = "3px solid var(--brand-primary)"; e.currentTarget.style.paddingLeft = "11px"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderLeft = ""; e.currentTarget.style.paddingLeft = ""; }}
      >
        <div className="flex items-center gap-3">
          <span className={cn("transition-colors shrink-0")} style={{ color: isSectionActive ? "var(--sidebar-text-act)" : "var(--sidebar-heading)" }}>
            {icon}
          </span>
          <span className="whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>
        </div>
        <span className="transition-colors overflow-hidden shrink-0 min-w-[14px]" style={{ color: "var(--sidebar-heading)" }}>
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {isOpen && (
        <div className="overflow-hidden pl-4 pr-1 py-1 space-y-1 border-l border-white/10 ml-5">
          {subItems.map((sub, idx) => {
            if (sub.divider || !sub.href) {
              return (
                <div key={`divider-${idx}`} className="my-2 border-t border-white/10" />
              );
            }
            const href = sub.href;
            const isActive = isSubActive(href);
            return (
              <Link
                key={`${href}-${sub.label}`}
                href={href}
                onClick={onNavClick}
                className={cn(
                  "flex items-center py-1.5 px-2 rounded-md font-medium transition-colors",
                )}
                style={{
                  fontSize: "12.5px",
                  color: isActive ? "var(--sidebar-text-act)" : "var(--sidebar-text)",
                  fontWeight: isActive ? 600 : 500,
                  background: isActive ? "var(--sidebar-active-bg)" : "transparent"
                }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = "var(--sidebar-text-act)"; e.currentTarget.style.background = "var(--sidebar-hover)"; e.currentTarget.style.borderLeft = "2px solid var(--brand-primary)"; e.currentTarget.style.paddingLeft = "11px"; } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = "var(--sidebar-text)"; e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderLeft = ""; e.currentTarget.style.paddingLeft = ""; } }}
              >
                <span className="whitespace-nowrap overflow-hidden text-ellipsis">{sub.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar module search ───────────────────────────────────────────────────

function SidebarModuleSearch({
  user,
  activeVariant,
  collapsed,
  onNavigate,
}: {
  user: any;
  activeVariant: number;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showMore, setShowMore] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  
  // Recent pages (empty query state)
  const [recentPages, setRecentPages] = useState<any[]>([]);
  
  const localStorageKey = useMemo(() => {
    if (!user) return null;
    return user.id ? `recentPages_${user.id}` : (user.email ? `recentPages_${user.email}` : null);
  }, [user]);

  // Load recent pages from localStorage
  useEffect(() => {
    if (!localStorageKey) {
      setRecentPages([]);
      return;
    }
    try {
      const stored = localStorage.getItem(localStorageKey);
      if (stored) {
        setRecentPages(JSON.parse(stored));
      } else {
        setRecentPages([]);
      }
    } catch (err) {
      console.error('Failed to load recent pages:', err);
    }
  }, [localStorageKey]);

  // Track mobile viewport for responsive search
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Save recent pages to localStorage
  const addToRecentPages = (item: any) => {
    if (!localStorageKey) return;
    setRecentPages(prev => {
      const filtered = prev.filter(p => p.key !== item.key);
      const updated = [item, ...filtered].slice(0, 5);
      try {
        localStorage.setItem(localStorageKey, JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to save recent pages:', err);
      }
      return updated;
    });
  };

  // Keyboard shortcut (Cmd/Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setSelectedIndex(0);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch search results from server
  useEffect(() => {
    setShowMore(false);
    const fetchResults = async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      setError(false);

      try {
        const response = await fetch(`/api/navigation-search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.success) {
          setResults(data.data.items || []);
          setSelectedIndex(0);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Search error:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchResults, 200);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSelectedIndex(0);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);



  // Scroll selected item into view
  useEffect(() => {
    if (!open || !resultsRef.current) return;
    const selected = resultsRef.current.querySelector('[aria-selected="true"]') as HTMLElement;
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, open]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
        break;
      case 'Enter':
        e.preventDefault();
        const selected = results[selectedIndex];
        if (selected) {
          addToRecentPages(selected);
          window.location.href = selected.href;
          setQuery("");
          setOpen(false);
          onNavigate?.();
        }
        break;
    }
  };

  // Group results by parent module (preserving flat index for keyboard nav)
  const groupedResults = useMemo(() => {
    const groups: Record<string, { items: any[]; startIndex: number }> = {};
    let flatIndex = 0;
    
    results.forEach(item => {
      const parent = item.parentLabel || (item.type === 'setting' ? 'Settings' : 'Modules');
      if (!groups[parent]) {
        groups[parent] = { items: [], startIndex: flatIndex };
      }
      groups[parent].items.push({ ...item, flatIndex });
      flatIndex++;
    });

    return groups;
  }, [results]);

  // Highlight matched substring (with regex escaping for safety)
  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.replace(regex, '<mark style="background: rgba(255,255,255,0.2); color: inherit; padding: 0 2px; border-radius: 2px;">$1</mark>');
  };

  if (collapsed) return null;

  // Responsive: Full-screen search on mobile
  if (isMobile && open) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: "var(--sidebar-bg)" }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
          <Search size={20} style={{ color: "var(--sidebar-heading)" }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search modules..."
            aria-label="Search modules"
            aria-expanded={open}
            aria-controls="search-results"
            role="combobox"
            autoFocus
            className="flex-1 bg-transparent text-lg focus:outline-none"
            style={{ color: "var(--sidebar-text-act)" }}
          />
          <button
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            className="p-2 rounded-full hover:bg-white/10"
            style={{ color: "var(--sidebar-text-act)" }}
          >
            <X size={20} />
          </button>
        </div>
        <div
          ref={resultsRef}
          id="search-results"
          role="listbox"
          aria-label="Search results"
          className="flex-1 overflow-y-auto px-4 py-2"
        >
          {error ? (
            <div className="px-3 py-2 text-sm" style={{ color: "var(--sidebar-heading)" }}>
              Search failed. Please try again.
            </div>
          ) : loading ? (
            <div className="px-3 py-2 text-sm" style={{ color: "var(--sidebar-heading)" }}>
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm" style={{ color: "var(--sidebar-heading)" }}>
              No matching modules or pages found. Try a different keyword.
            </div>
          ) : (
            <>
              {Object.entries(groupedResults).map(([parent, group]) => (
                <div key={parent} className="mb-4">
                  <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--sidebar-heading)" }}>
                    {parent}
                  </div>
                  {group.items.map((item) => (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => {
                        setQuery("");
                        setOpen(false);
                        addToRecentPages(item);
                        onNavigate?.();
                      }}
                      role="option"
                      aria-selected={item.flatIndex === selectedIndex}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        item.flatIndex === selectedIndex ? 'bg-white/10' : 'hover:bg-white/5'
                      }`}
                      onMouseEnter={() => setSelectedIndex(item.flatIndex)}
                    >
                      <span className="text-xl shrink-0">{item.iconEmoji}</span>
                      <div className="flex-1 min-w-0">
                        <div 
                          className="text-base truncate font-medium" 
                          style={{ color: "var(--sidebar-text-act)" }}
                          dangerouslySetInnerHTML={{ __html: highlightMatch(item.label, query) }}
                        />
                        {item.parentLabel && item.parentLabel !== parent && (
                          <div className="text-sm truncate" style={{ color: "var(--sidebar-heading)" }}>{item.parentLabel}</div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ))}
              {results.length >= 20 && (
                <div className="px-3 py-2 text-xs text-center" style={{ color: "var(--sidebar-heading)" }}>
                  Showing 20 of {results.length} results
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative px-2.5 pt-2 pb-1">
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--sidebar-heading)" }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          placeholder="Search modules... (⌘K)"
          aria-label="Search modules"
          aria-expanded={open}
          aria-controls="search-results"
          role="combobox"
          className="w-full pl-7 pr-2.5 py-1.5 rounded-md text-[12.5px] border focus:outline-none transition-all"
          style={{
            background: "rgba(255,255,255,0.05)",
            borderColor: "rgba(255,255,255,0.10)",
            color: "var(--sidebar-text-act)",
          }}
        />
      </div>
      {open && (
        <div
          ref={resultsRef}
          id="search-results"
          role="listbox"
          aria-label="Search results"
          className="absolute left-2.5 right-2.5 top-full mt-0.5 rounded-lg border shadow-2xl z-50 max-h-80 overflow-y-auto"
          style={{ background: "var(--sidebar-bg)", borderColor: "rgba(255,255,255,0.10)" }}
        >
          {error ? (
            <div className="px-3 py-2 text-[11px]" style={{ color: "var(--sidebar-heading)" }}>
              Search failed. Please try again.
            </div>
          ) : loading ? (
            <div className="px-3 py-2 text-[11px]" style={{ color: "var(--sidebar-heading)" }}>
              Searching...
            </div>
          ) : results.length === 0 ? (
            query.trim().length >= 2 ? (
              <div className="px-3 py-2 text-[11px]" style={{ color: "var(--sidebar-heading)" }}>
                No matching modules or pages found. Try a different keyword.
              </div>
            ) : recentPages.length > 0 ? (
              <>
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--sidebar-heading)" }}>
                  Recent
                </div>
                {recentPages.map((item, idx) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => {
                      setQuery("");
                      setOpen(false);
                      addToRecentPages(item);
                      onNavigate?.();
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 transition-colors"
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--sidebar-hover)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <span className="text-sm shrink-0">{item.iconEmoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] truncate font-medium" style={{ color: "var(--sidebar-text-act)" }}>{item.label}</div>
                      {item.parentLabel ? (
                        <div className="text-[10px] truncate" style={{ color: "var(--sidebar-heading)" }}>{item.parentLabel}</div>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </>
            ) : (
              <div className="px-3 py-2 text-[11px]" style={{ color: "var(--sidebar-heading)" }}>
                Start typing to search modules...
              </div>
            )
          ) : (
            <>
              {Object.entries(groupedResults).map(([parent, group]) => (
                <div key={parent} className="mb-2">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--sidebar-heading)" }}>
                    {parent}
                  </div>
                  {group.items.slice(0, showMore ? undefined : 5).map((item) => (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => {
                        setQuery("");
                        setOpen(false);
                        addToRecentPages(item);
                        onNavigate?.();
                      }}
                      role="option"
                      aria-selected={item.flatIndex === selectedIndex}
                      className={`flex items-center gap-2 px-2.5 py-1.5 transition-colors ${
                        item.flatIndex === selectedIndex ? 'bg-white/10' : ''
                      }`}
                      onMouseEnter={() => setSelectedIndex(item.flatIndex)}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <span className="text-sm shrink-0">{item.iconEmoji}</span>
                      <div className="flex-1 min-w-0">
                        <div 
                          className="text-[12px] truncate font-medium" 
                          style={{ color: "var(--sidebar-text-act)" }}
                          dangerouslySetInnerHTML={{ __html: highlightMatch(item.label, query) }}
                        />
                        {item.parentLabel && item.parentLabel !== parent && (
                          <div className="text-[10px] truncate" style={{ color: "var(--sidebar-heading)" }}>{item.parentLabel}</div>
                        )}
                      </div>
                    </Link>
                  ))}
                  {group.items.length > 5 && !showMore && (
                    <button
                      onClick={() => setShowMore(true)}
                      className="w-full px-3 py-1.5 text-[11px] text-left hover:underline"
                      style={{ color: "var(--sidebar-text-act)" }}
                    >
                      Show {group.items.length - 5} more...
                    </button>
                  )}
                </div>
              ))}
              {results.length >= 20 && (
                <div className="px-3 py-1.5 text-[10px] text-center" style={{ color: "var(--sidebar-heading)" }}>
                  Showing 20 of {results.length} results
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CRM Toggle Component ────────────────────────────────────────────────────
export function CrmToggle({ className }: { className?: string }) {
  const pathname = usePathname();
  const isServiceWorkspace = pathname?.startsWith("/service");

  return (
    <div className={cn("relative flex items-center bg-black/40 dark:bg-white/5 border border-white/10 p-[3px] rounded-full select-none w-[220px]", className)}>
      {/* Sliding background */}
      <div
        className={cn(
          "absolute top-[3px] bottom-[3px] w-[107px] rounded-full transition-all duration-300 ease-out shadow-sm",
          isServiceWorkspace ? "left-[calc(50%+1px)]" : "left-[3px]"
        )}
        style={{ backgroundColor: "var(--primary)", boxShadow: "0 0 8px var(--primary-ring)" }}
      />
      
      {/* Sales CRM Link */}
      <Link
        href="/dashboard"
        className={cn(
          "flex-1 flex items-center justify-center gap-2 py-1 text-[10px] font-bold z-10 transition-colors duration-200",
          !isServiceWorkspace ? "text-white" : "text-white/40 hover:text-white/70"
        )}
      >
        <TrendingUp size={14} className="shrink-0" />
        <span>Sales CRM</span>
      </Link>

      {/* Service CRM Link */}
      <Link
        href="/service/dashboard/my"
        className={cn(
          "flex-1 flex items-center justify-center gap-2 py-1 text-[10px] font-bold z-10 transition-colors duration-200",
          isServiceWorkspace ? "text-white" : "text-white/40 hover:text-white/70"
        )}
      >
        <Wrench size={14} className="shrink-0" />
        <span>Service CRM</span>
      </Link>
    </div>
  );
}

// ─── Sidebar content ─────────────────────────────────────────────────────────

function SidebarContent({
  pathname,
  user,
  loading,
  handleLogout,
  onNavClick,
  collapsed,
}: {
  pathname: string;
  user: any;
  loading: boolean;
  handleLogout: () => void;
  onNavClick?: () => void;
  collapsed?: boolean;
}) {
  const logoTheme = useLogoTheme({ initialColor: user?.theme, initialIsDark: user?.themeMode === "dark" });
  const isVariant2 = (user?.variant || user?.company?.variant || 1) >= 2;
  const isVariant3 = (user?.variant || user?.company?.variant || 1) >= 3;
  const isVariant4 = (user?.variant || user?.company?.variant || 1) >= 4;
  const activeVariant: number = user?.variant || user?.company?.variant || 1;
  const isServiceWorkspace = pathname.startsWith("/service");

  const hasPerm = (moduleName: string) => {
    if (user?.permissions === 'ALL') return true;
    if (!user?.permissions) return true;
    const p = user?.permissions?.find((x: any) => x.module === moduleName);
    return p ? p.visible : true;
  };

  const serviceRequestSubItems = [
    { href: "/service/requests", label: "All Requests" },
    { href: "/service/requests?status=New", label: "New Requests" },
    { href: "/service/requests?status=Assigned", label: "Assigned Requests" },
    { href: "/service/requests?status=In Progress", label: "In Progress" },
    { href: "/service/requests?status=Pending Customer", label: "Pending Requests" },
    { href: "/service/requests?status=Closed", label: "Closed Requests" },
  ];

  const serviceComplaintSubItems = [
    { href: "/service/complaints", label: "All Complaints" },
    { href: "/service/complaints?status=New", label: "Open Complaints" },
    { href: "/service/complaints?status=Investigating", label: "Under Investigation" },
    { href: "/service/complaints?status=Resolved", label: "Resolved Complaints" },
    { href: "/service/complaints?status=Closed", label: "Closed Complaints" },
  ];

  const serviceDefectSubItems = [
    { href: "/service/defects", label: "All Defects" },
    { href: "/service/defects?status=New", label: "New Defects" },
    { href: "/service/defects?status=Under Investigation", label: "Under Investigation" },
    { href: "/service/defects?status=Corrective Action", label: "Corrective Action" },
    { href: "/service/defects?status=Closed", label: "Closed Defects" },
  ];

  const serviceInstallationSubItems = [
    { href: "/service/installations", label: "All Installations" },
    { href: "/service/installations?status=Scheduled", label: "Scheduled Installations" },
    { href: "/service/installations?status=In Progress", label: "In Progress" },
    { href: "/service/installations?status=Completed", label: "Completed Installations" },
  ];

  const serviceWarrantyAMCSubItems = [
    { href: "/service/warranty-amc?status=WarrantyActive", label: "Active Warranty" },
    { href: "/service/warranty-amc?status=Claim", label: "Warranty Claims" },
    { href: "/service/warranty-amc?status=AMCActive", label: "Active AMC" },
    { href: "/service/warranty-amc?status=Renewals", label: "AMC Renewals" },
  ];

  const serviceVisitSubItems = [
    { href: "/service/visits", label: "All Visits" },
    { href: "/service/visits?status=Scheduled", label: "Scheduled Visits" },
    { href: "/service/visits?status=Emergency", label: "Emergency Visits" },
    { href: "/service/visits?status=Completed", label: "Completed Visits" },
    { href: "/service/visits?status=Overdue", label: "Overdue Visits" },
  ];

  const serviceAssetSubItems = [
    { href: "/service/assets", label: "Installed Products" },
    { href: "/service/assets?status=Warranty", label: "Under Warranty" },
    { href: "/service/assets?status=AMC", label: "Under AMC" },
  ];

  const serviceReportSubItems = [
    { href: "/service/reports?report=requests", label: "Service Request Report" },
    { href: "/service/reports?report=complaints", label: "Complaint Report" },
    { href: "/service/reports?report=defects", label: "Defect Report" },
    { href: "/service/reports?report=installations", label: "Installation Report" },
    { href: "/service/reports?report=warranty", label: "Warranty & AMC Report" },
    { href: "/service/reports?report=engineer", label: "Engineer Performance Report" },
  ];

  const serviceSettingsSubItems = [
    { href: "/service/settings?tab=categories", label: "Service Categories" },
    { href: "/service/settings?tab=complaints", label: "Complaint Types" },
    { href: "/service/settings?tab=defects", label: "Defect Types" },
    { href: "/service/settings?tab=teams", label: "Service Teams" },
    { href: "/service/settings?tab=engineers", label: "Service Engineers" },
    { href: "/service/settings?tab=priorities", label: "Priority Levels" },
    { href: "/service/settings?tab=statuses", label: "Service Status" },
    { href: "/service/settings?tab=escalation-rules", label: "Escalation Rules" },
  ];

  // Accordion: only one section open at a time
  const [openSection, setOpenSection] = useState<string | null>(null);
  const makeToggle = (label: string) => () => setOpenSection(prev => prev === label ? null : label);
  const openSectionLabel = (label: string) => () => setOpenSection(label);

  const leadSubItems = isVariant2 ? [
    { href: "/leads", label: "Overview" },
    { href: "/leads?status=New", label: "New Leads" },
    { href: "/leads?status=TodayFollowUp", label: "Follow-Up Due" },
    { href: "/leads?status=TodaysFollowUp", label: "Today's Follow-up" },
    { href: "/leads?status=UpcomingFollowUp", label: "Upcoming Follow-up" },
    { href: "/leads?status=SQL", label: "SQL" },
    { href: "/leads?status=Overdue", label: "Overdue Leads" },
    { href: "/leads?status=Lost", label: "Lost Leads" },
    { href: "/leads?status=Duplicate", label: "Duplicate Leads" },
  ] : [
    { href: "/leads", label: "Overview" },
    { href: "/leads?status=New", label: "New Leads" },
    { href: "/leads?status=TodayFollowUp", label: "Follow-Up Due" },
    { href: "/leads?status=TodaysFollowUp", label: "Today's Follow-up" },
    { href: "/leads?status=UpcomingFollowUp", label: "Upcoming Follow-up" },
    { href: "/leads?status=Lost", label: "Lost Leads" },
  ];

  const accountsSubItems = isVariant2 ? [
    { href: "/customer-master", label: "Overview" },
    { href: "/customer-master?status=ActiveCustomer", label: "Active Accounts" },
    { href: "/customer-master?status=Prospect", label: "Prospect Accounts" },
    { href: "/customer-master?status=Inactive", label: "Inactive Accounts" },
  ] : [
    { href: "/customer-master", label: "Overview" },
    { href: "/customer-master?status=ActiveCustomer", label: "Active Accounts" },
  ];

  const contactsSubItems = isVariant2 ? [
    { href: "/contacts", label: "Overview" },
    { href: "/contacts?type=Technical", label: "Technical Contacts" },
    { href: "/contacts?type=Purchase", label: "Purchase Contacts" },
    { href: "/contacts?type=Finance", label: "Finance Contacts" },
    { href: "/contacts?type=Management", label: "Management Contacts" },
  ] : [
    { href: "/contacts", label: "Overview" },
  ];

  const activitySubItems = isVariant2 ? [
    { href: "/activities", label: "Overview" },
    { href: "/activities?type=Call", label: "Calls" },
    { href: "/activities?type=Meeting", label: "Meetings" },
    { href: "/activities?type=Email", label: "Emails" },
    { href: "/activities?type=WhatsApp", label: "WhatsApp" },
    { href: "/activities?type=Note", label: "Notes" },
    { href: "/timeline", label: "Timeline" },
  ] : [
    { href: "/activities", label: "Overview" },
    { href: "/activities?type=Call", label: "Calls" },
    { href: "/activities?type=Meeting", label: "Meetings" },
    { href: "/activities?type=Email", label: "Emails" },
    { href: "/activities?type=Note", label: "Notes" },
  ];

  const taskSubItems = isVariant2 ? [
    { href: "/tasks", label: "Overview" },
    { href: "/tasks?status=Pending", label: "Pending" },
    { href: "/tasks?status=Completed", label: "Completed" },
    { href: "/tasks?status=Overdue", label: "Overdue" },
    { href: "/tasks?status=Cancelled", label: "Cancelled" },
  ] : [
    { href: "/tasks", label: "Overview" },
    { href: "/tasks?status=Pending", label: "Pending" },
    { href: "/tasks?status=Completed", label: "Completed" },
    { href: "/tasks?status=Overdue", label: "Overdue" },
  ];

  const followUpSubItems = isVariant2 ? [
    { href: "/follow-up", label: "Overview" },
    { href: "/follow-up?status=Pending", label: "Pending" },
    { href: "/follow-up?status=Completed", label: "Completed" },
    { href: "/follow-up?status=Overdue", label: "Overdue" },
    { href: "/follow-up?status=Cancelled", label: "Cancelled" },
  ] : [
    { href: "/follow-up", label: "Overview" },
    { href: "/follow-up?status=Pending", label: "Pending" },
    { href: "/follow-up?status=Completed", label: "Completed" },
    { href: "/follow-up?status=Overdue", label: "Overdue" },
  ];

  const salesPipelineSubItems = [
    { href: "/sales-pipeline/pipeline-list", label: "Overview" },
    { href: "/sales-pipeline/pipeline-list?stage=Qualified", label: "Qualified" },
    { href: "/sales-pipeline/pipeline-list?stage=RequirementGathering", label: "Requirement Gathering" },
    { href: "/sales-pipeline/pipeline-list?stage=TechnicalDiscussion", label: "Technical Discussion" },
    { href: "/sales-pipeline/pipeline-list?stage=MeetingScheduled", label: "Meeting Scheduled" },
    { href: "/sales-pipeline/pipeline-list?stage=DemoConducted", label: "Demo Conducted" },
    { divider: true },
    { href: "/sales-pipeline/pipeline-list?stage=overdue", label: "Overdue" },
    { href: "/sales-pipeline/pipeline-list?stage=Rejected", label: "Rejected" },
  ];

  const dealSubItems = isVariant2 ? [
    { href: "/deals", label: "Overview" },
    { href: "/deals?status=Active", label: "Active Deals" },
    { href: "/deals?status=OnHold", label: "On Hold Deals" },
    { href: "/deals?status=Won", label: "Won Deals" },
    { href: "/deals?status=Lost", label: "Lost Deals" },
  ] : [
    { href: "/deals", label: "Overview" },
    { href: "/deals?status=Active", label: "Active Deals" },
    { href: "/deals?status=Won", label: "Won Deals" },
    { href: "/deals?status=Lost", label: "Lost Deals" },
  ];

  const customerAssetSubItems = [
    { href: "/customer-assets", label: "Overview" },
  ];

  const reportsSubItemsV3 = isVariant3 ? [
    { href: "/reports/samples", label: "Sample Report" },
    { href: "/reports/negotiations", label: "Negotiation Report" },
    { href: "/reports/purchase-orders", label: "Purchase Order Report" },
    { href: "/reports/po-conversion", label: "PO Conversion Report" },
    ...(isVariant4 ? [
      { href: "/reports/competitor-analysis", label: "Competitor Analysis" },
      { href: "/reports/target-achievement", label: "Target Achievement Report" },
    ] : []),
  ] : [];

  const reportsSubItems = isVariant2 ? [
    { href: "/reports", label: "All Reports" },
    { href: "/reports/leads", label: "Lead Report" },
    { href: "/reports/followups", label: "Follow-Up Report" },
    { href: "/reports/opportunities", label: "Opportunity Report" },
    { href: "/reports/rfq", label: "RFQ Report" },
    { href: "/reports/quotations", label: "Quotation Report" },
    { href: "/reports/sales-performance", label: "Sales Performance Report" },
    { href: "/reports/visits", label: "Visit Report" },
    { href: "/reports/forecast", label: "Forecast Report" },
    ...(isVariant3 ? reportsSubItemsV3 : []),
  ] : [
    { href: "/reports/leads", label: "Lead Report" },
    { href: "/reports/followups", label: "Follow-Up Report" },
    { href: "/reports/opportunities", label: "Opportunity Report" },
    { href: "/reports/quotations", label: "Quotation Report" },
  ];

  const userManagementSubItems = [
    { href: "/user-master", label: "Users" },
    { href: "/settings/roles", label: "Roles & Permissions" },
  ];

  const settingsSubItems = getSettingsForVariant(activeVariant);

  // Variant 2 navigation items
  const customerVisitsSubItems = [
    { href: "/visits", label: "Overview" },
    { href: "/visits?status=PLANNED", label: "Planned Visits" },
    { href: "/visits?status=COMPLETED", label: "Completed Visits" },
    { href: "/visits?status=MISSED", label: "Missed Visits" },
    { href: "/visits/reports", label: "Visit Reports" },
  ];

  const productCatalogueSubItems = [
    { href: "/catalogue", label: "Overview" },
    { href: "/catalogue/categories", label: "Categories" },
    { href: "/catalogue/products", label: "Products" },
    { href: "/catalogue/specifications", label: "Specifications" },
    { href: "/catalogue/datasheets", label: "Datasheets" },
    { href: "/catalogue/brochures", label: "Brochures" },
  ];

  const rfqSubItems = [
    { href: "/rfq", label: "Overview" },
    { href: "/rfq?status=New", label: "New RFQ" },
    { href: "/rfq?status=UnderReview", label: "Under Review" },
    { href: "/rfq?status=CostingPending", label: "Costing Pending" },
    { href: "/rfq?status=QuotationCreated", label: "Quotation Created" },
    { href: "/rfq?status=Closed", label: "Closed RFQ" },
  ];

  const quotationSubItems = isVariant3 ? [
    { href: "/quotations", label: "Overview" },
    { href: "/quotations?status=Draft", label: "Draft" },
    { href: "/quotations?status=Sent", label: "Sent" },
    { href: "/quotations?status=UnderReview", label: "Under Review" },
    { href: "/quotations?status=Accepted", label: "Accepted" },
    { href: "/quotations?status=Rejected", label: "Rejected" },
    { href: "/quotations?status=Expired", label: "Expired" },
  ] : [
    { href: "/quotations", label: "Overview" },
    { href: "/quotations?status=Draft", label: "Draft" },
    { href: "/quotations?status=Sent", label: "Sent" },
    { href: "/quotations?status=Accepted", label: "Accepted" },
    { href: "/quotations?status=Rejected", label: "Rejected" },
  ];

  const forecastSubItems = [
    { href: "/forecast", label: "Overview" },
    { href: "/forecast?type=Revenue", label: "Revenue Forecast" },
    { href: "/forecast?type=Opportunity", label: "Opportunity Forecast" },
    { href: "/forecast?type=Sales", label: "Sales Forecast" },
    { href: "/forecast/target-vs-achievement", label: "Target vs Achievement" },
  ];

  // ─── Variant 3 navigation items ───
  const sampleMgmtSubItems = [
    { href: "/samples", label: "Overview" },
    { href: "/samples?status=New", label: "New Sample Request" },
    { href: "/samples?status=UnderReview", label: "Under Review" },
    { href: "/samples?status=SentToCustomer", label: "Sent To Customer" },
    { href: "/samples?status=Approved", label: "Approved" },
    { href: "/samples?status=Rejected", label: "Rejected" },
    { href: "/samples?status=Revision", label: "Revisions" },
  ];

  const negotiationMgmtSubItems = [
    { href: "/negotiations", label: "Overview" },
    { href: "/negotiations?status=Active", label: "Active Negotiation" },
    { href: "/negotiations?status=PendingApproval", label: "Pending Approval" },
    { href: "/negotiations?status=PriceRevision", label: "Price Revision" },
    { href: "/negotiations?status=CommercialDiscussion", label: "Commercial Discussion" },
    { href: "/negotiations?status=Closed-Success", label: "Won" },
    { href: "/negotiations?status=Closed-Failure", label: "Lost" },
  ];

  const purchaseOrderMgmtSubItems = [
    { href: "/purchase-orders", label: "Overview" },
    { href: "/purchase-orders?status=New", label: "New PO" },
    { href: "/purchase-orders?status=UnderValidation", label: "Under Validation" },
    { href: "/purchase-orders?status=Approved", label: "Approved PO" },
    { href: "/purchase-orders?status=Rejected", label: "Rejected PO" },
    { href: "/purchase-orders?status=Closed", label: "Closed PO" },
  ];

  const documentMgmtSubItems = [
    { href: "/documents", label: "Overview" },
    { href: "/documents?type=Drawing", label: "Drawings" },
    { href: "/documents?type=TechnicalSpec", label: "Technical Specifications" },
    { href: "/documents?type=NDA", label: "NDA" },
    { href: "/documents?type=Quotation", label: "Quotations" },
    { href: "/documents?type=PurchaseOrder", label: "Purchase Orders" },
    { href: "/documents?type=Agreement", label: "Agreements" },
    { href: "/documents?type=Brochure", label: "Brochures" },
  ];

  const approvalCenterSubItems = [
    { href: "/approvals", label: "Overview" },
    { href: "/approvals?type=Quotation", label: "Quotation Approvals" },
    { href: "/approvals?type=Discount", label: "Discount Approvals" },
    { href: "/approvals?type=Negotiation", label: "Negotiation Approvals" },
    { href: "/approvals?type=PO", label: "PO Approvals" },
  ];

  // ─── Variant 4 navigation items ───
  const competitorMgmtSubItems = [
    { href: "/competitors", label: "Overview" },
    { href: "/competitors/products", label: "Competitor Products" },
    { href: "/competitors/lost-analysis", label: "Lost Deals Analysis" },
    { href: "/competitors/win-loss", label: "Win/Loss Analysis" },
  ];

  const keyAccountMgmtSubItems = [
    { href: "/key-accounts", label: "Overview" },
    { href: "/key-accounts?importance=Critical", label: "Strategic Accounts" },
    { href: "/key-accounts?view=revenue", label: "Revenue Potential" },
    { href: "/key-accounts/visits", label: "Visit Schedule" },
    { href: "/key-accounts/relationships", label: "Relationship Mapping" },
  ];

  const territoryMgmtSubItems = [
    { href: "/territories", label: "Overview" },
    { href: "/territories?view=regions", label: "Regions" },
    { href: "/territories/accounts", label: "Territory Accounts" },
    { href: "/territories/performance", label: "Territory Performance" },
  ];

  const targetMgmtSubItems = [
    { href: "/targets", label: "Overview" },
    { href: "/targets?type=Monthly", label: "Monthly Targets" },
    { href: "/targets?type=Quarterly", label: "Quarterly Targets" },
    { href: "/targets?type=Yearly", label: "Yearly Targets" },
    { href: "/targets/achievement", label: "Achievement Tracking" },
  ];

  // Sales Manager Dashboard is shown as a separate NavLink for Variant 2

  return (
    <>
      {/* ── Logo / Brand ── */}
      <div
        className={cn(
          "shrink-0 flex flex-col gap-2 border-b border-white/[0.07]",
          collapsed ? "px-0 py-4 items-center justify-center" : "px-4 py-4"
        )}
      >
        <div className="flex items-center justify-center">
          {collapsed ? (
            <Logo
              theme={logoTheme}
              variant="mark-only"
              size={38}
              className="transition-all duration-300 hover:scale-105"
            />
          ) : (
            <Logo
              theme={logoTheme}
              variant="full"
              size={46}
              className="transition-all duration-300 hover:scale-105"
            />
          )}
        </div>


      </div>

      {/* ── Module Search ── */}
      {!collapsed && (
        <SidebarModuleSearch
          user={user}
          activeVariant={activeVariant}
          collapsed={collapsed}
          onNavigate={onNavClick}
        />
      )}

      {/* ── Navigation ── */}
      <nav className={cn("flex-1 overflow-y-auto py-4 space-y-1", collapsed ? "px-1.5" : "px-3")}>
        {!collapsed && process.env.NODE_ENV === "development" && (
          <div className="px-3.5 pb-2 text-[10px] text-gray-500">
            Variant: {user?.variant || user?.company?.variant || 1}
          </div>
        )}

        {isServiceWorkspace ? (
          user?.role === "ServiceEngineer" ? (
            <>
              <ExpandableNavSection
                label="Engineer Portal"
                icon={<Wrench size={17} />}
                subItems={[
                  { href: "/service/my-visits", label: "My Visits" },
                  { href: "/service/my-visits/feedback", label: "My Ratings & Feedback" },
                ]}
                pathname={pathname}
                onNavClick={onNavClick}
                collapsed={collapsed}
                isOpen={openSection === "Engineer Portal"}
                onToggle={makeToggle("Engineer Portal")}
                onOpen={openSectionLabel("Engineer Portal")}
              />
            </>
          ) : (
            <>
              <ExpandableNavSection
                label="Dashboard"
                icon={<LayoutDashboard size={17} />}
                subItems={[
                  { href: "/service/dashboard/my", label: "My Dashboard" },
                  { href: "/service/dashboard/manager", label: "Service Manager Dashboard" },
                ]}
                pathname={pathname}
                onNavClick={onNavClick}
                collapsed={collapsed}
                isOpen={openSection === "Dashboard"}
                onToggle={makeToggle("Dashboard")}
                onOpen={openSectionLabel("Dashboard")}
              />
              {!collapsed && (
                <div className="pt-4 pb-1.5">
                  <p className="px-3.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--sidebar-heading)" }}>SERVICE</p>
                </div>
              )}
              <NavLink item={{ href: "/service/requests", label: "Requests", icon: <Wrench size={17} /> }} active={pathname.startsWith("/service/requests")} onClick={onNavClick} collapsed={collapsed} />
              <NavLink item={{ href: "/service/complaints", label: "Complaints", icon: <AlertTriangle size={17} /> }} active={pathname.startsWith("/service/complaints")} onClick={onNavClick} collapsed={collapsed} />
              <NavLink item={{ href: "/service/defects", label: "Defects", icon: <HelpCircle size={17} /> }} active={pathname.startsWith("/service/defects")} onClick={onNavClick} collapsed={collapsed} />
              <NavLink item={{ href: "/service/installations", label: "Installations", icon: <Hammer size={17} /> }} active={pathname.startsWith("/service/installations")} onClick={onNavClick} collapsed={collapsed} />
              <NavLink item={{ href: "/service/warranty-amc", label: "Warranty & AMC", icon: <Award size={17} /> }} active={pathname.startsWith("/service/warranty-amc")} onClick={onNavClick} collapsed={collapsed} />
              <NavLink item={{ href: "/service/visits", label: "Visits", icon: <Calendar size={17} /> }} active={pathname.startsWith("/service/visits")} onClick={onNavClick} collapsed={collapsed} />
              <NavLink item={{ href: "/service/reviews", label: "Reviews & Feedback", icon: <Star size={17} /> }} active={pathname.startsWith("/service/reviews")} onClick={onNavClick} collapsed={collapsed} />
              <NavLink item={{ href: "/service/assets", label: "Assets", icon: <Package size={17} /> }} active={pathname.startsWith("/service/assets")} onClick={onNavClick} collapsed={collapsed} />
              <NavLink item={{ href: "/service/reports", label: "Reports", icon: <ChartBar size={17} /> }} active={pathname.startsWith("/service/reports")} onClick={onNavClick} collapsed={collapsed} />
              <div className="border-t border-white/[0.06] my-2 pt-1" />
              <NavLink item={{ href: "/service/settings", label: "Settings", icon: <Settings size={17} /> }} active={pathname.startsWith("/service/settings")} onClick={onNavClick} collapsed={collapsed} />
            </>
          )
        ) : (
          <>
            {/* Dashboards - Expandable section */}
            <ExpandableNavSection
              label="Dashboards"
              icon={<LayoutDashboard size={17} />}
              subItems={[
                { href: "/dashboard", label: "Overview" },
                ...(isVariant2 && !loading && (user?.role === "Admin" || user?.role === "SalesManager") ? [{ href: "/dashboard/manager", label: "Sales Manager" }] : []),
              ]}
              pathname={pathname}
              onNavClick={onNavClick}
              collapsed={collapsed}
              isOpen={openSection === "Dashboards"}
              onToggle={makeToggle("Dashboards")}
              onOpen={openSectionLabel("Dashboards")}
            />

            {!loading && user?.role !== "Customer" && user?.role !== "SuperAdmin" && (
              <>
                {/* ── Lifecycle modules in sales-flow order ── */}
                {hasPerm("Leads") && <ExpandableNavSection label="Leads" icon={<Users size={17} />} subItems={leadSubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "Leads"} onToggle={makeToggle("Leads")} onOpen={openSectionLabel("Leads")} />}
                {hasPerm("Accounts") && <ExpandableNavSection label="Accounts" icon={<BookUser size={17} />} subItems={accountsSubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "Accounts"} onToggle={makeToggle("Accounts")} onOpen={openSectionLabel("Accounts")} />}
                {hasPerm("Contacts") && <ExpandableNavSection label="Contacts" icon={<ContactRound size={17} />} subItems={contactsSubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "Contacts"} onToggle={makeToggle("Contacts")} onOpen={openSectionLabel("Contacts")} />}
                {hasPerm("Activities") && <ExpandableNavSection label="Activities" icon={<Activity size={17} />} subItems={activitySubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "Activities"} onToggle={makeToggle("Activities")} onOpen={openSectionLabel("Activities")} />}

                {isVariant2 && hasPerm("Customer Visits") && (
                  <ExpandableNavSection label="Customer Visits" icon={<MapPin size={17} />} subItems={customerVisitsSubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "Customer Visits"} onToggle={makeToggle("Customer Visits")} onOpen={openSectionLabel("Customer Visits")} />
                )}

                {isVariant2 && hasPerm("Product Catalogue") && (
                  <ExpandableNavSection label="Product Catalogue" icon={<Package size={17} />} subItems={productCatalogueSubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "Product Catalogue"} onToggle={makeToggle("Product Catalogue")} onOpen={openSectionLabel("Product Catalogue")} />
                )}

                {isVariant3 && hasPerm("Samples") && (
                  <ExpandableNavSection label="Samples" icon={<Package size={17} />} subItems={sampleMgmtSubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "Samples"} onToggle={makeToggle("Samples")} onOpen={openSectionLabel("Samples")} />
                )}

                {hasPerm("Sales Pipeline") && <ExpandableNavSection label="Sales Pipeline" icon={<TrendingUp size={17} />} subItems={salesPipelineSubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "Sales Pipeline"} onToggle={makeToggle("Sales Pipeline")} onOpen={openSectionLabel("Sales Pipeline")} />}

                {isVariant2 && hasPerm("RFQ") && (
                  <ExpandableNavSection label="RFQ" icon={<FileText size={17} />} subItems={rfqSubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "RFQ"} onToggle={makeToggle("RFQ")} onOpen={openSectionLabel("RFQ")} />
                )}

                {isVariant4 && hasPerm("Competitors") && (
                  <ExpandableNavSection label="Competitors" icon={<Swords size={17} />} subItems={competitorMgmtSubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "Competitors"} onToggle={makeToggle("Competitors")} onOpen={openSectionLabel("Competitors")} />
                )}
                {hasPerm("Quotations") && <ExpandableNavSection label="Quotations" icon={<IndianRupee size={17} />} subItems={quotationSubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "Quotations"} onToggle={makeToggle("Quotations")} onOpen={openSectionLabel("Quotations")} />}
                {isVariant3 && hasPerm("Negotiations") && (
                  <ExpandableNavSection label="Negotiations" icon={<MessageSquare size={17} />} subItems={negotiationMgmtSubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "Negotiations"} onToggle={makeToggle("Negotiations")} onOpen={openSectionLabel("Negotiations")} />
                )}
                {isVariant3 && hasPerm("Purchase Orders") && (
                  <ExpandableNavSection label="Purchase Orders" icon={<FileText size={17} />} subItems={purchaseOrderMgmtSubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "Purchase Orders"} onToggle={makeToggle("Purchase Orders")} onOpen={openSectionLabel("Purchase Orders")} />
                )}

                {isVariant2 && hasPerm("Deals") && (
                  <ExpandableNavSection label="Deals" icon={<Briefcase size={17} />} subItems={dealSubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "Deals"} onToggle={makeToggle("Deals")} onOpen={openSectionLabel("Deals")} />
                )}
                {isVariant2 && (
                  <ExpandableNavSection label="Customer Assets" icon={<HardDrive size={17} />} subItems={customerAssetSubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "Customer Assets"} onToggle={makeToggle("Customer Assets")} onOpen={openSectionLabel("Customer Assets")} />
                )}
                {hasPerm("Tasks") && <ExpandableNavSection label="Tasks" icon={<ListTodo size={17} />} subItems={taskSubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "Tasks"} onToggle={makeToggle("Tasks")} onOpen={openSectionLabel("Tasks")} />}
                {hasPerm("Follow Ups") && <ExpandableNavSection label="Follow Ups" icon={<CalendarClock size={17} />} subItems={followUpSubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "Follow Ups"} onToggle={makeToggle("Follow Ups")} onOpen={openSectionLabel("Follow Ups")} />}

                {isVariant3 && hasPerm("Documents") && (
                  <ExpandableNavSection label="Documents" icon={<FileText size={17} />} subItems={documentMgmtSubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "Documents"} onToggle={makeToggle("Documents")} onOpen={openSectionLabel("Documents")} />
                )}
                {isVariant4 && hasPerm("Key Accounts") && (
                  <ExpandableNavSection label="Key Accounts" icon={<Crown size={17} />} subItems={keyAccountMgmtSubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "Key Accounts"} onToggle={makeToggle("Key Accounts")} onOpen={openSectionLabel("Key Accounts")} />
                )}
                {isVariant4 && hasPerm("Territories") && (
                  <ExpandableNavSection label="Territories" icon={<Globe size={17} />} subItems={territoryMgmtSubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "Territories"} onToggle={makeToggle("Territories")} onOpen={openSectionLabel("Territories")} />
                )}
                {isVariant4 && hasPerm("Targets") && (
                  <ExpandableNavSection label="Targets" icon={<Trophy size={17} />} subItems={targetMgmtSubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "Targets"} onToggle={makeToggle("Targets")} onOpen={openSectionLabel("Targets")} />
                )}

                {isVariant2 && hasPerm("Forecast") && (
                  <ExpandableNavSection label="Forecast" icon={<Target size={17} />} subItems={forecastSubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "Forecast"} onToggle={makeToggle("Forecast")} onOpen={openSectionLabel("Forecast")} />
                )}

                {hasPerm("Reports") && <ExpandableNavSection label="Reports" icon={<PieChart size={17} />} subItems={reportsSubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "Reports"} onToggle={makeToggle("Reports")} onOpen={openSectionLabel("Reports")} />}

                {isVariant3 && hasPerm("Approval Center") && (
                  <ExpandableNavSection label="Approval Center" icon={<ShieldCheck size={17} />} subItems={approvalCenterSubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "Approval Center"} onToggle={makeToggle("Approval Center")} onOpen={openSectionLabel("Approval Center")} />
                )}
              </>
            )}

            {!loading && user?.role === "SuperAdmin" && (
              <>
                {!collapsed && (
                  <div className="pt-3 pb-1">
                    <p className="px-3.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--sidebar-heading)" }}>Platform Admin</p>
                  </div>
                )}
                <NavLink item={{ href: "/admin/companies", label: "Companies", icon: <Building2 size={17} /> }} active={pathname.startsWith("/admin/companies")} onClick={onNavClick} collapsed={collapsed} />
                <NavLink item={{ href: "/admin/system-configs", label: "System Configs", icon: <Settings size={17} /> }} active={pathname.startsWith("/admin/system-configs")} onClick={onNavClick} collapsed={collapsed} />
              </>
            )}

            {!loading && user?.role === "Customer" && (
              <>
                {!collapsed && (
                  <div className="pt-4 pb-1.5">
                    <p className="px-3.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--sidebar-heading)" }}>Portal</p>
                  </div>
                )}
                <NavLink item={{ href: "/subscription", label: "My Subscriptions", icon: <Briefcase size={17} /> }} active={pathname.startsWith("/subscription")} onClick={onNavClick} collapsed={collapsed} />
                <NavLink item={{ href: "/customer/support", label: "Support Tickets", icon: <CheckSquare size={17} /> }} active={pathname.startsWith("/customer/support")} onClick={onNavClick} collapsed={collapsed} />
              </>
            )}

            {!loading && user?.role === "Admin" && (
              <>
                {!collapsed && (
                  <div className="pt-4 pb-1.5">
                    <p className="px-3.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--sidebar-heading)" }}>Settings</p>
                  </div>
                )}
                {isVariant2 ? (
                  <>
                    {hasPerm("User Management") && <ExpandableNavSection label="User Management" icon={<Users size={17} />} subItems={userManagementSubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "User Management"} onToggle={makeToggle("User Management")} onOpen={openSectionLabel("User Management")} />}
                    {hasPerm("Audit Logs") && <NavLink item={{ href: "/audit-logs", label: "Audit Logs", icon: <ShieldCheck size={17} /> }} active={pathname.startsWith("/audit-logs")} onClick={onNavClick} collapsed={collapsed} />}
                    {hasPerm("Settings") && <ExpandableNavSection label="Settings" icon={<Settings size={17} />} subItems={settingsSubItems} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "Settings"} onToggle={makeToggle("Settings")} onOpen={openSectionLabel("Settings")} />}
                  </>
                ) : (
                  <>
                    {hasPerm("Settings") && <ExpandableNavSection label="Settings" icon={<Settings size={17} />} subItems={[
                      ...(hasPerm("User Management") ? userManagementSubItems : []),
                      ...settingsSubItems,
                    ]} pathname={pathname} onNavClick={onNavClick} collapsed={collapsed} isOpen={openSection === "Settings"} onToggle={makeToggle("Settings")} onOpen={openSectionLabel("Settings")} />}
                  </>
                )}
              </>
            )}
          </>
        )}
      </nav>

      {/* ── User Profile Card ── */}
      <div className={cn("shrink-0 border-t border-white/[0.07] p-3", collapsed && "px-1.5")}>
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl p-2 transition-colors",
            collapsed && "justify-center",
          )}
          style={{ background: "var(--sidebar-active-bg)" }}
        >
          <div
            className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[13px] font-bold"
            style={{ background: "rgba(255,255,255,0.15)", color: "#FFFFFF" }}
          >
            {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-semibold text-white truncate leading-tight">
                {user?.name || "User"}
              </p>
              <p className="text-[10.5px] text-white/70 truncate leading-tight">My account</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={handleLogout}
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut size={15} />
            </button>
          )}
        </div>
      </div>

    </>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

const PATH_MODULE_MAP: Record<string, string> = {
  "/leads": "Leads",
  "/customer-master": "Accounts",
  "/contacts": "Contacts",
  "/activities": "Activities",
  "/timeline": "Activities",
  "/visits": "Customer Visits",
  "/catalogue": "Product Catalogue",
  "/samples": "Samples",
  "/sales-pipeline": "Sales Pipeline",
  "/rfq": "RFQ",
  "/competitors": "Competitors",
  "/quotations": "Quotations",
  "/negotiations": "Negotiations",
  "/purchase-orders": "Purchase Orders",
  "/deals": "Deals",
  "/customer-assets": "Customer Assets",
  "/tasks": "Tasks",
  "/follow-up": "Follow Ups",
  "/documents": "Documents",
  "/key-accounts": "Key Accounts",
  "/territories": "Territories",
  "/targets": "Targets",
  "/forecast": "Forecast",
  "/reports": "Reports",
  "/approvals": "Approval Center",
  "/service/dashboard": "Service Dashboard",
  "/service/requests": "Service Requests",
  "/service/complaints": "Complaints",
  "/service/defects": "Defects",
  "/service/installations": "Installations",
  "/service/warranty-amc": "Warranty & AMC",
  "/service/visits": "Service Visits",
  "/service/assets": "Customer Assets",
  "/service/reports": "Service Reports",
  "/service/settings": "Service Settings",
  "/user-master": "User Management",
  "/audit-logs": "Audit Logs",
  "/settings": "Settings"
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    } else if (user && user.role !== "Admin" && user.role !== "SuperAdmin") {
      let currentModule: string | null = null;
      for (const [pathPrefix, moduleName] of Object.entries(PATH_MODULE_MAP)) {
        if (pathname === pathPrefix || pathname.startsWith(pathPrefix + "/")) {
          currentModule = moduleName;
          break;
        }
      }
      
      if (currentModule && user.permissions !== "ALL" && Array.isArray(user.permissions)) {
        const p = user.permissions.find((x: any) => x.module === currentModule);
        if (p && !p.visible) {
          router.replace("/dashboard");
        }
      }
    }
  }, [user, loading, router, pathname]);

  const handleLogout = async () => {
    try {
      await logoutAction();
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const toggleSidebar = () => setIsCollapsed(prev => !prev);
  const toggleMobileDrawer = () => setMobileDrawerOpen(prev => !prev);
  const pageTitle = pathname.split("/").filter(Boolean).pop()?.replace(/-/g, " ") || "Dashboard";

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>

      {/* ── Mobile Drawer Overlay ── */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      <aside
        className={cn(
          "shrink-0 flex flex-col h-full z-20 border-r border-white/[0.08] transition-all duration-300 ease-in-out",
          // Desktop: show sidebar always
          "hidden md:flex",
          isCollapsed ? "w-[72px]" : "w-[236px]",
          // Mobile: show as drawer when open
          mobileDrawerOpen && "fixed inset-y-0 left-0 md:hidden flex w-[260px] z-50"
        )}
        style={{
          background: "#000000",
          boxShadow: "4px 0 32px rgba(0,0,0,0.45), inset -1px 0 0 rgba(255,255,255,0.05)"
        }}
      >
        <SidebarContent
          pathname={pathname}
          user={user}
          loading={loading}
          handleLogout={handleLogout}
          collapsed={isCollapsed}
          onNavClick={() => setMobileDrawerOpen(false)}
        />
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader pageTitle={pageTitle} user={user} toggleSidebar={toggleSidebar} onMobileMenuClick={toggleMobileDrawer} />

        <div className="flex-1 overflow-auto p-4 sm:p-5 md:p-6 lg:p-8 pb-20 md:pb-6">
          <CurrencyProvider>
            {children}
          </CurrencyProvider>
        </div>

        {user && (
          <MobileBottomNav setDrawerOpen={toggleMobileDrawer} />
        )}
      </main>
    </div>
  );
}
