"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ServiceModuleConfig } from "@/lib/config/serviceModuleConfig";
import { DataTable, type ColumnDef } from "./DataTable";
import { Search, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/ui-utils";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";

interface ServiceModuleListPageProps {
  config: ServiceModuleConfig;
  data: any[];
  loading: boolean;
  onRefresh?: () => void;
  onCreateNew?: () => void;
  onRowClick?: (row: any) => void;
  useLeftPanel?: boolean;
  onTriggerAction?: (row: any, actionId: string) => void;
  onStatusTransition?: (row: any, newStatusName: string) => void;
}

export default function ServiceModuleListPage({
  config,
  data,
  loading,
  onRefresh,
  onCreateNew,
  onRowClick,
  useLeftPanel = false,
  onTriggerAction,
  onStatusTransition,
}: ServiceModuleListPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const statusParam = searchParams?.get("status");
  const [activeTab, setActiveTab] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});

  const { user } = useAuth();
  const toast = useToast();

  const tabList = useMemo(() => {
    if (config.id === "reviews") {
      return ["All", "Pending", "Submitted", "LowRating"];
    }
    return ["All", ...config.statusOrder];
  }, [config.id, config.statusOrder]);

  useEffect(() => {
    if (statusParam) {
      if (config.id === "reviews" && statusParam.toLowerCase() === "lowrating") {
        setActiveTab("LowRating");
      } else {
        const matched = config.statuses.find(s => s.id.toLowerCase() === statusParam.toLowerCase());
        if (matched) {
          setActiveTab(matched.id);
        } else {
          setActiveTab("All");
        }
      }
    } else {
      setActiveTab("All");
    }
  }, [statusParam, config.id, config.statuses]);

  const handleStatusChange = (statusId: string) => {
    setActiveTab(statusId);
    if (!searchParams) return;
    const params = new URLSearchParams(searchParams.toString());
    if (statusId === "All") {
      params.delete("status");
    } else {
      params.set("status", statusId === "LowRating" ? "LowRating" : statusId.toLowerCase());
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    const filters: Record<string, string> = {};
    searchParams?.forEach((value, key) => {
      if (key !== "status" && key !== "view") {
        filters[key] = value;
      }
    });
    setSelectedFilters(filters);
  }, [searchParams]);

  const handleFilterChange = (filterId: string, value: string) => {
    setSelectedFilters(prev => ({ ...prev, [filterId]: value }));
    if (!searchParams) return;
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(filterId, value);
    } else {
      params.delete(filterId);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  // Compute live status counts from data
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: data.length };
    if (config.id === "reviews") {
      counts["Pending"] = data.filter(item => item.status === "Pending").length;
      counts["Submitted"] = data.filter(item => item.status === "Submitted").length;
      counts["LowRating"] = data.filter(item => item.isEscalation).length;
    } else {
      config.statusOrder.forEach(status => {
        counts[status] = data.filter(item => item.status === status).length;
      });
    }
    return counts;
  }, [data, config.id, config.statusOrder]);

  // Helper to determine role & assignment-based transition validity
  const getNextStageTransition = (moduleId: string, row: any, currentUser: any) => {
    if (!currentUser) return null;
    const role = currentUser.role;
    const isManagerOrAdmin = ["Admin", "SalesManager", "SuperAdmin"].includes(role);
    // Row might have engineer relation with userId inside
    const isAssignedEngineer = role === "ServiceEngineer" && row.engineer?.userId === currentUser.id;
    const isAuthorized = isManagerOrAdmin || isAssignedEngineer;

    const status = row.status;

    if (moduleId === "requests") {
      if (status === "New") {
        if (isManagerOrAdmin) return { label: "Assign", actionId: "assign" };
      }
      if (status === "Assigned") {
        if (isAuthorized) return { label: "Start", nextStatus: "In Progress" };
      }
      if (status === "In Progress") {
        if (isAuthorized) return { label: "Mark pending customer", nextStatus: "Pending Customer" };
      }
      if (status === "Pending Customer") {
        if (isAuthorized) return { label: "Resolve", nextStatus: "Resolved" };
      }
      if (status === "Resolved") {
        if (isManagerOrAdmin) return { label: "Close", actionId: "close" };
      }
    }

    if (moduleId === "complaints") {
      if (status === "New") {
        if (isAuthorized) return { label: "Investigate", actionId: "investigate" };
      }
      if (status === "Investigating") {
        if (isAuthorized) return { label: "Resolve", actionId: "resolve" };
      }
      if (status === "Resolved") {
        if (isManagerOrAdmin) return { label: "Close", actionId: "close" };
      }
    }

    if (moduleId === "defects") {
      if (status === "New") {
        if (isAuthorized) return { label: "Investigate", actionId: "investigate" };
      }
      if (status === "Under Investigation") {
        if (isAuthorized) return { label: "Add corrective action", actionId: "corrective" };
      }
      if (status === "Corrective Action") {
        if (isManagerOrAdmin) return { label: "Close", actionId: "close" };
      }
    }

    if (moduleId === "installations") {
      if (status === "Scheduled") {
        if (isAuthorized) return { label: "Start", actionId: "start" };
      }
      if (status === "In Progress") {
        if (isAuthorized) return { label: "Complete", actionId: "complete" };
      }
    }

    if (moduleId === "visits") {
      if (status === "Scheduled") {
        if (isAuthorized) return { label: "Check in", actionId: "check_in" };
      }
      if (status === "Checked In") {
        if (isAuthorized) return { label: "Complete", actionId: "complete" };
      }
    }

    return null;
  };

  const handleInlineNextStage = async (row: any, nextAction: any) => {
    try {
      if (nextAction.actionId) {
        if (onTriggerAction) {
          onTriggerAction(row, nextAction.actionId);
          if (!["assign", "close", "resolve", "corrective"].includes(nextAction.actionId)) {
            toast.success(`Success: Triggered "${nextAction.label}"`);
          }
        }
      } else if (nextAction.nextStatus) {
        if (onStatusTransition) {
          await onStatusTransition(row, nextAction.nextStatus);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    }
  };

  // Filter & Search data locally
  const filteredData = data.filter(item => {
    // Status Filter (Tab or Left Panel)
    if (activeTab !== "All") {
      if (config.id === "reviews" && activeTab === "LowRating") {
        if (!item.isEscalation) return false;
      } else if (item.status !== activeTab) {
        return false;
      }
    }

    // Search Query Filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const codeMatches = 
        item.requestCode?.toLowerCase().includes(query) || 
        item.complaintCode?.toLowerCase().includes(query) ||
        item.defectCode?.toLowerCase().includes(query) ||
        item.installationCode?.toLowerCase().includes(query) ||
        item.visitCode?.toLowerCase().includes(query) ||
        item.id?.toLowerCase().includes(query) ||
        item.reviewCode?.toLowerCase().includes(query);
      const titleMatches = 
        item.title?.toLowerCase().includes(query) || 
        item.details?.toLowerCase().includes(query) || 
        item.comment?.toLowerCase().includes(query) ||
        item.notes?.toLowerCase().includes(query);
      const customerMatches = item.customer?.name?.toLowerCase().includes(query);
      if (!codeMatches && !titleMatches && !customerMatches) {
        return false;
      }
    }

    // Custom select filters
    for (const [key, val] of Object.entries(selectedFilters)) {
      if (val && item[key] !== val) {
        return false;
      }
    }

    return true;
  });

  const tableColumns: ColumnDef<any>[] = config.listColumns.map(col => ({
    header: col.label,
    accessorKey: col.id,
    align: "left",
    cell: (row: any) => {
      if (col.type === "relation" && col.relationKey) {
        const parts = col.relationKey.split(".");
        let curr = row;
        for (const p of parts) {
          curr = curr?.[p];
        }
        return <span className="text-xs">{curr || "-"}</span>;
      }
      if (col.type === "date") {
        const val = row[col.id];
        return <span className="text-xs text-[var(--text-secondary)]">{val ? new Date(val).toLocaleDateString() : "-"}</span>;
      }
      if (col.type === "badge") {
        const val = row[col.id];
        const colorClass = config.badgeColorRules[val] || "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)]";
        return (
          <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-bold border", colorClass)}>
            {val}
          </span>
        );
      }
      return <span className="text-xs text-[var(--text-primary)]">{row[col.id] || "-"}</span>;
    }
  }));
 
  // Append actions or custom renderer if needed
  if (onRowClick) {
    tableColumns.push({
      header: "Action",
      align: "left",
      cell: (row: any) => {
        const nextAction = getNextStageTransition(config.id, row, user);
        return (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onRowClick(row)}
              className="text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline shrink-0"
            >
              View Details
            </button>
            {nextAction && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleInlineNextStage(row, nextAction);
                }}
                className="px-2 py-0.5 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-all shrink-0"
              >
                {nextAction.label}
              </button>
            )}
          </div>
        );
      }
    });
  }

  // Filter out status from select filters when using left panel
  const visibleFilterDefinitions = useMemo(() => {
    if (useLeftPanel) {
      return config.filterDefinitions.filter(f => f.id !== "status");
    }
    return config.filterDefinitions;
  }, [config.filterDefinitions, useLeftPanel]);

  const mainLayoutContent = (
    <div className="space-y-4">
      {/* Filter / Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl backdrop-blur-md">
        <div className="relative md:col-span-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input 
            type="text" 
            placeholder={`Search ${config.displayTitle.toLowerCase()} by code, customer, subject...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors placeholder-[var(--text-muted)]"
          />
        </div>

        {visibleFilterDefinitions.map(f => (
          <div key={f.id} className="relative">
            <select
              value={selectedFilters[f.id] || ""}
              onChange={(e) => handleFilterChange(f.id, e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">{f.label.toLowerCase() === "priority" ? "All priorities" : f.label.endsWith("s") ? `All ${f.label}` : `All ${f.label}s`}</option>
              {f.options?.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Horizontal Status tabs (when NOT using left panel) */}
      {!useLeftPanel && (
        <div className="flex items-center gap-1 border-b border-[var(--border)] pb-px overflow-x-auto">
          {["All", ...config.statusOrder].map(status => {
            const isActive = activeTab === status;
            return (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                className={cn(
                  "px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-px whitespace-nowrap",
                  isActive 
                    ? "border-blue-500 text-[var(--text-primary)]" 
                    : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                {status}
              </button>
            );
          })}
        </div>
      )}

      {/* Table view */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden backdrop-blur-md">
        <DataTable data={filteredData} columns={tableColumns} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-[var(--text-primary)]">{config.displayTitle}</h1>
          <p className="text-xs text-[var(--text-muted)]">Manage operational workflow, statuses, SLA, and teams.</p>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button 
              onClick={onRefresh}
              className="p-2 border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-all"
              title="Refresh"
            >
              <RefreshCw size={15} className={cn(loading && "animate-spin")} />
            </button>
          )}
          {onCreateNew && (
            <button 
              onClick={onCreateNew}
              className="flex items-center gap-1 px-4 py-2 bg-brand hover:bg-brand-hover text-white font-bold rounded-lg text-xs transition-colors"
            >
              <Plus size={14} /> New {config.entityLabel}
            </button>
          )}
        </div>
      </div>

      {useLeftPanel ? (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left panel vertical filter list */}
          <div className="w-full lg:w-52 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 space-y-1">
            <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)] mb-1">Filter Status</p>
            {tabList.map(status => {
              const isActive = activeTab === status;
              const count = statusCounts[status] ?? 0;
              let statusLabel = status;
              if (status === "LowRating") statusLabel = "Low Ratings / Escalations";
              else if (status === "Submitted") statusLabel = "Submitted Reviews";
              else if (status === "Pending") statusLabel = "Pending Feedback";

              let statusColor = null;
              if (status === "Pending") statusColor = "#FF6901";
              else if (status === "Submitted") statusColor = "#10B981";
              else if (status === "LowRating") statusColor = "#EF4444";
              else if (status !== "All") {
                statusColor = config.statuses.find(s => s.id === status)?.color || null;
              }

              return (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={cn(
                    "flex items-center justify-between w-full px-3 py-2 text-xs font-bold rounded-lg transition-all text-left border border-transparent",
                    isActive
                      ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {statusColor && (
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor }} />
                    )}
                    <span>{statusLabel}</span>
                  </div>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-mono",
                    isActive
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-[var(--surface-3)] text-[var(--text-muted)]"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right panel table content */}
          <div className="flex-1 min-w-0 w-full">
            {mainLayoutContent}
          </div>
        </div>
      ) : (
        mainLayoutContent
      )}
    </div>
  );
}
