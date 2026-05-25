"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type NavItem = { href: string; label: string; icon: React.ReactNode };

const Icon = ({ d, d2 }: { d: string; d2?: string }) => (
  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />{d2 && <path d={d2} />}
  </svg>
);

const icons = {
  dashboard:    <Icon d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />,
  customers:    <Icon d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />,
  subscription: <Icon d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />,
  visits:       <Icon d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />,
  visitors:     <Icon d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
  followup:     <Icon d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  audit:        <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  users:        <Icon d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />,
  settings:     <Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" d2="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />,
  search:       <Icon d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
  bell:         <Icon d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />,
  logout:       <Icon d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
};

const mainNav: NavItem[]  = [{ href: "/dashboard",          label: "Dashboard",     icon: icons.dashboard }];
const crmNav: NavItem[]   = [
  { href: "/customer-master",    label: "Customers",     icon: icons.customers },
  { href: "/subscription",       label: "Subscriptions", icon: icons.subscription },
  { href: "/marketing-log",      label: "Visits",        icon: icons.visits },
  { href: "/visitor-management", label: "Visitors",      icon: icons.visitors },
  { href: "/follow-up",          label: "Follow-ups",    icon: icons.followup },
];
const adminNav: NavItem[] = [
  { href: "/audit-logs",   label: "Audit Log", icon: icons.audit },
  { href: "/user-master",  label: "Users",     icon: icons.users },
  { href: "/settings",     label: "Settings",  icon: icons.settings },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group
        ${active ? "bg-white/[0.13] text-white" : "text-white/50 hover:text-white hover:bg-white/[0.07]"}`}
    >
      <span className={`transition-colors ${active ? "text-white" : "text-white/40 group-hover:text-white/70"}`}>
        {item.icon}
      </span>
      {item.label}
    </Link>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/user/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const pageTitle = pathname.split("/").filter(Boolean).pop()?.replace(/-/g, " ") || "Dashboard";

  return (
    <div className="flex h-screen overflow-hidden bg-[#F0F2F5]">

      {/* ── Sidebar ── */}
      <aside className="hidden md:flex w-[240px] shrink-0 bg-[#0D2137] flex-col h-full z-20">
        {/* Logo */}
        <div className="px-5 pt-6 pb-5 border-b border-white/[0.07] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 flex items-center justify-center shrink-0">
              <img src="/logo.png" alt="Suki ERP" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="text-white text-base font-bold leading-tight">Suki ERP</p>
              <p className="text-white/40 text-[11px] leading-tight mt-0.5">Marketing CRM</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {mainNav.map(item => <NavLink key={item.href} item={item} active={pathname === item.href} />)}

          <div className="pt-5 pb-1.5">
            <p className="px-3.5 text-[10px] font-semibold text-white/25 uppercase tracking-widest">CRM</p>
          </div>
          {crmNav.map(item => <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />)}

          <div className="pt-5 pb-1.5">
            <p className="px-3.5 text-[10px] font-semibold text-white/25 uppercase tracking-widest">Admin</p>
          </div>
          {adminNav.map(item => <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />)}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-white/[0.07] shrink-0">
          <div onClick={handleLogout} className="flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group">
            <img src="https://i.pravatar.cc/150?u=admin" alt="Admin" className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0" />
            <div className="flex-1 overflow-hidden">
              <p className="text-white text-xs font-semibold leading-tight truncate">Admin User</p>
              <p className="text-white/30 text-[10px] leading-tight truncate">System Administrator</p>
            </div>
            <span className="text-white/20 group-hover:text-white/50 transition-colors shrink-0">{icons.logout}</span>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200/80 flex items-center justify-between px-6 lg:px-8 shrink-0 z-10">
          <h1 className="text-lg font-bold text-slate-800 capitalize">{pageTitle}</h1>
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">{icons.search}</span>
              <input
                type="text"
                placeholder="General search…"
                className="w-56 pl-10 pr-4 py-2 rounded-xl bg-slate-100 text-sm text-slate-700 placeholder:text-slate-400 border border-slate-200/60 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition"
              />
            </div>
            <button className="relative w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors border border-slate-200/60">
              {icons.bell}
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white" />
            </button>
            <img src="https://i.pravatar.cc/150?u=admin" alt="Admin" className="w-9 h-9 rounded-xl object-cover border-2 border-slate-200 cursor-pointer" />
          </div>
        </header>

        {/* Scrollable page content */}
        <div className="flex-1 overflow-auto p-5 lg:p-7 pb-8">
          {children}
        </div>
      </main>
    </div>
  );
}
