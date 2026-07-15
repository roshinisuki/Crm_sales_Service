"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { serviceModulesConfig } from "@/lib/config/serviceModuleConfig";
import ServiceModuleListPage from "@/components/shared/ServiceModuleListPage";
import ServiceModuleDetailPage from "@/components/shared/ServiceModuleDetailPage";
import { ServiceKPICard, ServiceKPIGrid } from "@/components/shared/ServiceKPICard";
import { Star, Inbox, ShieldAlert, Award, ArrowUpDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/ui-utils";

export default function ServiceReviewsPage() {
  const config = serviceModulesConfig.reviews;
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeView = searchParams?.get("view") || "list"; // list | engineer

  const [data, setData] = useState<any[]>([]);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refData, setRefData] = useState<any>({});
  const [engineerSortBy, setEngineerSortBy] = useState<"rating" | "escalations" | "">("");

  const mapReview = (item: any) => {
    return {
      ...item,
      reviewCode: `REV-${item.id.substring(0, 8).toUpperCase()}`,
      customer: { name: item.customer?.name || "Unknown" },
      engineer: { user: { name: item.engineer?.user?.name || "Unassigned" } },
      rating: item.rating ? "★".repeat(item.rating) + "☆".repeat(5 - item.rating) : "–",
      status: item.status || "Pending",
    };
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/service/reviews");
      if (res.ok) {
        const json = await res.json();
        const mappedData = json.map(mapReview);
        setData(mappedData);

        // Sync selectedRow live if open
        if (selectedRow) {
          const freshItem = json.find((x: any) => x.id === selectedRow.id);
          if (freshItem) {
            setSelectedRow(mapReview(freshItem));
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchRefData = async () => {
    try {
      const res = await fetch("/api/service/reference-data?module=visit");
      if (res.ok) {
        setRefData(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
    fetchRefData();
  }, []);

  const handleTriggerAction = async (actionId: string) => {
    if (!selectedRow) return;

    if (actionId === "resolve_escalation") {
      try {
        const res = await fetch(`/api/service/reviews/${selectedRow.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ escalationResolved: true }),
        });
        if (res.ok) {
          await fetchData();
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Populate dynamic select filter options for engineer
  const dynamicConfig = useMemo(() => {
    const updatedFilterDefinitions = config.filterDefinitions.map(f => {
      if (f.id === "engineerId" && refData.ServiceEngineer) {
        return {
          ...f,
          options: refData.ServiceEngineer.map((eng: any) => ({
            value: eng.value,
            label: eng.label,
          })),
        };
      }
      return f;
    });
    return { ...config, filterDefinitions: updatedFilterDefinitions };
  }, [config, refData]);

  // Compute KPI card stats from all reviews (mapped raw data)
  const stats = useMemo(() => {
    const totalCount = data.filter(r => r.status === "Submitted").length;
    const pendingCount = data.filter(r => r.status === "Pending").length;
    const escalationCount = data.filter(r => r.isEscalation && !r.escalationResolved).length;
    
    const sum = data.reduce((acc, curr) => {
      if (curr.status === "Submitted" && typeof curr.rating === "string") {
        const countStars = (curr.rating.match(/★/g) || []).length;
        return acc + countStars;
      }
      return acc;
    }, 0);
    const avg = totalCount > 0 ? (sum / totalCount).toFixed(1) : "–";

    return {
      total: totalCount,
      avg: avg,
      pending: pendingCount,
      escalations: escalationCount,
    };
  }, [data]);

  // Compute aggregated stats for each engineer
  const engineerStats = useMemo(() => {
    const engineerMap: Record<string, { id: string; name: string; totalReviews: number; sumRatings: number; escalationCount: number }> = {};
    
    // Seed from reference data so all engineers show
    refData.ServiceEngineer?.forEach((eng: any) => {
      engineerMap[eng.value] = {
        id: eng.value,
        name: eng.label,
        totalReviews: 0,
        sumRatings: 0,
        escalationCount: 0,
      };
    });

    data.forEach(r => {
      const engId = r.engineerId;
      if (!engId) return;
      if (!engineerMap[engId]) {
        engineerMap[engId] = {
          id: engId,
          name: r.engineer?.user?.name || "Unassigned",
          totalReviews: 0,
          sumRatings: 0,
          escalationCount: 0,
        };
      }
      if (r.status === "Submitted") {
        engineerMap[engId].totalReviews++;
        const stars = (r.rating?.match(/★/g) || []).length;
        engineerMap[engId].sumRatings += stars;
        if (r.isEscalation) {
          engineerMap[engId].escalationCount++;
        }
      }
    });

    return Object.values(engineerMap).map(e => ({
      ...e,
      avgRating: e.totalReviews > 0 ? (e.sumRatings / e.totalReviews) : 0,
      avgRatingLabel: e.totalReviews > 0 ? (e.sumRatings / e.totalReviews).toFixed(1) : "–",
    }));
  }, [data, refData]);

  // Sort engineer stats based on selection
  const sortedEngineerStats = useMemo(() => {
    const statsList = [...engineerStats];
    if (engineerSortBy === "rating") {
      return statsList.sort((a, b) => b.avgRating - a.avgRating);
    }
    if (engineerSortBy === "escalations") {
      return statsList.sort((a, b) => b.escalationCount - a.escalationCount);
    }
    return statsList;
  }, [engineerStats, engineerSortBy]);

  const toggleView = (view: string) => {
    if (!searchParams) return;
    const params = new URLSearchParams(searchParams.toString());
    if (view === "list") {
      params.delete("view");
    } else {
      params.set("view", view);
    }
    router.push(`/service/reviews?${params.toString()}`);
  };

  const handleEngineerDrilldown = (engId: string) => {
    if (!searchParams) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("view");
    params.set("engineerId", engId);
    router.push(`/service/reviews?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {selectedRow ? (
        <ServiceModuleDetailPage
          config={dynamicConfig}
          data={selectedRow}
          onBack={() => setSelectedRow(null)}
          onStatusTransition={() => {}}
          onTriggerAction={handleTriggerAction}
        />
      ) : (
        <div className="space-y-6">
          {/* Top view switcher toggle */}
          <div className="flex justify-between items-center bg-[var(--surface-2)] border border-[var(--border)] p-2 rounded-xl">
            <div className="flex gap-2">
              <button
                onClick={() => toggleView("list")}
                className={cn(
                  "px-4 py-2 text-xs font-bold rounded-lg transition-all",
                  activeView === "list"
                    ? "bg-blue-500/15 text-blue-500 border border-blue-500/25"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                Individual Reviews
              </button>
              <button
                onClick={() => toggleView("engineer")}
                className={cn(
                  "px-4 py-2 text-xs font-bold rounded-lg transition-all",
                  activeView === "engineer"
                    ? "bg-blue-500/15 text-blue-500 border border-blue-500/25"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                Engineer Ratings
              </button>
            </div>
          </div>

          {/* KPI Summaries */}
          <ServiceKPIGrid>
            <ServiceKPICard
              label="Total Reviews"
              value={stats.total}
              icon={<Inbox size={20} className="text-blue-500" />}
              color="bg-blue-500/10"
              onClick={() => {}}
              active={false}
            />
            <ServiceKPICard
              label="Average Rating"
              value={stats.avg}
              icon={<Star size={20} className="text-yellow-500 fill-yellow-500/30" />}
              color="bg-yellow-500/10"
              onClick={() => {}}
              active={false}
            />
            <ServiceKPICard
              label="Pending Feedback"
              value={stats.pending}
              icon={<Award size={20} className="text-purple-500" />}
              color="bg-purple-500/10"
              onClick={() => {}}
              active={false}
            />
            <ServiceKPICard
              label="Escalations"
              value={stats.escalations}
              icon={<ShieldAlert size={20} className="text-red-500" />}
              color="bg-red-500/10"
              onClick={() => {}}
              active={false}
            />
          </ServiceKPIGrid>

          {activeView === "engineer" ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h1 className="text-xl font-black text-[var(--text-primary)]">Engineer Performance Ratings</h1>
                  <p className="text-xs text-[var(--text-muted)]">Aggregated review performance and customer satisfaction by engineer.</p>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden backdrop-blur-md">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] font-bold">
                      <th className="p-4">Engineer</th>
                      <th 
                        className="p-4 cursor-pointer hover:text-[var(--text-primary)] select-none"
                        onClick={() => setEngineerSortBy(prev => prev === "rating" ? "" : "rating")}
                      >
                        <div className="flex items-center gap-1">
                          Average Rating <ArrowUpDown size={12} className={cn(engineerSortBy === "rating" && "text-blue-500")} />
                        </div>
                      </th>
                      <th className="p-4">Total Reviews</th>
                      <th 
                        className="p-4 cursor-pointer hover:text-[var(--text-primary)] select-none"
                        onClick={() => setEngineerSortBy(prev => prev === "escalations" ? "" : "escalations")}
                      >
                        <div className="flex items-center gap-1">
                          Escalations <ArrowUpDown size={12} className={cn(engineerSortBy === "escalations" && "text-blue-500")} />
                        </div>
                      </th>
                      <th className="p-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {sortedEngineerStats.map((eng) => (
                      <tr key={eng.id} className="hover:bg-[var(--surface-2)]/50 transition-colors text-[var(--text-primary)]">
                        <td className="p-4 font-semibold">{eng.name}</td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 font-extrabold">
                            ★ {eng.avgRatingLabel}
                          </span>
                        </td>
                        <td className="p-4 text-[var(--text-secondary)] font-medium">{eng.totalReviews}</td>
                        <td className="p-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[11px] font-bold border",
                            eng.escalationCount > 0 
                              ? "bg-red-500/10 text-red-500 border-red-500/20"
                              : "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)]"
                          )}>
                            {eng.escalationCount}
                          </span>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => handleEngineerDrilldown(eng.id)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline"
                          >
                            Drill Down <ChevronRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {sortedEngineerStats.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-[var(--text-muted)]">No engineers found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <ServiceModuleListPage
              config={dynamicConfig}
              data={data}
              loading={loading}
              onRefresh={fetchData}
              onRowClick={(row) => setSelectedRow(row)}
              useLeftPanel={true}
            />
          )}
        </div>
      )}
    </div>
  );
}
