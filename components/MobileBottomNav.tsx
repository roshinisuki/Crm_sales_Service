"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MobileBottomNav({ setDrawerOpen }: { setDrawerOpen: (o: boolean) => void }) {
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", label: "Home", icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )},
    { href: "/leads", label: "Leads", icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )},
    { href: "/marketing-log", label: "Check-In", icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )},
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 w-full bg-[#151515] border-t border-slate-800/40 flex items-center justify-around z-40 pb-safe">
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <Link key={item.href} href={item.href} className={`flex flex-col items-center justify-center w-full py-3 gap-1 transition-colors ${isActive ? "text-[#C2601A] bg-[#1A1A1A]" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
            <div className={`${isActive ? "bg-[#C2601A]/10 text-[#C2601A] p-1.5 rounded-full" : "p-1.5"}`}>
              {item.icon}
            </div>
            <span className="text-[10px] font-bold">{item.label}</span>
          </Link>
        );
      })}
      
      <button onClick={() => setDrawerOpen(true)} className="flex flex-col items-center justify-center w-full py-3 gap-1 text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
        <div className="p-1.5">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </div>
        <span className="text-[10px] font-bold">More</span>
      </button>
    </div>
  );
}
