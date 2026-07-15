"use client";
 
import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { serviceModulesConfig } from "@/lib/config/serviceModuleConfig";
import ServiceModuleListPage from "@/components/shared/ServiceModuleListPage";
import ServiceModuleDetailPage from "@/components/shared/ServiceModuleDetailPage";
import ServiceModuleForm from "@/components/shared/ServiceModuleForm";
import { LinkedVisitsPanel } from "@/components/shared/ServiceComponents";
import { ServiceKPICard, ServiceKPIGrid } from "@/components/shared/ServiceKPICard";
import { Hammer, Calendar, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
 
export default function ServiceInstallationsPage() {
  const config = serviceModulesConfig.installations;
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<any[]>([]);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refData, setRefData] = useState<any>({});
  const [kpiFilter, setKpiFilter] = useState("");

  // Interactive Modal States
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
 
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [completeDate, setCompleteDate] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
 
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleNotes, setRescheduleNotes] = useState("");
 
  const [isFailOpen, setIsFailOpen] = useState(false);
  const [failReason, setFailReason] = useState("");
 
  const mapInstallation = (item: any) => ({
    ...item,
    installationCode: `INST-${item.id.substring(0, 8).toUpperCase()}`,
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
  });
 
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/service/installations');
      if (res.ok) {
        const json = await res.json();
        const mappedData = json.map(mapInstallation);
        setData(mappedData);
 
        // Sync selectedRow live
        if (selectedRow) {
          const freshItem = json.find((x: any) => x.id === selectedRow.id);
          if (freshItem) {
            setSelectedRow(mapInstallation(freshItem));
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
      const res = await fetch('/api/service/reference-data?module=installation');
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
        const res = await fetch(`/api/service/installations/${selectedRow.id}`, {
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
 
    if (actionId === "start") {
      setStartDate(new Date().toISOString().substring(0, 16));
      setIsStartOpen(true);
    } else if (actionId === "complete") {
      setCompleteDate(new Date().toISOString().substring(0, 16));
      setCompletionNotes("");
      setIsCompleteOpen(true);
    } else if (actionId === "reschedule") {
      setRescheduleDate("");
      setRescheduleNotes("");
      setIsRescheduleOpen(true);
    } else if (actionId === "fail") {
      setFailReason("");
      setIsFailOpen(true);
    }
  };
 
  const handleConfirmStart = async () => {
    if (!selectedRow || !startDate) return;
    const statusObj = refData.ServiceStatus?.find((s: any) => s.label === "In Progress");
    if (!statusObj) return;
 
    const existingDesc = selectedRow.description || "";
    const updatedDescription = `${existingDesc}\n\n[Installation Started]\nDate: ${new Date(startDate).toLocaleString()}`;
 
    try {
      const res = await fetch(`/api/service/installations/${selectedRow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statusId: statusObj.value,
          description: updatedDescription,
        }),
      });
      if (res.ok) {
        setIsStartOpen(false);
        await fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };
 
  const handleConfirmComplete = async () => {
    if (!selectedRow || !completeDate || !completionNotes.trim()) return;
    const statusObj = refData.ServiceStatus?.find((s: any) => s.label === "Completed");
    if (!statusObj) return;
 
    const existingDesc = selectedRow.description || "";
    const updatedDescription = `${existingDesc}\n\n[Installation Completed]\nDate: ${new Date(completeDate).toLocaleString()}\nNotes: ${completionNotes}`;
 
    try {
      const res = await fetch(`/api/service/installations/${selectedRow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statusId: statusObj.value,
          description: updatedDescription,
          closedAt: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        setIsCompleteOpen(false);
        await fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };
 
  const handleConfirmReschedule = async () => {
    if (!selectedRow || !rescheduleDate || !rescheduleNotes.trim()) return;
 
    const existingDesc = selectedRow.description || "";
    const updatedDescription = `${existingDesc}\n\n[Rescheduled]\nNew Target Date: ${new Date(rescheduleDate).toLocaleString()}\nReason: ${rescheduleNotes}`;
 
    try {
      const res = await fetch(`/api/service/installations/${selectedRow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: updatedDescription,
        }),
      });
      if (res.ok) {
        setIsRescheduleOpen(false);
        await fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };
 
  const handleConfirmFail = async () => {
    if (!selectedRow || !failReason.trim()) return;
    const statusObj = refData.ServiceStatus?.find((s: any) => s.label === "Scheduled");
    if (!statusObj) return;
 
    const existingDesc = selectedRow.description || "";
    const updatedDescription = `${existingDesc}\n\n[Installation Failed / Needs Follow-up]\nReason: ${failReason}`;
 
    try {
      const res = await fetch(`/api/service/installations/${selectedRow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statusId: statusObj.value,
          description: updatedDescription,
        }),
      });
      if (res.ok) {
        setIsFailOpen(false);
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
      scheduled: data.filter(d => d.status === "Scheduled" || d.status === "New" || d.status === "Assigned").length,
      inProgress: data.filter(d => d.status === "In Progress").length,
      completedThisWeek: data.filter(d => {
        if (d.status !== "Completed" && d.status !== "Closed") return false;
        const updated = new Date(d.updatedAt || d.closedAt || d.createdAt);
        return updated >= weekAgo;
      }).length,
    };
  }, [data]);
 
  const kpiFilterMap: Record<string, (d: any) => boolean> = {
    "Total Installations": () => true,
    "Scheduled": (d) => d.status === "Scheduled" || d.status === "New" || d.status === "Assigned",
    "In Progress": (d) => d.status === "In Progress",
    "Completed This Week": (d) => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return (d.status === "Completed" || d.status === "Closed") && new Date(d.updatedAt || d.closedAt || d.createdAt) >= weekAgo;
    },
  };
 
  const filteredKpiData = useMemo(() => {
    if (!kpiFilter) return data;
    return data.filter(d => kpiFilterMap[kpiFilter]?.(d) ?? true);
  }, [data, kpiFilter]);
 
  const handleCreateNew = async (formData: any) => {
    try {
      const createdById = user?.id || "user-1";
      const selectedAsset = refData.CustomerAsset?.find((a: any) => a.value === formData.assetId);
      const derivedCustomerId = formData.customerId || selectedAsset?.customerId || refData.Customer?.[0]?.value;
      const defaultStatusName = config.statusOrder[0];
      const defaultStatusObj = refData.ServiceStatus?.find((s: any) => s.label === defaultStatusName) || refData.ServiceStatus?.[0];
 
      const res = await fetch('/api/service/installations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title || formData.description || "New Installation",
          description: formData.description,
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
        toast.error(`Failed to create: ${err.error || "Unknown error"}`);
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
                onClick={() => router.push(`/service/visits?customerId=${selectedRow.customerId || ""}&customerAssetId=${selectedRow.customerAssetId || ""}&sourceType=installation&sourceId=${selectedRow.id}`)}
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
            <ServiceKPICard label="Total Installations" value={kpiStats.total} icon={<Hammer size={20} className="text-blue-500" />} color="bg-blue-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Total Installations"} />
            <ServiceKPICard label="Scheduled" value={kpiStats.scheduled} icon={<Calendar size={20} className="text-amber-500" />} color="bg-amber-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Scheduled"} />
            <ServiceKPICard label="In Progress" value={kpiStats.inProgress} icon={<Clock size={20} className="text-purple-500" />} color="bg-purple-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "In Progress"} />
            <ServiceKPICard label="Completed This Week" value={kpiStats.completedThisWeek} icon={<CheckCircle size={20} className="text-green-500" />} color="bg-green-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Completed This Week"} />
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
 
      {/* Start Installation Modal */}
      {isStartOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[var(--text-primary)]">Start Installation</h3>
              <p className="text-xs text-[var(--text-secondary)]">Confirm the start time for the equipment commissioning/installation.</p>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Start Date & Time</label>
              <input
                type="datetime-local"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
 
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                onClick={() => setIsStartOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStart}
                disabled={!startDate}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-brand hover:bg-brand-hover text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Commissioning
              </button>
            </div>
          </div>
        </div>
      )}
 
      {/* Complete Installation Modal */}
      {isCompleteOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[var(--text-primary)]">Complete Installation</h3>
              <p className="text-xs text-[var(--text-secondary)]">Log completion details, sign-offs, or configuration results.</p>
            </div>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Completion Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={completeDate}
                  onChange={(e) => setCompleteDate(e.target.value)}
                  className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
 
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Completion Notes / Checklist</label>
                <textarea
                  rows={4}
                  required
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Verify connection, pressure test ok, manual handed over, etc."
                  className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors placeholder-[var(--text-muted)]"
                />
              </div>
            </div>
 
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                onClick={() => setIsCompleteOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmComplete}
                disabled={!completeDate || !completionNotes.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Complete Installation
              </button>
            </div>
          </div>
        </div>
      )}
 
      {/* Reschedule Modal */}
      {isRescheduleOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[var(--text-primary)]">Reschedule Installation</h3>
              <p className="text-xs text-[var(--text-secondary)]">Select a new target date and log reschedule notes.</p>
            </div>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">New Scheduled Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
 
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Reason for Rescheduling</label>
                <textarea
                  rows={3}
                  required
                  value={rescheduleNotes}
                  onChange={(e) => setRescheduleNotes(e.target.value)}
                  placeholder="Provide client request, technician unavailability details, etc."
                  className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors placeholder-[var(--text-muted)]"
                />
              </div>
            </div>
 
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                onClick={() => setIsRescheduleOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReschedule}
                disabled={!rescheduleDate || !rescheduleNotes.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-brand hover:bg-brand-hover text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reschedule
              </button>
            </div>
          </div>
        </div>
      )}
 
      {/* Mark Failed Modal */}
      {isFailOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[var(--text-primary)]">Mark Installation Failed</h3>
              <p className="text-xs text-[var(--text-secondary)]">Provide details explaining why installation failed or requires follow-up. This will move status back to Scheduled.</p>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Failure Reason / Follow-up Details</label>
              <textarea
                rows={4}
                required
                value={failReason}
                onChange={(e) => setFailReason(e.target.value)}
                placeholder="Missing components, site power failure, layout mismatched..."
                className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors placeholder-[var(--text-muted)]"
              />
            </div>
 
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                onClick={() => setIsFailOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmFail}
                disabled={!failReason.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Fail & Re-schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
