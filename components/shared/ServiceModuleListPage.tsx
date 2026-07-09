"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ServiceModuleConfig } from "@/lib/config/serviceModuleConfig";
import { DataTable, type ColumnDef } from "./DataTable";
import { Search, Plus, Filter, RefreshCw } from "lucide-react";
import { cn } from "@/lib/ui-utils";

interface ServiceModuleListPageProps {
  config: ServiceModuleConfig;
  data: any[];
  loading: boolean;
  onRefresh?: () => void;
  onCreateNew?: () => void;
  onRowClick?: (row: any) => void;
}

export default function ServiceModuleListPage({
  config,
  data,
  loading,
  onRefresh,
  onCreateNew,
  onRowClick,
}: ServiceModuleListPageProps) {
  const searchParams = useSearchParams();
  const statusParam = searchParams?.get("status");
  const [activeTab, setActiveTab] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    if (statusParam) {
      const matched = config.statuses.find(s => s.id.toLowerCase() === statusParam.toLowerCase());
      if (matched) {
        setActiveTab(matched.id);
      } else {
        setActiveTab("All");
      }
    } else {
      setActiveTab("All");
    }
  }, [statusParam, config.statuses]);

  const handleFilterChange = (filterId: string, value: string) => {
    setSelectedFilters(prev => ({ ...prev, [filterId]: value }));
  };

  // Filter & Search data locally
  const filteredData = data.filter(item => {
    // Status Filter (Tab)
    if (activeTab !== "All" && item.status !== activeTab) {
      return false;
    }

    // Search Query Filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const codeMatches = item.requestCode?.toLowerCase().includes(query) || item.complaintCode?.toLowerCase().includes(query);
      const titleMatches = item.title?.toLowerCase().includes(query) || item.details?.toLowerCase().includes(query);
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
        // e.g. relationKey: 'customer.name'
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
      cell: (row: any) => (
        <button 
          onClick={() => onRowClick(row)}
          className="text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline"
        >
          View Details
        </button>
      )
    });
  }

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

        {config.filterDefinitions.map(f => (
          <div key={f.id} className="relative">
            <select
              value={selectedFilters[f.id] || ""}
              onChange={(e) => handleFilterChange(f.id, e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">All {f.label}s</option>
              {f.options?.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border)] pb-px overflow-x-auto">
        {["All", ...config.statusOrder].map(status => {
          const isActive = activeTab === status;
          return (
            <button
              key={status}
              onClick={() => setActiveTab(status)}
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

      {/* Table view */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden backdrop-blur-md">
        <DataTable data={filteredData} columns={tableColumns} />
      </div>
    </div>
  );
}
