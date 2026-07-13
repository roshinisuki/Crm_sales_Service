"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { serviceModulesConfig } from "@/lib/config/serviceModuleConfig";
import ServiceModuleForm from "@/components/shared/ServiceModuleForm";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { cn } from "@/lib/ui-utils";
import { Search, Plus, RefreshCw, ChevronLeft, X, Calendar, CheckCircle, AlertTriangle, Clock, CalendarDays } from "lucide-react";
import { ServiceKPICard as KPICard, ServiceKPIGrid } from "@/components/shared/ServiceKPICard";

const NOW = new Date();

function computeLiveStatus(visit: any): string {
  const statusName = visit.status?.name || visit.status || "Unknown";
  if ((statusName === "Scheduled" || statusName === "Assigned") && visit.scheduledDate) {
    if (new Date(visit.scheduledDate) < NOW) return "Overdue";
  }
  return statusName;
}

function getSourceInfo(visit: any): { type: string; code: string; href: string } | null {
  if (visit.request) return { type: "Request", code: `REQ-${visit.request.id.substring(0, 8).toUpperCase()}`, href: "/service/requests" };
  if (visit.complaint) return { type: "Complaint", code: `CMP-${visit.complaint.id.substring(0, 8).toUpperCase()}`, href: "/service/complaints" };
  if (visit.defect) return { type: "Defect", code: `DEF-${visit.defect.id.substring(0, 8).toUpperCase()}`, href: "/service/defects" };
  if (visit.installation) return { type: "Installation", code: `INS-${visit.installation.id.substring(0, 8).toUpperCase()}`, href: "/service/installations" };
  return null;
}


export default function ServiceVisitsPage() {
  const config = serviceModulesConfig.visits;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<any[]>([]);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refData, setRefData] = useState<any>({});
  const [stats, setStats] = useState({ total: 0, scheduledToday: 0, upcomingThisWeek: 0, overdue: 0, completedThisMonth: 0 });
  const [kpiFilter, setKpiFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [engineerFilter, setEngineerFilter] = useState("");
  const [completeModal, setCompleteModal] = useState<any>(null);
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [completing, setCompleting] = useState(false);

  const prefilledCustomerId = searchParams?.get("customerId") || "";
  const prefilledAssetId = searchParams?.get("customerAssetId") || "";
  const sourceType = searchParams?.get("sourceType") || "";
  const sourceId = searchParams?.get("sourceId") || "";

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/service/visits");
      if (res.ok) {
        const json = await res.json();
        const mappedData = json.map((item: any) => {
          const parent = item.request || item.complaint || item.defect || item.installation;
          const liveStatus = computeLiveStatus(item);
          const source = getSourceInfo(item);
          return {
            ...item,
            visitCode: `VST-${item.id.substring(0, 8).toUpperCase()}`,
            visitDate: item.scheduledDate,
            customer: item.customer || (parent ? { name: parent.customer?.name || "Unknown" } : { name: "Unknown" }),
            customerAsset: item.customerAsset || (parent ? { productName: parent.customerAsset?.productName } : null),
            engineer: { user: { name: item.engineer?.user?.name || "Unassigned" } },
            status: liveStatus,
            source: source ? `${source.type} ${source.code}` : "-",
            sourceInfo: source,
          };
        });
        setData(mappedData);
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

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/service/visits/stats");
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
    fetchRefData();
    fetchStats();
  }, []);

  useEffect(() => {
    if (prefilledCustomerId && sourceId) {
      setIsFormOpen(true);
    }
  }, [prefilledCustomerId, sourceId]);

  const handleCreateNew = async (formData: any) => {
    try {
      const createdById = "user-1";
      const body: any = {
        title: formData.title || "Service Visit",
        notes: formData.notes,
        statusId: formData.statusId || refData.ServiceStatus?.[0]?.value,
        engineerId: formData.engineerId || refData.ServiceEngineer?.[0]?.value,
        scheduledDate: formData.visitDate || new Date().toISOString(),
        customerId: formData.customerId,
        customerAssetId: formData.assetId,
        createdById,
      };

      if (sourceType === "request" && sourceId) body.requestId = sourceId;
      if (sourceType === "complaint" && sourceId) body.complaintId = sourceId;
      if (sourceType === "defect" && sourceId) body.defectId = sourceId;
      if (sourceType === "installation" && sourceId) body.installationId = sourceId;

      const res = await fetch("/api/service/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        await fetchData();
        await fetchStats();
        setIsFormOpen(false);
        if (sourceType) router.replace("/service/visits");
      } else {
        const err = await res.json();
        alert(`Failed to create: ${err.error || "Unknown error"}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleComplete = async () => {
    if (!outcomeNotes.trim()) {
      alert("Outcome notes are required.");
      return;
    }
    setCompleting(true);
    try {
      const res = await fetch(`/api/service/visits/${completeModal.id}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcomeNotes: outcomeNotes.trim() }),
      });
      if (res.ok) {
        await fetchData();
        await fetchStats();
        setCompleteModal(null);
        setOutcomeNotes("");
        setSelectedRow(null);
      } else {
        const err = await res.json();
        alert(`Failed to complete: ${err.error || "Unknown error"}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCompleting(false);
    }
  };

  const kpiFilterMap: Record<string, (v: any) => boolean> = {
    "Total Visits": () => true,
    "Scheduled Today": (v) => {
      if (!v.scheduledDate) return false;
      const d = new Date(v.scheduledDate);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      return d >= today && d < tomorrow;
    },
    "Upcoming This Week": (v) => {
      if (!v.scheduledDate) return false;
      const d = new Date(v.scheduledDate);
      return d >= NOW && d <= new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000);
    },
    "Overdue": (v) => v.status === "Overdue",
    "Completed This Month": (v) => {
      if (v.status !== "Completed" && v.status !== "Closed") return false;
      const d = v.completedAt ? new Date(v.completedAt) : new Date(v.updatedAt);
      return d.getMonth() === NOW.getMonth() && d.getFullYear() === NOW.getFullYear();
    },
  };

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (kpiFilter && kpiFilterMap[kpiFilter]) {
        if (!kpiFilterMap[kpiFilter](item)) return false;
      }
      if (statusFilter && item.status !== statusFilter) return false;
      if (engineerFilter && item.engineerId !== engineerFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.visitCode?.toLowerCase().includes(q) ||
          item.customer?.name?.toLowerCase().includes(q) ||
          item.customerAsset?.productName?.toLowerCase().includes(q) ||
          item.engineer?.user?.name?.toLowerCase().includes(q) ||
          item.source?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [data, kpiFilter, statusFilter, engineerFilter, searchQuery]);

  const tableColumns: ColumnDef<any>[] = [
    {
      header: "Visit Date",
      accessorKey: "visitDate",
      cell: (row) => (
        <span className="text-xs text-[var(--text-secondary)] whitespace-nowrap">
          {row.visitDate ? new Date(row.visitDate).toLocaleDateString() + " " + new Date(row.visitDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}
        </span>
      ),
    },
    {
      header: "Customer",
      accessorKey: "customer.name",
      cell: (row) => <span className="text-xs font-medium text-[var(--text-primary)]">{row.customer?.name || "-"}</span>,
    },
    {
      header: "Asset",
      accessorKey: "customerAsset.productName",
      cell: (row) => <span className="text-xs text-[var(--text-secondary)]">{row.customerAsset?.productName || "-"}</span>,
    },
    {
      header: "Engineer",
      accessorKey: "engineer.user.name",
      cell: (row) => <span className="text-xs text-[var(--text-secondary)]">{row.engineer?.user?.name || "Unassigned"}</span>,
    },
    {
      header: "Source",
      accessorKey: "source",
      cell: (row) => {
        if (!row.sourceInfo) return <span className="text-xs text-[var(--text-muted)]">-</span>;
        return (
          <button
            onClick={(e) => { e.stopPropagation(); router.push(row.sourceInfo.href); }}
            className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors"
          >
            {row.sourceInfo.type}
          </button>
        );
      },
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => {
        const colorClass =
          row.status === "Overdue" ? "bg-red-500/10 text-red-500 border-red-500/20" :
          row.status === "Completed" || row.status === "Closed" ? "bg-green-500/10 text-green-500 border-green-500/20" :
          row.status === "Scheduled" || row.status === "Assigned" ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
          "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)]";
        return <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-bold border", colorClass)}>{row.status}</span>;
      },
    },
    {
      header: "Action",
      cell: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); setSelectedRow(row); }}
          className="text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline"
        >
          View
        </button>
      ),
    },
  ];

  // ── Complete Modal ──
  if (completeModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <h3 className="text-sm font-black text-[var(--text-primary)]">Complete Visit</h3>
            <button onClick={() => { setCompleteModal(null); setOutcomeNotes(""); }} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <X size={18} />
            </button>
          </div>
          <div className="space-y-2">
            <div className="text-xs text-[var(--text-secondary)]">
              <span className="font-bold">{completeModal.visitCode}</span> — {completeModal.customer?.name}
            </div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
              Outcome Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              value={outcomeNotes}
              onChange={(e) => setOutcomeNotes(e.target.value)}
              rows={4}
              placeholder="Describe the visit outcome, actions taken, and recommendations..."
              className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors placeholder-[var(--text-muted)]"
            />
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
            <button
              onClick={() => { setCompleteModal(null); setOutcomeNotes(""); }}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] text-xs font-bold transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleComplete}
              disabled={completing || !outcomeNotes.trim()}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
            >
              {completing ? "Completing..." : "Mark Completed"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Form View ──
  if (isFormOpen) {
    const initialData: any = {};
    if (prefilledCustomerId) initialData.customerId = prefilledCustomerId;
    if (prefilledAssetId) initialData.assetId = prefilledAssetId;

    return (
      <div className="py-6">
        <button
          onClick={() => { setIsFormOpen(false); router.replace("/service/visits"); }}
          className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-4"
        >
          <ChevronLeft size={16} /> Back to Visits
        </button>
        <ServiceModuleForm
          config={config}
          initialData={initialData}
          onCancel={() => { setIsFormOpen(false); router.replace("/service/visits"); }}
          onSubmit={handleCreateNew}
          relationsData={refData}
        />
      </div>
    );
  }

  // ── Detail View ──
  if (selectedRow) {
    const source = getSourceInfo(selectedRow);
    const canComplete = selectedRow.status === "Scheduled" || selectedRow.status === "Overdue" || selectedRow.status === "Assigned";

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedRow(null)}
            className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ChevronLeft size={16} /> Back to List
          </button>
          {canComplete && (
            <button
              onClick={() => setCompleteModal(selectedRow)}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors"
            >
              Mark Completed
            </button>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-wider text-[var(--text-muted)]">{selectedRow.visitCode}</span>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[11px] font-bold border",
              selectedRow.status === "Overdue" ? "bg-red-500/10 text-red-500 border-red-500/20" :
              selectedRow.status === "Completed" || selectedRow.status === "Closed" ? "bg-green-500/10 text-green-500 border-green-500/20" :
              "bg-blue-500/10 text-blue-500 border-blue-500/20"
            )}>
              {selectedRow.status}
            </span>
          </div>
          <h2 className="text-xl font-black text-[var(--text-primary)]">{selectedRow.title || "Service Visit"}</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Customer: <span className="text-[var(--text-primary)] font-semibold">{selectedRow.customer?.name || "N/A"}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4 backdrop-blur-md">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] border-b border-[var(--border)] pb-2">Visit Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-[var(--text-secondary)] block font-semibold">Visit Date</span>
                <span className="text-[var(--text-primary)] block font-medium">
                  {selectedRow.scheduledDate ? new Date(selectedRow.scheduledDate).toLocaleString() : "-"}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[var(--text-secondary)] block font-semibold">Engineer</span>
                <span className="text-[var(--text-primary)] block font-medium">{selectedRow.engineer?.user?.name || "Unassigned"}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[var(--text-secondary)] block font-semibold">Customer Asset</span>
                <span className="text-[var(--text-primary)] block font-medium">{selectedRow.customerAsset?.productName || "-"}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[var(--text-secondary)] block font-semibold">Completed At</span>
                <span className="text-[var(--text-primary)] block font-medium">
                  {selectedRow.completedAt ? new Date(selectedRow.completedAt).toLocaleString() : "-"}
                </span>
              </div>
              <div className="space-y-1 md:col-span-2">
                <span className="text-[var(--text-secondary)] block font-semibold">Notes</span>
                <span className="text-[var(--text-primary)] block font-medium">{selectedRow.notes || "-"}</span>
              </div>
              {selectedRow.outcomeNotes && (
                <div className="space-y-1 md:col-span-2">
                  <span className="text-[var(--text-secondary)] block font-semibold">Outcome Notes</span>
                  <span className="text-[var(--text-primary)] block font-medium">{selectedRow.outcomeNotes}</span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4 backdrop-blur-md">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] border-b border-[var(--border)] pb-2">Source Record</h3>
            {source ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-500">
                    {source.type}
                  </span>
                  <span className="text-xs font-mono text-[var(--text-secondary)]">{source.code}</span>
                </div>
                <button
                  onClick={() => router.push(source.href)}
                  className="text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline"
                >
                  Update {source.type} Status →
                </button>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">This visit was created standalone (no source record linked).</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── List View ──
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-[var(--text-primary)]">{config.displayTitle}</h1>
          <p className="text-xs text-[var(--text-muted)]">Schedule and track field service visits.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchData(); fetchStats(); }}
            className="p-2 border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-all"
            title="Refresh"
          >
            <RefreshCw size={15} className={cn(loading && "animate-spin")} />
          </button>
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-1 px-4 py-2 bg-brand hover:bg-brand-hover text-white font-bold rounded-lg text-xs transition-colors"
          >
            <Plus size={14} /> New Visit
          </button>
        </div>
      </div>

      <ServiceKPIGrid>
        <KPICard label="Total Visits" value={stats.total} icon={<Calendar size={20} className="text-blue-500" />} color="bg-blue-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Total Visits"} />
        <KPICard label="Scheduled Today" value={stats.scheduledToday} icon={<Clock size={20} className="text-amber-500" />} color="bg-amber-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Scheduled Today"} />
        <KPICard label="Upcoming This Week" value={stats.upcomingThisWeek} icon={<CalendarDays size={20} className="text-purple-500" />} color="bg-purple-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Upcoming This Week"} />
        <KPICard label="Overdue" value={stats.overdue} icon={<AlertTriangle size={20} className="text-red-500" />} color="bg-red-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Overdue"} />
        <KPICard label="Completed This Month" value={stats.completedThisMonth} icon={<CheckCircle size={20} className="text-green-500" />} color="bg-green-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Completed This Month"} />
      </ServiceKPIGrid>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl backdrop-blur-md">
        <div className="relative md:col-span-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by code, customer, asset, engineer..."
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
          <option value="Scheduled">Scheduled</option>
          <option value="Completed">Completed</option>
          <option value="Overdue">Overdue</option>
        </select>
        <select
          value={engineerFilter}
          onChange={(e) => setEngineerFilter(e.target.value)}
          className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] focus:outline-none focus:border-blue-500 transition-colors"
        >
          <option value="">All Engineers</option>
          {(refData.ServiceEngineer || []).map((eng: any) => (
            <option key={eng.value} value={eng.value}>{eng.label}</option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden backdrop-blur-md">
        <DataTable data={filteredData} columns={tableColumns} />
      </div>
    </div>
  );
}
