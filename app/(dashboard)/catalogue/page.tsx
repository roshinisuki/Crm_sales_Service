"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/PageShell";
import { cn } from "@/lib/ui-utils";
import {
  FolderTree, Package, SlidersHorizontal, FileText,
  BookOpen, ArrowRight, Sparkles,
} from "lucide-react";

const MODULES = [
  {
    title: "Categories",
    description: "Organize products into hierarchical categories with attributes and sub-categories.",
    href: "/catalogue/categories",
    icon: FolderTree,
    color: "from-blue-500 to-indigo-600",
    iconBg: "bg-blue-50 text-blue-600",
    statKey: "categories" as const,
  },
  {
    title: "Products",
    description: "Manage your full product inventory with pricing, variants, tags and availability.",
    href: "/catalogue/products",
    icon: Package,
    color: "from-emerald-500 to-teal-600",
    iconBg: "bg-emerald-50 text-emerald-600",
    statKey: "products" as const,
  },
  {
    title: "Specifications",
    description: "Define specification groups and attribute fields mapped to product categories.",
    href: "/catalogue/specifications",
    icon: SlidersHorizontal,
    color: "from-violet-500 to-purple-600",
    iconBg: "bg-violet-50 text-violet-600",
  },
  {
    title: "Datasheets",
    description: "Upload and manage technical datasheets with version control and document preview.",
    href: "/catalogue/datasheets",
    icon: FileText,
    color: "from-amber-500 to-orange-600",
    iconBg: "bg-amber-50 text-amber-600",
    statKey: "datasheets" as const,
  },
  {
    title: "Brochures",
    description: "Create and publish marketing brochures with cover images and campaign metadata.",
    href: "/catalogue/brochures",
    icon: BookOpen,
    color: "from-rose-500 to-pink-600",
    iconBg: "bg-rose-50 text-rose-600",
    statKey: "brochures" as const,
  },
];

export default function CatalogueLandingPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Record<string, number>>({});

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [catRes, prodRes, dsRes, brRes] = await Promise.all([
          fetch("/api/catalogue/categories"),
          fetch("/api/catalogue/products?pageSize=1"),
          fetch("/api/catalogue/datasheets"),
          fetch("/api/catalogue/brochures"),
        ]);
        const [catData, prodData, dsData, brData] = await Promise.all([
          catRes.json(),
          prodRes.json(),
          dsRes.json(),
          brRes.json(),
        ]);
        setStats({
          categories: catData.success ? catData.data?.length ?? 0 : 0,
          products: prodData.success ? prodData.pagination?.total ?? prodData.data?.length ?? 0 : 0,
          datasheets: dsData.success ? dsData.data?.length ?? 0 : 0,
          brochures: brData.success ? brData.data?.length ?? 0 : 0,
        });
      } catch {
        // silent fail — stats are decorative
      }
    };
    loadStats();
  }, []);

  return (
    <PageShell
      title="Product Catalogue"
      subtitle="Manage your product catalogue, categories, specifications, and documentation."
    >
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="relative flex items-center gap-4">
          <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-white/10 backdrop-blur items-center justify-center shrink-0">
            <Sparkles size={26} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight">Catalogue Overview</h2>
            <p className="text-sm text-slate-300 mt-0.5">Everything you need to manage your product master data in one place.</p>
          </div>
        </div>
        {/* Quick stat strip */}
        <div className="relative mt-5 flex flex-wrap gap-x-8 gap-y-3">
          {[
            { label: "Products", value: stats.products, color: "text-emerald-400" },
            { label: "Categories", value: stats.categories, color: "text-blue-400" },
            { label: "Datasheets", value: stats.datasheets, color: "text-amber-400" },
            { label: "Brochures", value: stats.brochures, color: "text-rose-400" },
          ].map((s) => (
            <div key={s.label} className="flex items-baseline gap-2">
              <span className={cn("text-2xl font-bold tabular-nums", s.color)}>{s.value}</span>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {MODULES.map((mod) => {
          const Icon = mod.icon;
          const count = mod.statKey ? stats[mod.statKey] : undefined;
          return (
            <button
              key={mod.title}
              onClick={() => router.push(mod.href)}
              className={cn(
                "group relative text-left p-6 rounded-2xl border border-slate-200/80 bg-[var(--surface)]",
                "hover:border-slate-300 hover:shadow-lg hover:-translate-y-0.5",
                "transition-all duration-200 flex flex-col gap-4 min-h-[180px]"
              )}
            >
              <div className="flex items-start justify-between">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", mod.iconBg)}>
                  <Icon size={24} />
                </div>
                <div className="flex items-center gap-2">
                  {count !== undefined && (
                    <span className="text-xs font-bold tabular-nums text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                      {count}
                    </span>
                  )}
                  <ArrowRight
                    size={18}
                    className="text-slate-300 group-hover:text-slate-600 group-hover:translate-x-1 transition-all"
                  />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-[var(--text-primary)] mb-1.5">{mod.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{mod.description}</p>
              </div>
              <div className={cn("h-1 rounded-full bg-gradient-to-r", mod.color)} />
            </button>
          );
        })}
      </div>
    </PageShell>
  );
}
