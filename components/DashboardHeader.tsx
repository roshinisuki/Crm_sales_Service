"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ToastProvider";
import { logoutAction } from "@/app/actions/auth";
import { cn } from "@/lib/ui-utils";
import { searchModules, type ModuleSearchItem } from "@/lib/config/variantModuleMap";
import { getInitials } from "@/lib/ui-utils";
import { Search, Bell, ChevronDown, Menu, Settings, User, LogOut, Check, Trash2, TrendingUp, Wrench } from "lucide-react";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { useTheme } from "@/lib/useTheme";

const ROLE_LABELS: Record<string, string> = {
  Admin:              "Administrator",
  SalesManager:      "Marketing Lead",
  SalesExecutive: "Sales Executive",
  Customer:           "Customer",
};

const SEARCH_PLACEHOLDERS: Record<number, string> = {
  1: 'Search leads, accounts, contacts, or jump to a module...',
  2: 'Search leads, accounts, pipeline, RFQ, quotations, or go to a module...',
  3: 'Search leads, accounts, pipeline, RFQ, quotations, samples, or go to a module...',
  4: 'Search leads, accounts, pipeline, RFQ, quotations, territories, or go to a module...',
};

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function CrmToggle({ className }: { className?: string }) {
  const pathname = usePathname();
  const isServiceWorkspace = pathname?.startsWith("/service");

  return (
    <div className={cn("relative flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-1 rounded-full select-none w-[240px] h-[32px]", className)}>
      {/* Sliding background */}
      <div
        className={cn(
          "absolute top-[3px] bottom-[3px] w-[116px] rounded-full transition-all duration-300 ease-out shadow-sm",
          isServiceWorkspace 
            ? "left-[calc(50%+1px)] bg-purple-600 shadow-[0_0_8px_rgba(168,85,247,0.4)]" 
            : "left-[3px] bg-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.4)]"
        )}
      />
      
      {/* Sales CRM Link */}
      <Link
        href="/dashboard"
        className={cn(
          "flex-1 flex items-center justify-center gap-2 py-1 text-[11px] font-bold z-10 transition-colors duration-200",
          !isServiceWorkspace 
            ? "text-white" 
            : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        )}
      >
        <TrendingUp size={14} className="shrink-0" />
        <span>Sales CRM</span>
      </Link>

      {/* Service CRM Link */}
      <Link
        href="/service/dashboard/my"
        className={cn(
          "flex-1 flex items-center justify-center gap-2 py-1 text-[11px] font-bold z-10 transition-colors duration-200",
          isServiceWorkspace 
            ? "text-white" 
            : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        )}
      >
        <Wrench size={14} className="shrink-0" />
        <span>Service CRM</span>
      </Link>
    </div>
  );
}

export default function DashboardHeader({
  pageTitle,
  user,
  toggleSidebar,
  onMobileMenuClick,
}: {
  pageTitle: string;
  user: any;
  toggleSidebar: () => void;
  onMobileMenuClick?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isServiceWorkspace = pathname?.startsWith("/service");
  const toast = useToast();
  const now = useClock();

  // Theme — single source of truth from ThemeProvider
  const { theme, mode, requestThemeChange, toggleMode } = useTheme();

  const changeTheme = (t: string) => {
    requestThemeChange(t as any);
  };

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ leads: any[]; customers: any[]; deals: any[]; contacts: any[]; pos: any[]; quotations: any[]; visits: any[]; visitors: any[] } | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [moduleResults, setModuleResults] = useState<ModuleSearchItem[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const activeVariant: number = user?.variant || user?.company?.variant || 1;

  // Notifications
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Profile dropdown
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current  && !searchRef.current.contains(e.target as Node))  setIsSearchOpen(false);
      if (notifRef.current   && !notifRef.current.contains(e.target as Node))   setIsNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setIsProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // SSE Notifications
  const seenToastIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user) return;
    let isFirstLoad = true;
    const es = new EventSource("/api/notifications/sse");
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.success) {
          const fetched = data.data;
          const newUnreads = fetched.filter((n: any) => !n.isRead);
          const trulyNew = newUnreads.filter((n: any) => !seenToastIds.current.has(n.id));
          if (trulyNew.length > 0 && !isFirstLoad) {
            const latest = trulyNew[0];
            const t = latest.title?.toLowerCase() || "";
            let type: "success" | "error" | "warning" | "info" = "info";
            if (t.includes("reject") || t.includes("fail") || t.includes("error")) type = "error";
            else if (t.includes("approve") || t.includes("success") || t.includes("complete")) type = "success";
            else if (t.includes("due") || t.includes("warning") || t.includes("overdue") || latest.type === "follow_up") type = "warning";
            toast[type](latest?.message || "New activity logged.", latest?.title || "Notification");
          }
          newUnreads.forEach((n: any) => seenToastIds.current.add(n.id));
          setNotifications(fetched);
          isFirstLoad = false;
        }
      } catch {}
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [user]);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults(null); return; }
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
        .then(r => r.json())
        .then(d => { if (d.success) { setSearchResults(d.data); setIsSearchOpen(true); } })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      let results = searchModules(searchQuery, activeVariant);
      if (isServiceWorkspace) {
        results = [
          { key: "requests", label: "Service Requests", href: "/service/requests", icon: "🛠️" },
          { key: "complaints", label: "Complaints", href: "/service/complaints", icon: "⚠️" },
          { key: "defects", label: "Defects", href: "/service/defects", icon: "🔍" },
          { key: "installations", label: "Installations", href: "/service/installations", icon: "🔨" },
          { key: "warranty-amc", label: "Warranty & AMC", href: "/service/warranty-amc", icon: "🛡️" },
          { key: "visits", label: "Service Visits", href: "/service/visits", icon: "📅" },
          { key: "assets", label: "Customer Assets", href: "/service/assets", icon: "📂" },
          { key: "settings", label: "Service Settings", href: "/service/settings", icon: "⚙️" },
        ].filter(m => m.label.toLowerCase().includes(searchQuery.toLowerCase()) || m.key.toLowerCase().includes(searchQuery.toLowerCase())) as any;
      } else {
        results = results.filter(m => !m.href.startsWith("/service"));
      }
      setModuleResults(results);
    } else {
      setModuleResults([]);
      setHighlightedIndex(-1);
    }
  }, [searchQuery, activeVariant, isServiceWorkspace]);

  const markAllRead = () => {
    fetch("/api/notifications", { method: "PATCH" }).catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };
  const markRead = (id: string) => {
    fetch(`/api/notifications/${id}`, { method: "PATCH" }).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };
  const clearAll = () => {
    fetch("/api/notifications", { method: "DELETE" }).catch(() => {});
    setNotifications([]);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => Math.min(i + 1, moduleResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && highlightedIndex >= 0 && moduleResults[highlightedIndex]) {
      router.push(moduleResults[highlightedIndex].href);
      setSearchQuery('');
      setIsSearchOpen(false);
      setHighlightedIndex(-1);
    } else if (e.key === 'Escape') {
      setSearchQuery('');
      setIsSearchOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <header className="h-14 bg-[var(--topbar-bg)] border-b border-[var(--topbar-border)] flex items-center justify-between px-3 md:px-5 shrink-0 z-40 relative shadow-[0_1px_3px_rgba(0,0,0,0.04)]">

      {/* ── Left ── */}
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        {onMobileMenuClick && (
          <button
            onClick={onMobileMenuClick}
            className="md:hidden w-9 h-9 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-offset)] flex items-center justify-center text-[var(--text-secondary)] transition-colors border border-[var(--border)]"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
        )}

        {/* Sidebar toggle button (desktop only) */}
        <button
          onClick={toggleSidebar}
          className="hidden md:flex w-7 h-7 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-offset)] items-center justify-center text-[var(--text-secondary)] transition-colors border border-[var(--border)]"
        >
          <Menu size={15} />
        </button>

        {/* Global Search */}
        <div className="relative hidden sm:block" ref={searchRef}>
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <Search size={13} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setIsSearchOpen(true); }}
            onKeyDown={handleSearchKeyDown}
            placeholder={isServiceWorkspace ? "Search requests, complaints, defects, assets..." : (SEARCH_PLACEHOLDERS[activeVariant] ?? SEARCH_PLACEHOLDERS[1])}
            className="w-[220px] lg:w-[300px] h-[30px] pl-8 pr-3 rounded-lg bg-[var(--surface-2)] text-xs text-[var(--text-primary)] placeholder:text-slate-400 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] focus:bg-[var(--surface)] transition-all"
          />

          {isSearchOpen && (moduleResults.length > 0 || searchResults) && (
            <div className="absolute top-full mt-2 w-[360px] right-0 bg-[var(--surface)] border border-[var(--border)] shadow-xl rounded-2xl overflow-hidden z-50">
              <div className="max-h-96 overflow-y-auto">

                {/* ── Module / Page results (local, instant) ── */}
                {moduleResults.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 pt-3 pb-1">Go to</h4>
                    {moduleResults.map((item, idx) => (
                      <div
                        key={item.key}
                        onClick={() => { router.push(item.href); setSearchQuery(""); setIsSearchOpen(false); setHighlightedIndex(-1); }}
                        className="flex items-center gap-2.5 px-3 py-2 mx-1 rounded-xl cursor-pointer transition-colors"
                        style={{ background: idx === highlightedIndex ? 'var(--surface-2)' : 'transparent' }}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        onMouseLeave={() => setHighlightedIndex(-1)}
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 bg-[var(--surface-2)]">
                          {item.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                            {item.parentLabel
                              ? <>{item.parentLabel} <span className="text-slate-400 mx-0.5">›</span> {item.label}</>
                              : item.label
                            }
                          </p>
                          <p className="text-[10px] text-slate-400">{item.type === 'setting' ? 'Settings' : 'Navigate to page'}</p>
                        </div>
                        <span className="text-[11px] text-slate-400 shrink-0">↗</span>
                      </div>
                    ))}
                    {searchResults && <div className="h-px bg-[var(--border-subtle)] mx-3 my-1" />}
                  </div>
                )}

                {/* ── Data results (existing API search) ── */}
                {searchResults && (searchResults.leads.length === 0 && searchResults.customers.length === 0 && searchResults.deals.length === 0 && searchResults.contacts.length === 0 && searchResults.pos.length === 0 && searchResults.quotations.length === 0 && searchResults.visits.length === 0 && searchResults.visitors.length === 0 ? (
                  moduleResults.length === 0 && <div className="p-5 text-center text-xs text-slate-400 font-semibold">No results found for "{searchQuery}"</div>
                ) : (
                  <>
                    {searchResults.leads.length > 0 && (
                      <div className="p-2">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">Leads</h4>
                        {searchResults.leads.map((l: any) => (
                          <div key={l.id} onClick={() => { router.push(`/leads/${l.id}`); setIsSearchOpen(false); setSearchQuery(""); }} className="p-2.5 hover:bg-[var(--surface-2)] rounded-xl cursor-pointer transition-colors flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-[10px] font-bold shrink-0">{getInitials(l.name)}</div>
                            <div><p className="text-xs font-bold text-[var(--text-primary)] truncate">{l.name}</p><p className="text-[10px] text-slate-400 truncate">{l.leadCode} · {l.email || l.phone || "—"}</p></div>
                          </div>
                        ))}
                      </div>
                    )}
                    {searchResults.customers.length > 0 && (
                      <div className="p-2 border-t border-[var(--border-subtle)]">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">Customers</h4>
                        {searchResults.customers.map((c: any) => (
                          <div key={c.id} onClick={() => { router.push(`/customer-master/${c.id}`); setIsSearchOpen(false); setSearchQuery(""); }} className="p-2.5 hover:bg-[var(--surface-2)] rounded-xl cursor-pointer transition-colors flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">{getInitials(c.name)}</div>
                            <div><p className="text-xs font-bold text-[var(--text-primary)] truncate">{c.name}</p><p className="text-[10px] text-slate-400 truncate">{c.customerCode} · {c.city || "—"}</p></div>
                          </div>
                        ))}
                      </div>
                    )}
                    {searchResults.deals.length > 0 && (
                      <div className="p-2 border-t border-[var(--border-subtle)]">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">Deals</h4>
                        {searchResults.deals.map((d: any) => (
                          <div key={d.id} onClick={() => { router.push(`/deals/${d.id}`); setIsSearchOpen(false); setSearchQuery(""); }} className="p-2.5 hover:bg-[var(--surface-2)] rounded-xl cursor-pointer transition-colors">
                            <p className="text-xs font-bold text-[var(--text-primary)] truncate">{d.dealName}</p>
                            <p className="text-[10px] text-slate-400 truncate">{d.status} · ₹{(d.dealValue || 0).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {searchResults.contacts.length > 0 && (
                      <div className="p-2 border-t border-[var(--border-subtle)]">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">Contacts</h4>
                        {searchResults.contacts.map((c: any) => (
                          <div key={c.id} onClick={() => { router.push(`/contacts/${c.id}`); setIsSearchOpen(false); setSearchQuery(""); }} className="p-2.5 hover:bg-[var(--surface-2)] rounded-xl cursor-pointer transition-colors">
                            <p className="text-xs font-bold text-[var(--text-primary)] truncate">{c.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{c.email || c.phone || "—"} · {c.contactType}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {searchResults.pos.length > 0 && (
                      <div className="p-2 border-t border-[var(--border-subtle)]">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">Purchase Orders</h4>
                        {searchResults.pos.map((p: any) => (
                          <div key={p.id} onClick={() => { router.push(`/purchase-orders/${p.id}`); setIsSearchOpen(false); setSearchQuery(""); }} className="p-2.5 hover:bg-[var(--surface-2)] rounded-xl cursor-pointer transition-colors">
                            <p className="text-xs font-bold text-[var(--text-primary)] truncate">{p.poCode || p.poNumber}</p>
                            <p className="text-[10px] text-slate-400 truncate">{p.status} · ₹{(p.totalAmount || 0).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {searchResults.quotations.length > 0 && (
                      <div className="p-2 border-t border-[var(--border-subtle)]">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">Quotations</h4>
                        {searchResults.quotations.map((q: any) => (
                          <div key={q.id} onClick={() => { router.push(`/quotations/${q.id}`); setIsSearchOpen(false); setSearchQuery(""); }} className="p-2.5 hover:bg-[var(--surface-2)] rounded-xl cursor-pointer transition-colors">
                            <p className="text-xs font-bold text-[var(--text-primary)] truncate">{q.quotationCode}</p>
                            <p className="text-[10px] text-slate-400 truncate">{q.status} · ₹{(q.finalAmount || 0).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {searchResults.visits.length > 0 && (
                      <div className="p-2 border-t border-[var(--border-subtle)]">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">Visits</h4>
                        {searchResults.visits.map((v: any) => (
                          <div key={v.id} onClick={() => { router.push("/marketing-log"); setIsSearchOpen(false); setSearchQuery(""); }} className="p-2.5 hover:bg-[var(--surface-2)] rounded-xl cursor-pointer transition-colors">
                            <p className="text-xs font-bold text-[var(--text-primary)] truncate">{v.customer?.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">Rep: {v.executive?.name}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Center flex spacer ── */}
      <div className="flex-1" />

      {/* ── Right ── */}
      <div className="flex items-center gap-2">
        {/* CRM Switcher Toggle */}
        <div className="hidden md:block mr-2 shrink-0">
          <CrmToggle />
        </div>

        {/* Theme Switcher */}
        <div className="hidden lg:block">
          <ThemeSwitcher />
        </div>

        {/* Date/Time */}
        <div className="hidden lg:flex items-center gap-1 px-2 py-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg">
          <span className="text-slate-400">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </span>
          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{dateStr}</span>
          <span className="text-slate-300 dark:text-slate-700 text-[10px]">|</span>
          <span className="text-[11px] font-bold text-[var(--text-primary)]">{timeStr}</span>
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="relative w-7 h-7 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-offset)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] transition-colors"
          >
            <Bell size={14} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--primary)] border border-white dark:border-slate-900 animate-pulse" />
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute top-full mt-2 w-[360px] right-0 bg-[var(--surface)] shadow-2xl rounded-2xl overflow-hidden z-50 flex flex-col border border-[var(--border)] animate-fade-in">
              {/* Header */}
              <div className="bg-[#1A1A1A] text-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold tracking-wide">Notifications</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Live</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold flex items-center gap-1 transition-colors">
                        <Check size={10} /> Mark read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button onClick={clearAll} className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-[10px] font-bold text-red-300 flex items-center gap-1 transition-colors">
                        <Trash2 size={10} /> Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* List */}
              <div className="max-h-[360px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs font-semibold">All caught up!</div>
                ) : (
                  <div className="divide-y divide-[var(--border-subtle)]">
                    {notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => { markRead(n.id); setIsNotifOpen(false); if (n.link) router.push(n.link); }}
                        className={`p-4 cursor-pointer transition-colors hover:bg-[var(--surface-2)] flex gap-3 ${!n.isRead ? "bg-[var(--accent-soft)]/20" : ""}`}
                      >
                        <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center shrink-0 mt-0.5">
                          <Bell size={14} className="text-orange-600 dark:text-orange-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs truncate ${n.isRead ? "font-semibold text-[var(--text-secondary)]" : "font-bold text-[var(--text-primary)]"}`}>{n.title}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                        </div>
                        {!n.isRead && <span className="w-2 h-2 rounded-full bg-[var(--primary)] shrink-0 mt-1.5" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2.5 hover:opacity-90 transition-opacity"
          >
            <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-[10px] font-black border border-orange-200 shrink-0">
              {getInitials(user?.name || "User")}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-[11px] font-semibold text-[var(--text-primary)] leading-tight">{user?.name || "User"}</p>
              <p className="text-[10px] text-[var(--text-secondary)] font-medium leading-tight">{ROLE_LABELS[user?.role] || user?.role}</p>
            </div>
            <ChevronDown size={11} className="hidden md:block text-slate-400" />
          </button>

          {isProfileOpen && (
            <div className="absolute top-full mt-2 right-0 w-48 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden z-50 animate-fade-in py-1">
              <button
                onClick={() => { router.push("/profile"); setIsProfileOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors flex items-center gap-2.5"
              >
                <User size={14} className="text-slate-400" /> Profile
              </button>
              <button
                onClick={() => { router.push("/settings"); setIsProfileOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors flex items-center gap-2.5"
              >
                <Settings size={14} className="text-slate-400" /> Settings
              </button>
              <div className="h-px bg-slate-100 my-1" />
              <button
                onClick={async () => {
                  try { await logoutAction(); window.location.href = "/login"; }
                  catch (err) { console.error(err); }
                }}
                className="w-full text-left px-4 py-2.5 text-sm font-bold text-rose-500 hover:bg-rose-50 transition-colors flex items-center gap-2.5"
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
