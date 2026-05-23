import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar (Desktop) */}
      <aside className="hidden w-[260px] bg-[#1a1f3c] text-white md:flex flex-col rounded-tr-3xl shadow-xl z-20">
        <div className="p-8 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
            {/* Simple logo */}
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-[#1a1f3c]" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-bold text-xl tracking-tight">SUKI CRM</span>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto pb-4">
          <NavItem href="/dashboard" icon={<DashboardIcon />} label="Dashboard" active />
          <NavItem href="/user-master" icon={<UsersIcon />} label="User Master" />
          <NavItem href="/customer-master" icon={<CustomerIcon />} label="Customer Master" />
          <NavItem href="/subscription" icon={<SubscriptionIcon />} label="Subscription" />
          <NavItem href="/marketing-log" icon={<MarketingIcon />} label="Marketing Log" />
          <NavItem href="/visitor-management" icon={<VisitorIcon />} label="Visitor Management" />
          <NavItem href="/follow-up" icon={<FollowUpIcon />} label="Follow-up" />
          <NavItem href="/reports" icon={<ReportsIcon />} label="Reports" />
          <NavItem href="/audit-logs" icon={<AuditIcon />} label="Audit Logs" />
          <div className="pt-4 mt-4 border-t border-white/10">
            <NavItem href="/settings" icon={<SettingsIcon />} label="Settings" />
            <NavItem href="/help" icon={<HelpIcon />} label="Help" />
          </div>
        </nav>

        {/* User Profile pinned at bottom */}
        <div className="p-4 m-4 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3 cursor-pointer hover:bg-white/10 transition-colors">
          <div className="w-10 h-10 rounded-full bg-slate-400 overflow-hidden shrink-0">
             <img src="https://i.pravatar.cc/150?u=admin" alt="Admin" className="w-full h-full object-cover" />
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-semibold truncate">Admin User</p>
            <p className="text-xs text-slate-400 truncate">System Administrator</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-20 bg-white/50 backdrop-blur-sm border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-10">
          <div className="flex-1">
            {/* Mobile menu toggle could go here */}
          </div>
          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="w-64 pl-10 pr-4 py-2 rounded-full bg-slate-100 border-none text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <button className="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors">
              <BellIcon className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors">
              <CalendarIcon className="w-5 h-5" />
            </button>
             <div className="w-10 h-10 rounded-full bg-slate-400 overflow-hidden shrink-0 border-2 border-white shadow-sm sm:hidden cursor-pointer">
                 <img src="https://i.pravatar.cc/150?u=admin" alt="Admin" className="w-full h-full object-cover" />
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-auto p-4 sm:p-8">
          {children}
        </div>
      </main>
      
      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#1a1f3c] text-white flex justify-around p-3 z-30 rounded-t-2xl shadow-2xl">
         <Link href="/dashboard" className="flex flex-col items-center gap-1 p-2 text-cyan-400">
            <DashboardIcon className="w-5 h-5" />
            <span className="text-[10px]">Dashboard</span>
         </Link>
         <Link href="/customer-master" className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-white">
            <CustomerIcon className="w-5 h-5" />
            <span className="text-[10px]">Customers</span>
         </Link>
         <Link href="/marketing-log" className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-white">
            <MarketingIcon className="w-5 h-5" />
            <span className="text-[10px]">Logs</span>
         </Link>
         <Link href="/reports" className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-white">
            <ReportsIcon className="w-5 h-5" />
            <span className="text-[10px]">Reports</span>
         </Link>
      </div>
    </div>
  );
}

function NavItem({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <Link 
      href={href} 
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
        active 
          ? "bg-[#00e5ff] text-[#1a1f3c] font-semibold shadow-[0_0_15px_rgba(0,229,255,0.3)]" 
          : "text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      <div className={`w-5 h-5 flex items-center justify-center ${active ? "text-[#1a1f3c]" : "text-slate-400"}`}>
        {icon}
      </div>
      <span className="text-sm">{label}</span>
    </Link>
  );
}

// Inline Icons for Layout

function DashboardIcon({ className = "w-full h-full" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
}
function UsersIcon({ className = "w-full h-full" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
}
function CustomerIcon({ className = "w-full h-full" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
}
function SubscriptionIcon({ className = "w-full h-full" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
}
function MarketingIcon({ className = "w-full h-full" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>;
}
function VisitorIcon({ className = "w-full h-full" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
function FollowUpIcon({ className = "w-full h-full" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
}
function ReportsIcon({ className = "w-full h-full" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
}
function AuditIcon({ className = "w-full h-full" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
}
function SettingsIcon({ className = "w-full h-full" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}
function HelpIcon({ className = "w-full h-full" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
function SearchIcon({ className = "w-full h-full" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
}
function BellIcon({ className = "w-full h-full" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
}
function CalendarIcon({ className = "w-full h-full" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
}
