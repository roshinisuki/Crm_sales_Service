"use client";
 
import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { serviceModulesConfig } from "@/lib/config/serviceModuleConfig";
import ServiceModuleListPage from "@/components/shared/ServiceModuleListPage";
import ServiceModuleDetailPage from "@/components/shared/ServiceModuleDetailPage";
import ServiceModuleForm from "@/components/shared/ServiceModuleForm";
import { LinkedVisitsPanel } from "@/components/shared/ServiceComponents";
import { ServiceKPICard, ServiceKPIGrid } from "@/components/shared/ServiceKPICard";
import { Calendar, AlertTriangle, Search as SearchIcon, TrendingUp, CheckCircle, RotateCcw } from "lucide-react";
 
export default function ServiceComplaintsPage() {
  const config = serviceModulesConfig.complaints;
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refData, setRefData] = useState<any>({});
  const [kpiFilter, setKpiFilter] = useState("");

  // Interactive Modal States
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
 
  const [isReopenOpen, setIsReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
 
  const mapComplaint = (item: any) => ({
    ...item,
    complaintCode: `COMP-${item.id.substring(0, 8).toUpperCase()}`,
    customer: { name: item.customer?.name || "Unknown" },
    asset: item.customerAsset ? {
      productName: item.customerAsset.productName || "Unknown",
      purchaseDate: item.customerAsset.purchaseDate,
      warrantyExpiryDate: item.customerAsset.warrantyExpiryDate,
      amcExpiryDate: item.customerAsset.amcExpiryDate,
    } : null,
    team: { name: item.assignedTeam?.name || "Unassigned" },
    engineer: { user: { name: item.assignedEngineer?.user?.name || "Unassigned" } },
    status: item.status?.name || "Unknown",
    priority: item.priority?.name || "Unknown",
    complaintType: { name: item.complaintType?.name || "Unknown" },
    details: item.description || "", // fix details binding
  });
 
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/service/complaints');
      if (res.ok) {
        const json = await res.json();
        const mappedData = json.map(mapComplaint);
        setData(mappedData);
 
        // Sync selectedRow live
        if (selectedRow) {
          const freshItem = json.find((x: any) => x.id === selectedRow.id);
          if (freshItem) {
            setSelectedRow(mapComplaint(freshItem));
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
      const res = await fetch('/api/service/reference-data?module=complaint');
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
 
  const handleStatusTransition = async (newStatusName: string) => {
    if (selectedRow) {
      const newStatusObj = refData.ServiceStatus?.find((s: any) => s.label === newStatusName);
      if (!newStatusObj) return;
 
      try {
        const res = await fetch(`/api/service/complaints/${selectedRow.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ statusId: newStatusObj.value }),
        });
        if (res.ok) {
          await fetchData();
        }
      } catch (e) {
        console.error(e);
      }
    }
  };
 
  const handleTriggerAction = async (actionId: string) => {
    if (!selectedRow) return;
 
    if (actionId === "investigate") {
      const statusObj = refData.ServiceStatus?.find((s: any) => s.label === "Investigating");
      if (!statusObj) return;
      try {
        const res = await fetch(`/api/service/complaints/${selectedRow.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ statusId: statusObj.value }),
        });
        if (res.ok) await fetchData();
      } catch (e) {
        console.error(e);
      }
    } else if (actionId === "resolve") {
      setResolutionNotes("");
      setIsResolveOpen(true);
    } else if (actionId === "close") {
      if (confirm("Are you sure you want to close this complaint?")) {
        const statusObj = refData.ServiceStatus?.find((s: any) => s.label === "Closed");
        if (!statusObj) return;
        try {
          const res = await fetch(`/api/service/complaints/${selectedRow.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ statusId: statusObj.value, closedAt: new Date().toISOString() }),
          });
          if (res.ok) await fetchData();
        } catch (e) {
          console.error(e);
        }
      }
    } else if (actionId === "reopen") {
      setReopenReason("");
      setIsReopenOpen(true);
    }
  };
 
  const handleConfirmResolve = async () => {
    if (!selectedRow || !resolutionNotes.trim()) return;
    const statusObj = refData.ServiceStatus?.find((s: any) => s.label === "Resolved");
    if (!statusObj) return;
 
    const existingDesc = selectedRow.description || "";
    const updatedDescription = `${existingDesc}\n\n[Resolution Outcome]\n${resolutionNotes}`;
 
    try {
      const res = await fetch(`/api/service/complaints/${selectedRow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statusId: statusObj.value,
          description: updatedDescription,
        }),
      });
      if (res.ok) {
        setIsResolveOpen(false);
        await fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };
 
  const handleConfirmReopen = async () => {
    if (!selectedRow || !reopenReason.trim()) return;
    const statusObj = refData.ServiceStatus?.find((s: any) => s.label === "Investigating");
    if (!statusObj) return;
 
    const existingDesc = selectedRow.description || "";
    const updatedDescription = `${existingDesc}\n\n[Reopen Reason]\n${reopenReason}`;
 
    try {
      const res = await fetch(`/api/service/complaints/${selectedRow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statusId: statusObj.value,
          description: updatedDescription,
        }),
      });
      if (res.ok) {
        setIsReopenOpen(false);
        await fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };
 
  // KPI computations from live data
  const kpiStats = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return {
      total: data.length,
      openInvestigating: data.filter(d => d.status === "Open" || d.status === "Investigating" || d.status === "In Progress").length,
      escalatedToDefect: data.filter(d => d.status === "Escalated" || d.status === "Escalated to Defect").length,
      resolvedThisWeek: data.filter(d => {
        if (d.status !== "Resolved" && d.status !== "Closed") return false;
        const updated = new Date(d.updatedAt || d.closedAt || d.createdAt);
        return updated >= weekAgo;
      }).length,
      reopened: data.filter(d => d.status === "Reopened" || d.status === "Investigating").length,
    };
  }, [data]);

  const kpiFilterMap: Record<string, (d: any) => boolean> = {
    "Total Complaints": () => true,
    "Open/Investigating": (d) => d.status === "Open" || d.status === "Investigating" || d.status === "In Progress",
    "Escalated to Defect": (d) => d.status === "Escalated" || d.status === "Escalated to Defect",
    "Resolved This Week": (d) => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return (d.status === "Resolved" || d.status === "Closed") && new Date(d.updatedAt || d.closedAt || d.createdAt) >= weekAgo;
    },
    "Reopened": (d) => d.status === "Reopened" || d.status === "Investigating",
  };

  const filteredKpiData = useMemo(() => {
    if (!kpiFilter) return data;
    return data.filter(d => kpiFilterMap[kpiFilter]?.(d) ?? true);
  }, [data, kpiFilter]);

  const handleCreateNew = async (formData: any) => {
    try {
      const createdById = "user-1";
      // Fix form creation mapping: read assetId instead of customerAssetId
      const selectedAsset = refData.CustomerAsset?.find((a: any) => a.value === formData.assetId);
      const derivedCustomerId = formData.customerId || selectedAsset?.customerId || refData.Customer?.[0]?.value;
      const defaultStatusName = config.statusOrder[0];
      const defaultStatusObj = refData.ServiceStatus?.find((s: any) => s.label === defaultStatusName) || refData.ServiceStatus?.[0];
 
      const res = await fetch('/api/service/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title || formData.details || "New Complaint",
          description: formData.details || formData.description,
          categoryId: formData.categoryId || refData.ServiceCategory?.[0]?.value,
          complaintTypeId: formData.complaintTypeId || refData.ComplaintType?.[0]?.value,
          priorityId: formData.priorityId || refData.PriorityLevel?.[0]?.value,
          statusId: formData.statusId || defaultStatusObj?.value,
          customerId: derivedCustomerId,
          customerAssetId: formData.assetId,
          assignedTeamId: formData.assignedTeamId,
          assignedEngineerId: formData.assignedEngineerId,
          createdById,
        }),
      });
 
      if (res.ok) {
        await fetchData();
        setIsFormOpen(false);
      } else {
        const err = await res.json();
        alert(`Failed to create: ${err.error || "Unknown error"}`);
      }
    } catch (e) {
      console.error(e);
    }
  };
 
  return (
    <>
      {selectedRow ? (
        <ServiceModuleDetailPage 
          config={config} 
          data={selectedRow} 
          onBack={() => setSelectedRow(null)}
          onStatusTransition={handleStatusTransition}
          onTriggerAction={handleTriggerAction}
          customWidgets={
            <div className="space-y-4">
              <button
                onClick={() => router.push(`/service/visits?customerId=${selectedRow.customerId || ""}&customerAssetId=${selectedRow.customerAssetId || ""}&sourceType=complaint&sourceId=${selectedRow.id}`)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg text-xs font-bold transition-colors"
              >
                <Calendar size={14} /> Log Service Visit
              </button>
              <LinkedVisitsPanel visits={selectedRow.visits} />
            </div>
          }
        />
      ) : isFormOpen ? (
        <div className="py-6">
          <ServiceModuleForm 
            config={config} 
            onCancel={() => setIsFormOpen(false)} 
            onSubmit={handleCreateNew}
            relationsData={refData}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <ServiceKPIGrid>
            <ServiceKPICard label="Total Complaints" value={kpiStats.total} icon={<AlertTriangle size={20} className="text-blue-500" />} color="bg-blue-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Total Complaints"} />
            <ServiceKPICard label="Open/Investigating" value={kpiStats.openInvestigating} icon={<SearchIcon size={20} className="text-amber-500" />} color="bg-amber-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Open/Investigating"} />
            <ServiceKPICard label="Escalated to Defect" value={kpiStats.escalatedToDefect} icon={<TrendingUp size={20} className="text-red-500" />} color="bg-red-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Escalated to Defect"} />
            <ServiceKPICard label="Resolved This Week" value={kpiStats.resolvedThisWeek} icon={<CheckCircle size={20} className="text-green-500" />} color="bg-green-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Resolved This Week"} />
            <ServiceKPICard label="Reopened" value={kpiStats.reopened} icon={<RotateCcw size={20} className="text-purple-500" />} color="bg-purple-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Reopened"} />
          </ServiceKPIGrid>
          <ServiceModuleListPage
            config={config}
            data={filteredKpiData}
            loading={loading}
            onRefresh={fetchData}
            onCreateNew={() => setIsFormOpen(true)}
            onRowClick={(row) => setSelectedRow(row)}
          />
        </div>
      )}
 
      {/* Resolve Complaint Modal */}
      {isResolveOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[var(--text-primary)]">Resolve Complaint</h3>
              <p className="text-xs text-[var(--text-secondary)]">Please enter the resolution notes or actions taken to resolve the complaint.</p>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Resolution Notes</label>
              <textarea
                rows={4}
                required
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Describe how the complaint was resolved..."
                className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors placeholder-[var(--text-muted)]"
              />
            </div>
 
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                onClick={() => setIsResolveOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmResolve}
                disabled={!resolutionNotes.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Mark Resolved
              </button>
            </div>
          </div>
        </div>
      )}
 
      {/* Reopen Complaint Modal */}
      {isReopenOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[var(--text-primary)]">Reopen Complaint</h3>
              <p className="text-xs text-[var(--text-secondary)]">Provide the customer dispute details or reasons for reopening this complaint.</p>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Dispute / Reopen Reason</label>
              <textarea
                rows={4}
                required
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Reason for reopening..."
                className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors placeholder-[var(--text-muted)]"
              />
            </div>
 
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                onClick={() => setIsReopenOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReopen}
                disabled={!reopenReason.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reopen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
