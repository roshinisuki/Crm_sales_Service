"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/ui-utils";
import { FolderTree, Package, SlidersHorizontal, FileText, BookOpen } from "lucide-react";

const NAV_ITEMS = [
  { label: "Categories", href: "/catalogue/categories", icon: FolderTree },
  { label: "Products", href: "/catalogue/products", icon: Package },
  { label: "Specifications", href: "/catalogue/specifications", icon: SlidersHorizontal },
  { label: "Datasheets", href: "/catalogue/datasheets", icon: FileText },
  { label: "Brochures", href: "/catalogue/brochures", icon: BookOpen },
];

export default function CatalogueLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-full bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
      {/* Left Panel: Navigation */}
      <div className="w-64 border-r border-border shrink-0 bg-page-bg flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-text-primary text-sm uppercase tracking-wider">Product Catalogue</h2>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium text-[13px]",
                  isActive
                    ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "text-text-secondary hover:bg-border-subtle hover:text-text-primary"
                )}
              >
                <item.icon size={18} className={isActive ? "text-[var(--primary)]" : "text-text-muted"} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Center & Right Panels */}
      <div className="flex-1 flex min-w-0 overflow-hidden bg-card">
        {children}
      </div>
    </div>
  );
}
