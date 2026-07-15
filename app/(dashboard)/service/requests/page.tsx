"use client";
 
import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { serviceModulesConfig } from "@/lib/config/serviceModuleConfig";
import ServiceModuleListPage from "@/components/shared/ServiceModuleListPage";
import ServiceModuleDetailPage from "@/components/shared/ServiceModuleDetailPage";
import ServiceModuleForm from "@/components/shared/ServiceModuleForm";
import { LinkedVisitsPanel } from "@/components/shared/ServiceComponents";
import { ServiceKPICard, ServiceKPIGrid } from "@/components/shared/ServiceKPICard";
import { Calendar, FileQuestion, AlertCircle, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
 
export default function ServiceRequestsPage() {
  const config = serviceModulesConfig.requests;
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<any[]>([]);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refData, setRefData] = useState<any>({});
  const [kpiFilter, setKpiFilter] = useState("");

  // Assign Engineer Modal States
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignTeamId, setAssignTeamId] = useState("");
  const [assignEngineerId, setAssignEngineerId] = useState("");
 
  // Close Request Modal States
  const [isCloseOpen, setIsCloseOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
 
  const mapRequest = (item: any) => {
    return {
      ...item,
      requestCode: `REQ-${item.id.substring(0, 8).toUpperCase()}`,
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
    };
  };
 
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/service/requests');
      if (res.ok) {
        const json = await res.json();
        const mappedData = json.map(mapRequest);
        setData(mappedData);
 
        // Sync selectedRow live if it is currently open
        if (selectedRow) {
          const freshItem = json.find((x: any) => x.id === selectedRow.id);
          if (freshItem) {
            setSelectedRow(mapRequest(freshItem));
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
      const res = await fetch('/api/service/reference-data?module=Request');
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
 
  const handleStatusTransition = async (row: any, newStatusName?: string) => {
    const targetRow = typeof row === "string" ? null : row;
    const statusName = typeof row === "string" ? row : newStatusName;
    const finalRow = targetRow || selectedRow;
    if (!finalRow) return;
    const newStatusObj = refData.ServiceStatus?.find((s: any) => s.label === statusName);
    if (!newStatusObj) return;
 
    try {
      const res = await fetch(`/api/service/requests/${finalRow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusId: newStatusObj.value }),
      });
      if (res.ok) {
        await fetchData();
        toast.success(`Request status updated to ${statusName}`);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to update status");
    }
  };
 
  const handleTriggerAction = (row: any, actionId?: string) => {
    const targetRow = typeof row === "string" ? null : row;
    const actId = typeof row === "string" ? row : actionId;
    const finalRow = targetRow || selectedRow;
    if (!finalRow) return;
 
    if (actId === "assign") {
      if (finalRow.status === "Closed") {
        toast.error("Cannot assign an engineer to a Closed request.");
        return;
      }
      setSelectedRow(finalRow);
      setAssignTeamId(finalRow.assignedTeamId || "");
      setAssignEngineerId(finalRow.assignedEngineerId || "");
      setIsAssignOpen(true);
    } else if (actId === "close") {
      setSelectedRow(finalRow);
      setResolutionNotes("");
      setIsCloseOpen(true);
    } else {
      toast.error(`Action triggered: ${actId}`);
    }
  };
 
  const handleConfirmAssign = async () => {
    if (!selectedRow || !assignTeamId || !assignEngineerId) {
      alert("Please select both a Service Team and a Service Engineer.");
      return;
    }
 
    const assignedStatusObj = refData.ServiceStatus?.find((s: any) => s.label === "Assigned");
    if (!assignedStatusObj) {
      alert("Error: 'Assigned' status object not found in reference data.");
      return;
    }
 
    try {
      const res = await fetch(`/api/service/requests/${selectedRow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedTeamId: assignTeamId,
          assignedEngineerId: assignEngineerId,
          statusId: assignedStatusObj.value,
        }),
      });
 
      if (res.ok) {
        setIsAssignOpen(false);
        await fetchData();
      } else {
        const err = await res.json();
        alert(`Failed to assign: ${err.error || "Unknown error"}`);
      }
    } catch (e) {
      console.error(e);
    }
  };
 
  const handleConfirmClose = async () => {
    if (!selectedRow || !resolutionNotes.trim()) {
      alert("Resolution notes/outcome are required to close the request.");
      return;
    }
 
    const closedStatusObj = refData.ServiceStatus?.find((s: any) => s.label === "Closed");
    if (!closedStatusObj) {
      alert("Error: 'Closed' status object not found in reference data.");
      return;
    }
 
    const existingDesc = selectedRow.description || "";
    const updatedDescription = `${existingDesc}\n\n[Resolution Outcome]\n${resolutionNotes}`;
 
    try {
      const res = await fetch(`/api/service/requests/${selectedRow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statusId: closedStatusObj.value,
          description: updatedDescription,
          closedAt: new Date().toISOString(),
        }),
      });
 
      if (res.ok) {
        setIsCloseOpen(false);
        await fetchData();
      } else {
        const err = await res.json();
        alert(`Failed to close: ${err.error || "Unknown error"}`);
      }
    } catch (e) {
      console.error(e);
    }
  };
 
  const handleCreateNew = async (formData: any) => {
    try {
      const createdById = "user-1";
      const selectedAsset = refData.CustomerAsset?.find((a: any) => a.value === formData.assetId);
      const derivedCustomerId = formData.customerId || selectedAsset?.customerId || refData.Customer?.[0]?.value;
      const defaultStatusName = config.statusOrder[0];
      const defaultStatusObj = refData.ServiceStatus?.find((s: any) => s.label === defaultStatusName) || refData.ServiceStatus?.[0];
 
      const res = await fetch('/api/service/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title || "New Request",
          description: formData.description || "",
          categoryId: formData.categoryId || refData.ServiceCategory?.[0]?.value,
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
 
  // KPI computations from live data
  const kpiStats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
      total: data.length,
      open: data.filter(d => d.status === "New" || d.status === "Assigned").length,
      slaBreaches: data.filter(d => {
        const created = new Date(d.createdAt || d.created);
        return (d.status !== "Closed" && d.status !== "Resolved") && created < weekAgo;
      }).length,
      closedThisWeek: data.filter(d => {
        if (d.status !== "Closed") return false;
        const updated = new Date(d.updatedAt || d.closedAt || d.createdAt);
        return updated >= weekAgo;
      }).length,
    };
  }, [data]);

  const kpiFilterMap: Record<string, (d: any) => boolean> = {
    "Total Requests": () => true,
    "Open": (d) => d.status === "New" || d.status === "Assigned",
    "SLA Breaches": (d) => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return (d.status !== "Closed" && d.status !== "Resolved") && new Date(d.createdAt || d.created) < weekAgo;
    },
    "Closed This Week": (d) => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return d.status === "Closed" && new Date(d.updatedAt || d.closedAt || d.createdAt) >= weekAgo;
    },
  };

  const filteredKpiData = useMemo(() => {
    if (!kpiFilter) return data;
    return data.filter(d => kpiFilterMap[kpiFilter]?.(d) ?? true);
  }, [data, kpiFilter]);

  // Filter engineers based on the selected team
  const filteredEngineers = (refData.ServiceEngineer || []).filter(
    (eng: any) => eng.teamId === assignTeamId
  );
 
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
                onClick={() => router.push(`/service/visits?customerId=${selectedRow.customerId || ""}&customerAssetId=${selectedRow.customerAssetId || ""}&sourceType=request&sourceId=${selectedRow.id}`)}
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
            <ServiceKPICard label="Total Requests" value={kpiStats.total} icon={<FileQuestion size={20} className="text-blue-500" />} color="bg-blue-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Total Requests"} />
            <ServiceKPICard label="Open" value={kpiStats.open} icon={<AlertCircle size={20} className="text-amber-500" />} color="bg-amber-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Open"} />
            <ServiceKPICard label="SLA Breaches" value={kpiStats.slaBreaches} icon={<AlertTriangle size={20} className="text-red-500" />} color="bg-red-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "SLA Breaches"} />
            <ServiceKPICard label="Closed This Week" value={kpiStats.closedThisWeek} icon={<CheckCircle size={20} className="text-green-500" />} color="bg-green-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Closed This Week"} />
          </ServiceKPIGrid>
          <ServiceModuleListPage
            config={config}
            data={filteredKpiData}
            loading={loading}
            onRefresh={fetchData}
            onCreateNew={() => setIsFormOpen(true)}
            onRowClick={(row) => setSelectedRow(row)}
            useLeftPanel={true}
            onTriggerAction={handleTriggerAction}
            onStatusTransition={handleStatusTransition}
          />
        </div>
      )}
 
      {/* Assign Engineer Modal */}
      {isAssignOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[var(--text-primary)]">Assign Service Engineer</h3>
              <p className="text-xs text-[var(--text-secondary)]">Select the operational team and field engineer to handle this service request.</p>
            </div>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Service Team</label>
                <select
                  value={assignTeamId}
                  onChange={(e) => {
                    setAssignTeamId(e.target.value);
                    setAssignEngineerId(""); // reset selected engineer
                  }}
                  className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="">Select Team...</option>
                  {(refData.ServiceTeam || []).map((t: any) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
 
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Service Engineer</label>
                <select
                  value={assignEngineerId}
                  onChange={(e) => setAssignEngineerId(e.target.value)}
                  disabled={!assignTeamId}
                  className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select Engineer...</option>
                  {filteredEngineers.map((e: any) => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </select>
              </div>
            </div>
 
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                onClick={() => setIsAssignOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAssign}
                disabled={!assignTeamId || !assignEngineerId}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-brand hover:bg-brand-hover text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}
 
      {/* Close Request Modal */}
      {isCloseOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[var(--text-primary)]">Close Service Request</h3>
              <p className="text-xs text-[var(--text-secondary)]">Please enter the resolution notes or outcome of the service request. This field is required.</p>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Resolution Notes / Outcome</label>
              <textarea
                rows={4}
                required
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Describe how the request was resolved, parts used, visit results, etc."
                className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors placeholder-[var(--text-muted)]"
              />
            </div>
 
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                onClick={() => setIsCloseOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClose}
                disabled={!resolutionNotes.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Close Request
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
