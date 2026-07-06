"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import {
  PriceRangeBar,
  getChartColor,
} from "@/components/competitors/CompetitorAnalytics";
import { Search, X, Package, Users, Shield, TrendingUp, AlertTriangle, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type SortField = "name" | "priceRange" | "competitorName";
type SortDir = "asc" | "desc";

export default function AllCompetitorProductsPage() {
  const toast = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selectedCompetitorId, setSelectedCompetitorId] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [compareSelection, setCompareSelection] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/competitors/products");
      const data = await res.json();
      if (data.success) setProducts(data.data);
    } catch {
      toast.error("Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Filter
  const filtered = useMemo(() => {
    let result = products;
    if (selectedCompetitorId) {
      result = result.filter((p) => p.competitor?.id === selectedCompetitorId);
    }
    if (q) {
      const ql = q.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(ql) ||
          p.competitor?.name?.toLowerCase().includes(ql) ||
          p.description?.toLowerCase().includes(ql)
      );
    }
    return result;
  }, [products, q, selectedCompetitorId]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: string, bv: string;
      if (sortField === "competitorName") {
        av = a.competitor?.name ?? "";
        bv = b.competitor?.name ?? "";
      } else if (sortField === "priceRange") {
        av = a.priceRange ?? "zzz";
        bv = b.priceRange ?? "zzz";
      } else {
        av = a.name ?? "";
        bv = b.name ?? "";
      }
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  // Group by competitor
  const grouped = useMemo(() => {
    const map = new Map<string, { competitorId: string; competitorName: string; products: any[] }>();
    for (const p of sorted) {
      const cid = p.competitor?.id ?? "unknown";
      const cname = p.competitor?.name ?? "Unknown";
      if (!map.has(cid)) map.set(cid, { competitorId: cid, competitorName: cname, products: [] });
      map.get(cid)!.products.push(p);
    }
    return Array.from(map.values());
  }, [sorted]);

  // All unique competitors for filter dropdown
  const allCompetitors = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      if (p.competitor?.id) map.set(p.competitor.id, p.competitor.name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  // Summary metrics
  const summary = useMemo(() => {
    const totalProducts = filtered.length;
    const totalCompetitors = grouped.length;
    let strongestThreat = { name: "N/A", count: 0 };
    for (const group of grouped) {
      if (group.products.length > strongestThreat.count) {
        strongestThreat = { name: group.competitorName, count: group.products.length };
      }
    }
    const withAdvantage = filtered.filter((p) => p.ourAdvantage).length;
    return { totalProducts, totalCompetitors, strongestThreat, withAdvantage };
  }, [filtered, grouped]);

  // Compare products
  const compareProducts = useMemo(() => {
    return filtered.filter((p) => compareSelection.has(p.id));
  }, [filtered, compareSelection]);

  const toggleCompare = (id: string) => {
    setCompareSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      else toast.error("Compare up to 3 products only");
      return next;
    });
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="inline-flex flex-col ml-1 text-[9px] leading-none">
      <span className={sortField === field && sortDir === "asc" ? "text-[var(--primary)]" : "text-slate-400"}>▲</span>
      <span className={sortField === field && sortDir === "desc" ? "text-[var(--primary)]" : "text-slate-400"}>▼</span>
    </span>
  );

  return (
    <PageContainer className="space-y-6 p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-900/50 min-h-screen">
      {/* Row 1: Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 shadow-sm">
            <Package size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Competitor Products</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Competitive intelligence and product comparisons</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/competitors" className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm">
            Manage Competitors
          </Link>
          <button onClick={() => toast.info("Export functionality coming soon")} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-all shadow-sm hover:shadow-md cursor-pointer">
            Export Data
          </button>
        </div>
      </div>

      {/* Row 2: KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Tracked Products", value: summary.totalProducts, icon: Package, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" },
          { label: "Competitors", value: summary.totalCompetitors, icon: Users, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/20" },
          { label: "Strongest Threat", value: summary.strongestThreat.name, icon: AlertTriangle, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-900/20" },
          { label: "Tracked Advantages", value: summary.withAdvantage, icon: Shield, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className={cn("flex items-center justify-center w-12 h-12 rounded-xl shrink-0", card.bg, card.color)}>
                <Icon size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-1 truncate">{card.label}</p>
                <p className="text-xl font-black text-slate-800 dark:text-slate-100 truncate">{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Row 3: Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-2 flex flex-col md:flex-row items-center gap-2">
        <div className="flex-1 flex flex-wrap md:flex-nowrap items-center gap-2 w-full">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            />
          </div>
          <select
            value={selectedCompetitorId}
            onChange={(e) => setSelectedCompetitorId(e.target.value)}
            className="flex-1 min-w-[150px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 cursor-pointer"
          >
            <option value="">All Competitors</option>
            {allCompetitors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto shrink-0 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 pt-2 md:pt-0 md:pl-2">
          {compareSelection.size > 0 && (
            <button
              onClick={() => setCompareSelection(new Set())}
              className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <X size={14} /> Clear Compare ({compareSelection.size})
            </button>
          )}
        </div>
      </div>

      {/* Row 4: Comparison View (Sticky Top) */}
      {compareProducts.length > 0 && (
        <div className="bg-indigo-900 dark:bg-indigo-950 rounded-2xl shadow-lg border border-indigo-700/50 overflow-hidden sticky top-4 z-10 animate-in fade-in slide-in-from-top-4">
          <div className="px-4 py-3 bg-indigo-950/50 border-b border-indigo-800/50 flex items-center justify-between">
            <h4 className="text-sm font-bold text-indigo-100 flex items-center gap-2"><ArrowRightLeft size={16} className="text-indigo-400" /> Side-by-Side Analysis</h4>
          </div>
          <div className="overflow-x-auto p-4">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="py-2 px-3 text-[11px] font-extrabold text-indigo-400 uppercase tracking-wider w-[120px]">Attribute</th>
                  {compareProducts.map((p) => (
                    <th key={p.id} className="py-2 px-3">
                      <div className="text-sm font-bold text-white">{p.name}</div>
                      <div className="text-[11px] font-medium text-indigo-300">{p.competitor?.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-800/30">
                <tr>
                  <td className="py-3 px-3 text-[12px] font-semibold text-indigo-300">Price Range</td>
                  {compareProducts.map((p) => (
                    <td key={p.id} className="py-3 px-3"><div className="bg-white/10 rounded-lg p-2"><PriceRangeBar priceRange={p.priceRange} /></div></td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-3 text-[12px] font-semibold text-indigo-300 align-top">Description</td>
                  {compareProducts.map((p) => (
                    <td key={p.id} className="py-3 px-3 text-[13px] text-indigo-100 align-top leading-relaxed">{p.description || "—"}</td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-3 text-[12px] font-semibold text-indigo-300 align-top">Our Advantage</td>
                  {compareProducts.map((p) => (
                    <td key={p.id} className="py-3 px-3 align-top">
                      {p.ourAdvantage ? (
                        <div className="text-[13px] text-emerald-300 font-medium bg-emerald-900/30 px-3 py-2 rounded-lg border border-emerald-800/50">
                          {p.ourAdvantage}
                        </div>
                      ) : (
                        <span className="text-indigo-400/50">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Row 5: Unified Competitor Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex-1 flex flex-col">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[var(--primary)] animate-spin" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading Products...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center text-slate-300 dark:text-slate-600 mb-2">
              <Package size={32} />
            </div>
            <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">No Products Found</h3>
            <p className="text-sm text-slate-500">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-5 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[200px]">
                    <button onClick={() => toggleSort("name")} className="inline-flex items-center hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                      Product <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="px-5 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[200px]">
                    Price Range
                  </th>
                  <th className="px-5 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Our Advantage
                  </th>
                  <th className="px-5 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center w-[100px]">
                    Compare
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {grouped.map((group) => {
                  const color = getChartColor(group.competitorName);
                  return (
                    <React.Fragment key={group.competitorId}>
                      {/* Competitor Group Header */}
                      <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                        <td colSpan={4} className="px-5 py-2 border-b border-slate-200/50 dark:border-slate-800/50">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: color }} />
                            <Link href={`/competitors/${group.competitorId}`} className="text-[13px] font-bold text-slate-700 dark:text-slate-300 hover:text-[var(--primary)] transition-colors">
                              {group.competitorName}
                            </Link>
                            <span className="text-[11px] font-medium text-slate-400 bg-slate-200/50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded-md ml-2">{group.products.length}</span>
                          </div>
                        </td>
                      </tr>
                      {/* Competitor Products */}
                      {group.products.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors group/row">
                          <td className="px-5 py-4">
                            <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">{p.name}</div>
                            {p.description && <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 max-w-sm">{p.description}</div>}
                          </td>
                          <td className="px-5 py-4 align-top pt-5">
                            <PriceRangeBar priceRange={p.priceRange} />
                          </td>
                          <td className="px-5 py-4 align-top">
                            {p.ourAdvantage ? (
                              <div className="text-[13px] font-medium text-slate-600 dark:text-slate-300 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 px-3 py-2 rounded-xl line-clamp-2 shadow-sm">
                                {p.ourAdvantage}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-center align-top pt-5">
                            <label className="relative flex items-center justify-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={compareSelection.has(p.id)}
                                onChange={() => toggleCompare(p.id)}
                                className="peer sr-only"
                              />
                              <div className="w-5 h-5 border-2 border-slate-300 dark:border-slate-600 rounded-md peer-checked:bg-[var(--primary)] peer-checked:border-[var(--primary)] transition-all flex items-center justify-center">
                                <svg className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            </label>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
