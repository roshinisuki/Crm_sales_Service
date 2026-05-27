"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const icons = {
  search: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  bell: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
  menu: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>,
  check: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
};

export default function DashboardHeader({
  pageTitle,
  user,
  setDrawerOpen
}: {
  pageTitle: string;
  user: any;
  setDrawerOpen: (v: boolean) => void;
}) {
  const router = useRouter();

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ customers: any[], visits: any[], visitors: any[] } | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Notification State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    // Close dropdowns on click outside
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch Notifications
  useEffect(() => {
    if (user) {
      fetch("/api/notifications")
        .then(res => res.json())
        .then(data => {
          if (data.success) setNotifications(data.data);
        })
        .catch(console.error);
    }
  }, [user]);

  // Handle Search Debounce
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setSearchResults(data.data);
            setIsSearchOpen(true);
          }
        })
        .catch(console.error);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications", { method: "PATCH" });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (e) {
      console.error(e);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <header className="h-14 md:h-16 bg-white border-b border-slate-200/80 flex items-center justify-between px-4 md:px-6 lg:px-8 shrink-0 z-10 relative">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setDrawerOpen(true)}
          className="md:hidden w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors border border-slate-200/60"
        >
          {icons.menu}
        </button>
        <h1 className="text-base md:text-lg font-bold text-slate-800 capitalize">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* Global Search */}
        <div className="relative hidden sm:block" ref={searchRef}>
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">{icons.search}</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            placeholder="Search customers, visits..."
            className="w-44 md:w-64 pl-10 pr-4 py-2 rounded-xl bg-slate-100 text-sm text-slate-700 placeholder:text-slate-400 border border-slate-200/60 focus:outline-none focus:ring-2 focus:ring-[#0D2137] transition"
          />

          {isSearchOpen && searchResults && (
            <div className="absolute top-full mt-2 w-full lg:w-80 right-0 bg-white border border-slate-200 shadow-xl rounded-2xl overflow-hidden z-50">
              <div className="max-h-80 overflow-y-auto">
                {searchResults.customers.length === 0 && searchResults.visits.length === 0 && searchResults.visitors.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500 font-semibold">No results found.</div>
                ) : (
                  <>
                    {searchResults.customers.length > 0 && (
                      <div className="p-2">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">Customers</h4>
                        {searchResults.customers.map((c: any) => (
                          <div 
                            key={c.id} 
                            onClick={() => { router.push("/customer-master"); setIsSearchOpen(false); }}
                            className="p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                          >
                            <p className="text-xs font-bold text-slate-800 truncate">{c.name}</p>
                            <p className="text-[10px] text-slate-500 truncate">{c.customerCode} • {c.email || c.phone}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {searchResults.visits.length > 0 && (
                      <div className="p-2 border-t border-slate-100">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">Visits</h4>
                        {searchResults.visits.map((v: any) => (
                          <div 
                            key={v.id} 
                            onClick={() => { router.push("/marketing-log"); setIsSearchOpen(false); }}
                            className="p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                          >
                            <p className="text-xs font-bold text-slate-800 truncate">{v.customer?.name}</p>
                            <p className="text-[10px] text-slate-500 truncate">Rep: {v.executive?.name}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {searchResults.visitors.length > 0 && (
                      <div className="p-2 border-t border-slate-100">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">Visitors</h4>
                        {searchResults.visitors.map((v: any) => (
                          <div 
                            key={v.id} 
                            onClick={() => { router.push("/visitor-management"); setIsSearchOpen(false); }}
                            className="p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                          >
                            <p className="text-xs font-bold text-slate-800 truncate">{v.visitorName}</p>
                            <p className="text-[10px] text-slate-500 truncate">{v.company}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="relative w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors border border-slate-200/60"
          >
            {icons.bell}
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white animate-pulse" />
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute top-full mt-2 w-72 md:w-80 right-0 bg-white border border-slate-200 shadow-xl rounded-3xl overflow-hidden z-50 flex flex-col">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="text-sm font-bold text-slate-800">Notifications</h3>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-[10px] font-bold text-[#1a6bff] hover:text-blue-800 flex items-center gap-1 transition-colors">
                    {icons.check} Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs font-semibold">No notifications</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {notifications.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => markAsRead(n.id)}
                        className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors ${n.isRead ? "opacity-60" : "bg-blue-50/20"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs truncate ${n.isRead ? "font-semibold text-slate-600" : "font-bold text-slate-800"}`}>
                              {n.title}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                            <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-widest">
                              {new Date(n.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1" />}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Thumbnail */}
        <img 
          src={user?.profilePhoto || `https://i.pravatar.cc/150?u=${user?.email || "admin"}`} 
          alt="User" 
          onClick={() => router.push("/profile")}
          className="w-8 h-8 md:w-9 md:h-9 rounded-xl object-cover border-2 border-slate-200 cursor-pointer hover:border-[#0D2137] transition-all" 
        />
      </div>
    </header>
  );
}
