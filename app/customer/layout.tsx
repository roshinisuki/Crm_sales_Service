import React from "react";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { redirect } from "next/navigation";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] font-sans text-[var(--text-primary)]">
      <header className="bg-[var(--surface)] border-b border-[var(--border)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-[var(--primary)] text-[var(--accent-contrast)] flex items-center justify-center font-bold text-sm">
                S
              </div>
              <span className="font-semibold text-lg text-[var(--text-primary)]">Customer Portal</span>
            </div>
            <nav className="hidden md:flex items-center gap-6 ml-4">
              <Link href="/customer/portal" className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors py-2">
                Subscriptions & Profile
              </Link>
              <Link href="/customer/support" className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors py-2">
                Support & IT Requests
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex md:hidden items-center gap-3 mr-2 border-r pr-3 border-[var(--border)]">
              <Link href="/customer/portal" className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--primary)]">Subscriptions</Link>
              <Link href="/customer/support" className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--primary)]">Support</Link>
            </div>
            <form action={async () => {
              "use server";
              await logoutAction();
              redirect("/login");
            }}>
              <button className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
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
