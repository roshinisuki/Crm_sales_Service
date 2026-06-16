"use client";

import { useState } from "react";
import CollapsibleSidebar from "./CollapsibleSidebar";
import { cn } from "@/lib/ui-utils";

interface CollapsibleSidebarLayoutProps {
  children: React.ReactNode;
  user?: any;
  loading?: boolean;
  onLogout?: () => void;
}

export default function CollapsibleSidebarLayout({
  children,
  user,
  loading,
  onLogout,
}: CollapsibleSidebarLayoutProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar-collapsed") === "true";
  });

  // Listen for localStorage changes from sidebar
  useState(() => {
    const handleStorageChange = () => {
      setCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  });

  return (
    <div className={cn("flex h-screen overflow-hidden bg-[var(--background)]", collapsed ? "sidebar-collapsed" : "")}>
      {/* Sidebar */}
      <CollapsibleSidebar user={user} loading={loading} onLogout={onLogout} />

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300",
          collapsed ? "ml-[72px]" : "ml-[240px]"
        )}
      >
        {children}
      </main>
    </div>
  );
}

// Alternative: Using the sidebar's internal state
export function SidebarWithInternalState({ children, user, loading, onLogout }: CollapsibleSidebarLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      <CollapsibleSidebar user={user} loading={loading} onLogout={onLogout} />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
