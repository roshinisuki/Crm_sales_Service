import React from "react";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { redirect } from "next/navigation";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f9fb] font-sans text-slate-800">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#0b1f3a] text-white flex items-center justify-center font-bold text-sm">
              S
            </div>
            <span className="font-semibold text-lg text-slate-800">Customer Portal</span>
          </div>
          <div className="flex items-center gap-4">
            <form action={logoutAction}>
              <button className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
