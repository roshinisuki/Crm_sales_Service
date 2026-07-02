"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import {
  CompetitorPageHeader, EmptyState, LoadingState, PriceRangeBar,
  getChartColor, KPICard,
} from "@/components/competitors/CompetitorAnalytics";
import { Search, ChevronDown, X, Package, Users, DollarSign, Shield } from "lucide-react";

type SortField = "name" | "priceRange" | "competitorName";
type SortDir = "asc" | "desc";

export default function AllCompetitorProductsPage() {
  const toast = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
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
    if (!q) return products;
    const ql = q.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(ql) ||
        p.competitor?.name?.toLowerCase().includes(ql) ||
        p.description?.toLowerCase().includes(ql)
    );
  }, [products, q]);

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

  // Summary metrics
  const summary = useMemo(() => {
    const totalProducts = filtered.length;
    const totalCompetitors = grouped.length;
    const withPricing = filtered.filter((p) => p.priceRange).length;
    const withAdvantage = filtered.filter((p) => p.ourAdvantage).length;
    return { totalProducts, totalCompetitors, withPricing, withAdvantage };
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

  const toggleCollapse = (cid: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cid)) next.delete(cid);
      else next.add(cid);
      return next;
    });
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="inline-flex flex-col ml-1 text-[9px] leading-none">
      <span className={sortField === field && sortDir === "asc" ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}>▲</span>
      <span className={sortField === field && sortDir === "desc" ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}>▼</span>
    </span>
  );

  return (
    <PageContainer className="space-y-5 p-0">
      <CompetitorPageHeader title="Competitor Products" subtitle="All products across competitors with side-by-side comparison">
        <Link href="/competitors" className="text-[13px] text-[var(--accent)] hover:underline">Manage competitors →</Link>
      </CompetitorPageHeader>

      {/* Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={16} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by product or competitor..."
            className="input-field pl-9"
          />
        </div>
        {compareSelection.size > 0 && (
          <button
            onClick={() => setCompareSelection(new Set())}
            className="btn-secondary"
          >
            <X size={14} /> Clear compare ({compareSelection.size})
          </button>
        )}
      </div>

      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState message="No competitor products found." />
      ) : (
        <>
          {/* Summary KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Total Products" value={summary.totalProducts} icon={<Package size={20} />} />
            <KPICard label="Competitors" value={summary.totalCompetitors} sublabel="with products" icon={<Users size={20} />} />
            <KPICard label="With Pricing" value={summary.withPricing} sublabel="price range defined" icon={<DollarSign size={20} />} />
            <KPICard label="With Advantage" value={summary.withAdvantage} sublabel="our advantage noted" icon={<Shield size={20} />} />
          </div>

          {/* Compare panel */}
          {compareProducts.length >= 2 && (
            <div className="analytics-chart-card">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[15px] font-medium text-[var(--text-primary)]">Side-by-Side Comparison</h4>
                <button onClick={() => setCompareSelection(new Set())} className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">Clear</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-2 px-3 text-[12px] font-medium text-[var(--text-secondary)] w-[140px]">Attribute</th>
                      {compareProducts.map((p) => (
                        <th key={p.id} className="text-left py-2 px-3 text-[13px] font-medium text-[var(--text-primary)]">
                          {p.name}
                          <div className="text-[11px] text-[var(--text-muted)] font-normal">{p.competitor?.name}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 px-3 text-[var(--text-secondary)]">Price Range</td>
                      {compareProducts.map((p) => (
                        <td key={p.id} className="py-2 px-3"><PriceRangeBar priceRange={p.priceRange} /></td>
                      ))}
                    </tr>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 px-3 text-[var(--text-secondary)]">Description</td>
                      {compareProducts.map((p) => (
                        <td key={p.id} className="py-2 px-3 text-[var(--text-primary)]">{p.description || "—"}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-[var(--text-secondary)]">Our Advantage</td>
                      {compareProducts.map((p) => (
                        <td key={p.id} className="py-2 px-3 text-[var(--text-primary)]">{p.ourAdvantage || "—"}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Grouped product sections */}
          <div className="space-y-4">
            {grouped.map((group) => {
              const isCollapsed = collapsed.has(group.competitorId);
              const color = getChartColor(group.competitorName);
              return (
                <div key={group.competitorId} className="analytics-chart-card !p-0 overflow-hidden">
                  {/* Section header */}
                  <button
                    onClick={() => toggleCollapse(group.competitorId)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <Link
                        href={`/competitors/${group.competitorId}`}
                        className="text-[15px] font-medium text-[var(--text-primary)] hover:text-[var(--accent)]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {group.competitorName}
                      </Link>
                      <span className="text-[12px] text-[var(--text-muted)]">{group.products.length} product{group.products.length !== 1 ? "s" : ""}</span>
                    </div>
                    <ChevronDown size={18} className={`text-[var(--text-muted)] transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                  </button>

                  {/* Products table */}
                  {!isCollapsed && (
                    <div className="overflow-x-auto border-t border-[var(--border-subtle)]">
                      <table className="w-full text-[13px]">
                        <thead>
                          <tr className="bg-[var(--surface-2)]">
                            <th className="text-left py-2.5 px-4 text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                              <button onClick={() => toggleSort("name")} className="inline-flex items-center hover:text-[var(--text-primary)]">
                                Product <SortIcon field="name" />
                              </button>
                            </th>
                            <th className="text-left py-2.5 px-4 text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider min-w-[180px]">
                              Price Range
                            </th>
                            <th className="text-left py-2.5 px-4 text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                              Our Advantage
                            </th>
                            <th className="text-center py-2.5 px-4 text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider w-[80px]">
                              Compare
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle)]">
                          {group.products.map((p) => (
                            <tr key={p.id} className="hover:bg-[var(--surface-2)] transition-colors">
                              <td className="py-3 px-4">
                                <div className="font-medium text-[var(--text-primary)]">{p.name}</div>
                                {p.description && <div className="text-[12px] text-[var(--text-muted)] mt-0.5 line-clamp-1">{p.description}</div>}
                              </td>
                              <td className="py-3 px-4">
                                <PriceRangeBar priceRange={p.priceRange} />
                              </td>
                              <td className="py-3 px-4 text-[var(--text-secondary)] max-w-xs">
                                <div className="line-clamp-2">{p.ourAdvantage || "—"}</div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={compareSelection.has(p.id)}
                                  onChange={() => toggleCompare(p.id)}
                                  className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </PageContainer>
  );
}
