"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { cn } from "@/lib/ui-utils";
import {
  HardDrive, Search, RefreshCw, Package, ShieldCheck, Wrench,
  CheckCircle, AlertCircle, ExternalLink
} from "lucide-react";

interface KPICardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  onClick?: (filter: string) => void;
  active?: boolean;
}

function KPICard({ label, value, icon, color, onClick, active }: KPICardProps) {
  return (
    <button
      onClick={() => onClick?.(active ? "" : label)}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-4 text-left transition-all",
        active
          ? "border-blue-500 bg-blue-500/5 ring-2 ring-blue-500/20"
          : "border-[var(--border)] bg-[var(--surface)] hover:border-blue-500/40"
      )}
    >
      <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg", color)}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-black text-[var(--text-primary)]">{value}</div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">{label}</div>
      </div>
    </button>
  );
}

export default function CustomerAssetsSalesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [kpiFilter, setKpiFilter] = useState("");
  const prefilledCustomerId = searchParams?.get("customerId") || "";

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (prefilledCustomerId) params.set("customerId", prefilledCustomerId);
      const res = await fetch(`/api/service/assets?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data || json || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [prefilledCustomerId]);

  const now = new Date();

  // KPI computations
  const kpiTotal = data.length;
  const kpiNewlyOnboarded = data.filter((a) => !a.serialNumber || a.serialNumber === "").length;
  const kpiActiveInstalled = data.filter((a) => a.status === "Active" && a.serialNumber).length;
  const kpiUnderWarranty = data.filter((a) => a.warrantyExpiryDate && new Date(a.warrantyExpiryDate) > now).length;
  const kpiUnderAMC = data.filter((a) => a.amcExpiryDate && new Date(a.amcExpiryDate) > now).length;

  const kpiFilterMap: Record<string, (a: any) => boolean> = {
    "Total Assets": () => true,
    "Newly Onboarded": (a) => !a.serialNumber || a.serialNumber === "",
    "Active Installed": (a) => a.status === "Active" && a.serialNumber,
    "Under Warranty": (a) => a.warrantyExpiryDate && new Date(a.warrantyExpiryDate) > now,
    "Under AMC": (a) => a.amcExpiryDate && new Date(a.amcExpiryDate) > now,
  };

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (kpiFilter && kpiFilterMap[kpiFilter]) {
        if (!kpiFilterMap[kpiFilter](item)) return false;
      }
      if (statusFilter && item.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.serialNumber?.toLowerCase().includes(q) ||
          item.productName?.toLowerCase().includes(q) ||
          item.customer?.name?.toLowerCase().includes(q) ||
          item.product?.name?.toLowerCase().includes(q) ||
          item.purchaseOrder?.poNumber?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [data, kpiFilter, statusFilter, searchQuery]);

  const tableColumns: ColumnDef<any>[] = [
    {
      header: "Customer",
      accessorKey: "customer.name",
      cell: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); router.push(`/customer-master/${row.customer?.id}`); }}
          className="text-xs font-bold text-[var(--text-primary)] hover:text-blue-500 hover:underline"
        >
          {row.customer?.name || "-"}
        </button>
      ),
    },
    {
      header: "Product",
      accessorKey: "productName",
      cell: (row) => <span className="text-xs font-medium text-[var(--text-primary)]">{row.productName || row.product?.name || "-"}</span>,
    },
    {
      header: "Serial Number",
      accessorKey: "serialNumber",
      cell: (row) => <span className="text-xs text-[var(--text-secondary)] font-mono">{row.serialNumber || "—"}</span>,
    },
    {
      header: "Originating PO",
      accessorKey: "purchaseOrder.poNumber",
      cell: (row) => (
        <span className="text-xs text-[var(--text-secondary)]">
          {row.purchaseOrder?.poNumber || row.purchaseOrder?.poCode || "—"}
        </span>
      ),
    },
    {
      header: "Purchase Date",
      accessorKey: "purchaseDate",
      cell: (row) => <span className="text-xs text-[var(--text-secondary)] whitespace-nowrap">{row.purchaseDate ? new Date(row.purchaseDate).toLocaleDateString() : "—"}</span>,
    },
    {
      header: "Warranty",
      accessorKey: "warrantyExpiryDate",
      cell: (row) => {
        if (!row.warrantyExpiryDate) return <span className="text-xs text-[var(--text-muted)]">—</span>;
        const isExpired = new Date(row.warrantyExpiryDate) < now;
        return (
          <span className={cn("text-xs font-bold", isExpired ? "text-red-500" : "text-green-500")}>
            {isExpired ? "Expired" : "Active"} · {new Date(row.warrantyExpiryDate).toLocaleDateString()}
          </span>
        );
      },
    },
    {
      header: "AMC",
      accessorKey: "amcExpiryDate",
      cell: (row) => {
        if (!row.amcExpiryDate) return <span className="text-xs text-[var(--text-muted)]">—</span>;
        const isExpired = new Date(row.amcExpiryDate) < now;
        return (
          <span className={cn("text-xs font-bold", isExpired ? "text-red-500" : "text-green-500")}>
            {isExpired ? "Expired" : "Active"} · {new Date(row.amcExpiryDate).toLocaleDateString()}
          </span>
        );
      },
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => {
        const colorClass =
          row.status === "Active" ? "bg-green-500/10 text-green-500 border-green-500/20" :
          row.status === "Expired" ? "bg-red-500/10 text-red-500 border-red-500/20" :
          "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)]";
        return <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-bold border", colorClass)}>{row.status}</span>;
      },
    },
    {
      header: "Action",
      cell: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); router.push(`/service/assets`); }}
          className="text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
        >
          View <ExternalLink size={10} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-[var(--text-primary)]">Customer Assets</h1>
          <p className="text-xs text-[var(--text-muted)]">Read-only view of assets owned and managed by Service CRM.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData()}
            className="p-2 border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-all"
            title="Refresh"
          >
            <RefreshCw size={15} className={cn(loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KPICard label="Total Assets" value={kpiTotal} icon={<HardDrive size={20} className="text-blue-500" />} color="bg-blue-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Total Assets"} />
        <KPICard label="Newly Onboarded" value={kpiNewlyOnboarded} icon={<Package size={20} className="text-amber-500" />} color="bg-amber-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Newly Onboarded"} />
        <KPICard label="Active Installed" value={kpiActiveInstalled} icon={<CheckCircle size={20} className="text-green-500" />} color="bg-green-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Active Installed"} />
        <KPICard label="Under Warranty" value={kpiUnderWarranty} icon={<ShieldCheck size={20} className="text-purple-500" />} color="bg-purple-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Under Warranty"} />
        <KPICard label="Under AMC" value={kpiUnderAMC} icon={<Wrench size={20} className="text-cyan-500" />} color="bg-cyan-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Under AMC"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl backdrop-blur-md">
        <div className="relative md:col-span-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by serial number, product, customer, PO..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors placeholder-[var(--text-muted)]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] focus:outline-none focus:border-blue-500 transition-colors"
        >
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Expired">Expired</option>
        </select>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden backdrop-blur-md">
        <DataTable data={filteredData} columns={tableColumns} />
      </div>

      {kpiFilter && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)]">Filtering by:</span>
          <button
            onClick={() => setKpiFilter("")}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 text-blue-700 dark:text-blue-400 text-[11px] font-bold hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors"
          >
            {kpiFilter} ✕
          </button>
          <span className="text-xs text-[var(--text-muted)]">— {filteredData.length} asset{filteredData.length !== 1 ? "s" : ""}</span>
        </div>
      )}
    </div>
  );
}
