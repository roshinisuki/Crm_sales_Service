"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { logoutAction } from "@/app/actions/auth";
import { useEffect, useState } from "react";
import DashboardHeader from "@/components/DashboardHeader";
import MobileBottomNav from "@/components/MobileBottomNav";
import { cn } from "@/lib/ui-utils";
import {
  LayoutDashboard, Users, CalendarClock, Briefcase, BookUser,
  CheckSquare, Settings, LogOut, Menu, X, TrendingUp, MapPin, Building,
  ChevronDown, ChevronUp, FileText, Scale, LineChart, Coins, Building2, ShieldCheck, PieChart, Activity, ContactRound, ListTodo
} from "lucide-react";

// ─── Nav definitions ─────────────────────────────────────────────────────────

type NavItem = { href: string; label: string; icon: React.ReactNode; end?: boolean };

// ─── NavLink ──────────────────────────────────────────────────────────────────

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-150 group relative",
        active
          ? "bg-[var(--sidebar-active-bg)] text-white font-semibold"
          : "text-white hover:bg-white/[0.06]",
      )}
    >
      {/* Active indicator */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[var(--primary)] rounded-r-full" />
      )}
      <span className={cn("nav-icon transition-colors shrink-0", active ? "text-[var(--primary)]" : "text-white")}>
        {item.icon}
      </span>
      <span className="nav-label whitespace-nowrap transition-all duration-300 overflow-hidden">{item.label}</span>
    </Link>
  );
}

// ─── ExpandableNavSection ─────────────────────────────────────────────────────

function ExpandableNavSection({
  label,
  icon,
  subItems,
  pathname,
  onNavClick,
}: {
  label: string;
  icon: React.ReactNode;
  subItems: { href: string; label: string }[];
  pathname: string;
  onNavClick?: () => void;
}) {
  const searchParams = useSearchParams();
  const searchString = searchParams ? searchParams.toString() : "";

  const isSectionActive = subItems.some((item) => {
    const [path, query] = item.href.split("?");
    if (query) {
      return pathname.startsWith(path) && searchString.includes(query);
    }
    return pathname === path;
  });

  const [isOpen, setIsOpen] = useState(isSectionActive);

  // Auto open if section becomes active
  useEffect(() => {
    if (isSectionActive) setIsOpen(true);
  }, [isSectionActive]);

  return (
    <div className="space-y-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-150 text-white hover:bg-white/[0.06] group",
          isSectionActive ? "bg-white/[0.04]" : ""
        )}
      >
        <div className="flex items-center gap-3">
          <span className={cn("nav-icon transition-colors shrink-0 text-white group-hover:text-[var(--primary)]", isSectionActive ? "text-[var(--primary)]" : "")}>
            {icon}
          </span>
          <span className="nav-label whitespace-nowrap transition-all duration-300 overflow-hidden">{label}</span>
        </div>
        <span className="nav-label text-white/40 group-hover:text-white transition-colors overflow-hidden">
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>
      
      {isOpen && (
        <div className="nav-label overflow-hidden pl-4 pr-1 py-1 space-y-1 border-l border-white/10 ml-5">
          {subItems.map((sub) => {
            const [path, query] = sub.href.split("?");
            const isActive = pathname.startsWith(path) && (!query || searchString.includes(query));
            return (
              <Link
                key={`${sub.href}-${sub.label}`}
                href={sub.href}
                onClick={onNavClick}
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

// ─── NestedGroupSection (Sub-level Accordion) ──────────────────────────────

function NestedGroupSection({
  sec,
  pathname,
  searchString,
  onNavClick,
}: {
  sec: { label: string; subItems: { href: string; label: string }[] };
  pathname: string;
  searchString: string;
  onNavClick?: () => void;
}) {
  const isSecActive = sec.subItems.some((item) => {
    const [path, query] = item.href.split("?");
    if (query) return pathname.startsWith(path) && searchString.includes(query);
    return pathname === path;
  });

  const [isOpen, setIsOpen] = useState(isSecActive);

  useEffect(() => {
    if (isSecActive) setIsOpen(true);
  }, [isSecActive]);

  return (
    <div className="space-y-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-[12.5px] font-semibold text-white/70 hover:text-white hover:bg-white/[0.04] transition-all duration-100 group"
      >
        <span className={isSecActive ? "text-[var(--primary)]" : ""}>{sec.label}</span>
        <span className="text-white/30 group-hover:text-white/50 transition-colors">
          {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>

      {isOpen && (
        <div className="nav-label overflow-hidden pl-3 pr-1 py-1 space-y-1 border-l border-white/5 ml-1">
          {sec.subItems.map((sub) => {
            const [path, query] = sub.href.split("?");
            const isActive = pathname.startsWith(path) && (!query || searchString.includes(query));
            return (
              <Link
                key={`${sub.href}-${sub.label}`}
                href={sub.href}
                onClick={onNavClick}
                className={cn(
                  "flex items-center py-1.5 px-2 rounded-md text-[11.5px] font-medium transition-all duration-100",
                  isActive
                    ? "text-[var(--primary)] font-semibold bg-white/[0.02]"
                    : "text-white/50 hover:text-white hover:bg-white/[0.02]"
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

// ─── ExpandableGroup (Multi-level) ───────────────────────────────────────────

function ExpandableGroup({
  label,
  icon,
  sections,
  pathname,
  onNavClick,
}: {
  label: string;
  icon: React.ReactNode;
  sections: {
    label: string;
    subItems: { href: string; label: string }[];
  }[];
  pathname: string;
  onNavClick?: () => void;
}) {
  const searchParams = useSearchParams();
  const searchString = searchParams ? searchParams.toString() : "";

  const isGroupActive = sections.some(sec => sec.subItems.some((item) => {
    const [path, query] = item.href.split("?");
    if (query) return pathname.startsWith(path) && searchString.includes(query);
    return pathname === path;
  }));

  const [isOpen, setIsOpen] = useState(isGroupActive);

  useEffect(() => {
    if (isGroupActive) setIsOpen(true);
  }, [isGroupActive]);

  return (
    <div className="space-y-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-150 text-white hover:bg-white/[0.06] group",
          isGroupActive ? "bg-[var(--sidebar-active-bg)]/60" : ""
        )}
      >
        <div className="flex items-center gap-3">
          <span className={cn("nav-icon transition-colors shrink-0 text-white group-hover:text-[var(--primary)]", isGroupActive ? "text-[var(--primary)]" : "")}>
            {icon}
          </span>
          <span className="nav-label whitespace-nowrap transition-all duration-300 overflow-hidden">{label}</span>
        </div>
        <span className="nav-label text-white/40 group-hover:text-white transition-colors overflow-hidden">
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>
      
      {isOpen && (
        <div className="nav-label overflow-hidden pl-4 pr-1 py-2 space-y-1 border-l border-white/10 ml-5 mt-1">
          {sections.map((sec, idx) => (
            <NestedGroupSection 
              key={idx} 
              sec={sec} 
              pathname={pathname} 
              searchString={searchString} 
              onNavClick={onNavClick} 
            />
          ))}
        </div>
      )}
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
}: {
  pathname: string;
  user: any;
  loading: boolean;
  handleLogout: () => void;
  onNavClick?: () => void;
}) {
  const isActive = (item: NavItem) =>
    item.end ? pathname === item.href : pathname.startsWith(item.href);

  // Submenu definitions (Phase 1 CRM Navigation Architecture)
  const leadSubItems = [
    { href: "/leads", label: "All Leads" },
    { href: "/leads?status=FollowupDue", label: "Follow-up Due" },
    { href: "/leads?status=Qualified", label: "Sales Qualified Leads (SQL)" },
    { href: "/leads?status=Overdue", label: "Overdue Leads" },
    { href: "/leads?status=Lost", label: "Lost Leads" },
  ];

  const activitySubItems = [
    { href: "/activities?status=Pending", label: "Pending Activities" },
    { href: "/activities?status=Completed", label: "Completed Activities" },
    { href: "/activities/call-logs", label: "Call Logs" },
  ];

  const visitSubItems = [
    { href: "/marketing-log", label: "Marketing Visits" },
    { href: "/visitor-management", label: "Office Visits" },
  ];

  const dealSubItems = [
    { href: "/deals?status=Active", label: "Active Deals" },
    { href: "/deals?status=Won", label: "Won Deals" },
    { href: "/deals?status=Lost", label: "Lost Deals" },
  ];

  const salesPipelineSections = [
    {
      label: "Sales Opportunities",
      subItems: [
        { href: "/sales-pipeline", label: "All Sales" },
        { href: "/sales-pipeline?stage=RequirementGathering", label: "Requirement Gathering" },
        { href: "/sales-pipeline?stage=PreSalesReview", label: "Pre-Sales Review" },
        { href: "/sales-pipeline?stage=MeetingScheduled", label: "Meeting Scheduled" },
        { href: "/sales-pipeline?stage=DemoConducted", label: "Demo Conducted" },
        { href: "/sales-pipeline?stage=RejectedDemo", label: "Rejected Demo" },
        { href: "/sales-pipeline?stage=Overdue", label: "Overdue" },
      ]
    },
    {
      label: "Proposal Management",
      subItems: [
        { href: "/proposals", label: "All Proposals" },
        { href: "/proposals?status=Draft", label: "Draft" },
        { href: "/proposals?status=Sent", label: "Sent" },
        { href: "/proposals?status=CustomerReviewing", label: "Customer Reviewing" },
        { href: "/proposals?status=RevisionRequested", label: "Revision Requested" },
        { href: "/proposals?status=Accepted", label: "Accepted" },
        { href: "/proposals?status=Rejected", label: "Rejected" },
        { href: "/proposals?status=Expired", label: "Expired" },
      ]
    },
    {
      label: "Negotiations",
      subItems: [
        { href: "/negotiations", label: "All Negotiations" },
        { href: "/negotiations?view=active", label: "Active Negotiations" },
        { href: "/negotiations?view=approval", label: "Pending Approval" },
        { href: "/negotiations?view=approved", label: "Approved" },
        { href: "/negotiations?view=closed", label: "Closed" },
      ]
    }
  ];

  const customerSubItems = [
    { href: "/customers", label: "All Customers" },
    { href: "/customers?status=Active", label: "Active Customers" },
    { href: "/customers?status=RenewalDue", label: "Renewal Due" },
    { href: "/customers?status=Renewed", label: "Renewed" },
    { href: "/customers?status=Expired", label: "Expired" },
  ];
  
  const userManagementSubItems = [
    { href: "/user-master", label: "Users" },
    { href: "/settings?tab=permissions", label: "Roles & Permissions" },
    { href: "/settings?tab=approval-matrix", label: "Approval Matrix" },
  ];

  const settingsSubItems = [
    { href: "/settings/lead-sources", label: "Lead Sources" },
    { href: "/settings/pipeline-stages", label: "Pipeline Stages" },
    { href: "/settings/deal-types", label: "Deal Types" },
    { href: "/settings/visit-types", label: "Visit Types" },
    { href: "/settings/lost-reasons", label: "Lost Reasons" },
    { href: "/settings/subscription-types", label: "Subscription Types" },
    { href: "/settings/custom-fields", label: "Custom Fields" },
    { href: "/settings/notifications", label: "Notification Settings" },
    { href: "/settings/email-templates", label: "Email Templates" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* ── Logo ── */}
      <div className="px-5 pt-6 pb-5 shrink-0 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center shrink-0">
            <img src="/logo.png" alt="SUKI CRM" className="w-12 h-12 object-contain" onError={(e: any) => { e.target.style.display='none'; }} />
          </div>
          <div className="nav-label transition-all duration-300 overflow-hidden whitespace-nowrap">
            <p className="text-white text-[15px] font-black leading-tight tracking-wide">SUKI CRM</p>
            <p className="text-white text-[10px] font-medium tracking-wide mt-0.5">Customer Relationship</p>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
        
        {/* ── Dashboard ── */}
        <NavLink item={{ href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={17} />, end: true }} active={pathname === "/dashboard"} onClick={onNavClick} />

        {/* ── Internal CRM staff nav (Admin, SalesManager, SalesExecutive) ── */}
        {!loading && user?.role !== "Customer" && user?.role !== "SuperAdmin" && (
          <>
            <ExpandableNavSection label="Leads" icon={<Users size={17} />} subItems={leadSubItems} pathname={pathname} onNavClick={onNavClick} />
            <ExpandableNavSection label="Activities" icon={<Activity size={17} />} subItems={activitySubItems} pathname={pathname} onNavClick={onNavClick} />
            <NavLink item={{ href: "/contacts", label: "Contacts", icon: <ContactRound size={17} /> }} active={pathname.startsWith("/contacts")} onClick={onNavClick} />
            <NavLink item={{ href: "/tasks", label: "Tasks", icon: <ListTodo size={17} /> }} active={pathname.startsWith("/tasks")} onClick={onNavClick} />
            <ExpandableNavSection label="Visits" icon={<MapPin size={17} />} subItems={visitSubItems} pathname={pathname} onNavClick={onNavClick} />
            <ExpandableNavSection label="Deals" icon={<Briefcase size={17} />} subItems={dealSubItems} pathname={pathname} onNavClick={onNavClick} />
            
            {/* The multi-level Sales Pipeline */}
            <ExpandableGroup label="Sales Pipeline" icon={<TrendingUp size={17} />} sections={salesPipelineSections} pathname={pathname} onNavClick={onNavClick} />

            <NavLink item={{ href: "/forecast", label: "Forecast", icon: <LineChart size={17} /> }} active={pathname.startsWith("/forecast")} onClick={onNavClick} />
            
            <ExpandableNavSection label="Customers" icon={<BookUser size={17} />} subItems={customerSubItems} pathname={pathname} onNavClick={onNavClick} />
            
            <NavLink item={{ href: "/reports", label: "Reports", icon: <PieChart size={17} /> }} active={pathname.startsWith("/reports")} onClick={onNavClick} />
          </>
        )}

        {/* ── SuperAdmin platform nav ── */}
        {!loading && user?.role === "SuperAdmin" && (
          <>
            <div className="pt-3 pb-1">
              <p className="nav-label px-3 text-[10px] font-bold text-white/30 uppercase tracking-widest overflow-hidden whitespace-nowrap">Platform Admin</p>
            </div>
            <NavLink item={{ href: "/admin/companies", label: "Companies", icon: <Building2 size={17} /> }} active={pathname.startsWith("/admin/companies")} onClick={onNavClick} />
            <NavLink item={{ href: "/admin/system-configs", label: "System Configs", icon: <Settings size={17} /> }} active={pathname.startsWith("/admin/system-configs")} onClick={onNavClick} />
          </>
        )}

        {/* ── Customer portal nav ── */}
        {!loading && user?.role === "Customer" && (
          <>
            <NavLink item={{ href: "/subscription", label: "My Subscriptions", icon: <Briefcase size={17} /> }} active={pathname.startsWith("/subscription")} onClick={onNavClick} />
            <NavLink item={{ href: "/customer/support", label: "Support Tickets", icon: <CheckSquare size={17} /> }} active={pathname.startsWith("/customer/support")} onClick={onNavClick} />
          </>
        )}

        {/* ── Settings & Admin (Internal CRM) ── */}
        {!loading && ["Admin", "SalesManager"].includes(user?.role ?? "") && (
          <>
            <div className="pt-4 pb-2 border-t border-white/[0.06] mt-4">
              <p className="nav-label px-3 text-[10px] font-bold text-white/40 uppercase tracking-widest overflow-hidden whitespace-nowrap">System Management</p>
            </div>
            <ExpandableNavSection label="User Management" icon={<Users size={17} />} subItems={userManagementSubItems} pathname={pathname} onNavClick={onNavClick} />
            <NavLink item={{ href: "/audit-logs", label: "Audit Logs", icon: <ShieldCheck size={17} /> }} active={pathname.startsWith("/audit-logs")} onClick={onNavClick} />
            <ExpandableNavSection label="Settings" icon={<Settings size={17} />} subItems={settingsSubItems} pathname={pathname} onNavClick={onNavClick} />
          </>
        )}

        {/* ── Notifications self-service — SalesExecutive ── */}
        {!loading && user?.role === "SalesExecutive" && (
          <>
            <div className="pt-4 pb-2 border-t border-white/[0.06] mt-4">
              <p className="nav-label px-3 text-[10px] font-bold text-white/40 uppercase tracking-widest overflow-hidden whitespace-nowrap">Settings</p>
            </div>
            <NavLink item={{ href: "/settings?tab=notifications", label: "Notifications", icon: <Settings size={17} /> }} active={pathname.startsWith("/settings")} onClick={onNavClick} />
          </>
        )}
      </nav>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    const saved = localStorage.getItem("crm-sidebar-collapsed");
    if (saved === "true") setIsCollapsed(true);

    const savedMode = localStorage.getItem("crm-theme-mode") || "light";
    if (savedMode === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("crm-sidebar-collapsed", String(next));
  };

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await logoutAction();
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">

      {/* ── Desktop Sidebar ── */}
      <aside
        className={cn("hidden md:flex shrink-0 flex-col h-full z-20 shadow-xl transition-[width,min-width] duration-300 ease-in-out group", isCollapsed ? "collapsed" : "")}
        style={{ width: isCollapsed ? "var(--sidebar-collapsed, 52px)" : "var(--sidebar-width, 220px)", background: "var(--sidebar-bg)" }}
      >
        <SidebarContent
          pathname={pathname}
          user={user}
          loading={loading}
          handleLogout={handleLogout}
        />
      </aside>

      {/* ── Mobile Drawer Overlay ── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile Drawer Panel ── */}
      <aside
        style={{ background: "var(--sidebar-bg)" }}
        className={cn(
          "fixed top-0 left-0 h-full w-[260px] flex flex-col z-50 md:hidden transition-transform duration-300 ease-in-out shadow-2xl",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <button
          onClick={() => setDrawerOpen(false)}
          className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-colors z-10"
        >
          <X size={16} />
        </button>
        <SidebarContent
          pathname={pathname}
          user={user}
          loading={loading}
          handleLogout={handleLogout}
          onNavClick={() => setDrawerOpen(false)}
        />
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader pageTitle="" user={user} setDrawerOpen={setDrawerOpen} toggleCollapse={toggleCollapse} isCollapsed={isCollapsed} />

        <div className="flex-1 overflow-auto p-4 md:px-5 lg:px-5 md:py-3 lg:py-3 pb-24 md:pb-6">
          {children}
        </div>

        {user && ["SalesExecutive", "SalesManager"].includes(user.role) && (
          <MobileBottomNav setDrawerOpen={setDrawerOpen} />
        )}
      </main>
    </div>
  );
}
