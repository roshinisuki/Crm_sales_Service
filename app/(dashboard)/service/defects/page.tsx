"use client";
 
import React, { useState, useEffect } from "react";
import { serviceModulesConfig } from "@/lib/config/serviceModuleConfig";
import ServiceModuleListPage from "@/components/shared/ServiceModuleListPage";
import ServiceModuleDetailPage from "@/components/shared/ServiceModuleDetailPage";
import ServiceModuleForm from "@/components/shared/ServiceModuleForm";
import { LinkedVisitsPanel } from "@/components/shared/ServiceComponents";
 
export default function ServiceDefectsPage() {
  const config = serviceModulesConfig.defects;
  const [data, setData] = useState<any[]>([]);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refData, setRefData] = useState<any>({});
 
  // Interactive Modal States
  const [isCorrectiveOpen, setIsCorrectiveOpen] = useState(false);
  const [correctiveAction, setCorrectiveAction] = useState("");
 
  const [isCloseOpen, setIsCloseOpen] = useState(false);
  const [closeNotes, setCloseNotes] = useState("");
 
  const [isReopenOpen, setIsReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
 
  const mapDefect = (item: any) => ({
    ...item,
    defectCode: `DEF-${item.id.substring(0, 8).toUpperCase()}`,
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
    defectType: { name: item.defectType?.name || "Unknown" },
  });
 
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/service/defects');
      if (res.ok) {
        const json = await res.json();
        const mappedData = json.map(mapDefect);
        setData(mappedData);
 
        // Sync selectedRow live
        if (selectedRow) {
          const freshItem = json.find((x: any) => x.id === selectedRow.id);
          if (freshItem) {
            setSelectedRow(mapDefect(freshItem));
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
      const res = await fetch('/api/service/reference-data?module=defect');
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
        const res = await fetch(`/api/service/defects/${selectedRow.id}`, {
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
      const statusObj = refData.ServiceStatus?.find((s: any) => s.label === "Under Investigation");
      if (!statusObj) return;
      try {
        const res = await fetch(`/api/service/defects/${selectedRow.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ statusId: statusObj.value }),
        });
        if (res.ok) await fetchData();
      } catch (e) {
        console.error(e);
      }
    } else if (actionId === "corrective") {
      setCorrectiveAction("");
      setIsCorrectiveOpen(true);
    } else if (actionId === "close") {
      setCloseNotes("");
      setIsCloseOpen(true);
    } else if (actionId === "reopen") {
      setReopenReason("");
      setIsReopenOpen(true);
    }
  };
 
  const handleConfirmCorrective = async () => {
    if (!selectedRow || !correctiveAction.trim()) return;
    const statusObj = refData.ServiceStatus?.find((s: any) => s.label === "Corrective Action");
    if (!statusObj) return;
 
    const existingDesc = selectedRow.description || "";
    const updatedDescription = `${existingDesc}\n\n[Corrective Action]\n${correctiveAction}`;
 
    try {
      const res = await fetch(`/api/service/defects/${selectedRow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statusId: statusObj.value,
          description: updatedDescription,
        }),
      });
      if (res.ok) {
        setIsCorrectiveOpen(false);
        await fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };
 
  const handleConfirmClose = async () => {
    if (!selectedRow || !closeNotes.trim()) return;
    const statusObj = refData.ServiceStatus?.find((s: any) => s.label === "Closed");
    if (!statusObj) return;
 
    const existingDesc = selectedRow.description || "";
    const updatedDescription = `${existingDesc}\n\n[Close Notes]\n${closeNotes}`;
 
    try {
      const res = await fetch(`/api/service/defects/${selectedRow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statusId: statusObj.value,
          description: updatedDescription,
          closedAt: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        setIsCloseOpen(false);
        await fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };
 
  const handleConfirmReopen = async () => {
    if (!selectedRow || !reopenReason.trim()) return;
    const statusObj = refData.ServiceStatus?.find((s: any) => s.label === "Under Investigation");
    if (!statusObj) return;
 
    const existingDesc = selectedRow.description || "";
    const updatedDescription = `${existingDesc}\n\n[Reopen Reason]\n${reopenReason}`;
 
    try {
      const res = await fetch(`/api/service/defects/${selectedRow.id}`, {
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
 
  const handleCreateNew = async (formData: any) => {
    try {
      const createdById = "user-1";
      // Fix form creation mapping: read assetId instead of customerAssetId
      const selectedAsset = refData.CustomerAsset?.find((a: any) => a.value === formData.assetId);
      const derivedCustomerId = formData.customerId || selectedAsset?.customerId || refData.Customer?.[0]?.value;
      const defaultStatusName = config.statusOrder[0];
      const defaultStatusObj = refData.ServiceStatus?.find((s: any) => s.label === defaultStatusName) || refData.ServiceStatus?.[0];
 
      const res = await fetch('/api/service/defects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title || formData.details || "New Defect",
          description: formData.details || formData.description,
          categoryId: formData.categoryId || refData.ServiceCategory?.[0]?.value,
          defectTypeId: formData.defectTypeId || refData.DefectType?.[0]?.value,
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
          customWidgets={<LinkedVisitsPanel visits={selectedRow.visits} />}
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
        <ServiceModuleListPage 
          config={config} 
          data={data} 
          loading={loading}
          onRefresh={fetchData}
          onCreateNew={() => setIsFormOpen(true)}
          onRowClick={(row) => setSelectedRow(row)}
        />
      )}
 
      {/* Log Corrective Action Modal */}
      {isCorrectiveOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[var(--text-primary)]">Log Corrective Action</h3>
              <p className="text-xs text-[var(--text-secondary)]">Please enter details of the corrective action taken to fix this product defect.</p>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Corrective Action Taken</label>
              <textarea
                rows={4}
                required
                value={correctiveAction}
                onChange={(e) => setCorrectiveAction(e.target.value)}
                placeholder="Log the repairs, updates, or assembly adjustments completed..."
                className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors placeholder-[var(--text-muted)]"
              />
            </div>
 
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                onClick={() => setIsCorrectiveOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCorrective}
                disabled={!correctiveAction.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Log Corrective Action
              </button>
            </div>
          </div>
        </div>
      )}
 
      {/* Close Defect Modal */}
      {isCloseOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[var(--text-primary)]">Close Product Defect</h3>
              <p className="text-xs text-[var(--text-secondary)]">Provide final verification/closing notes for this defect record.</p>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Closing Verification Notes</label>
              <textarea
                rows={4}
                required
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="Details verifying the defect is fully resolved..."
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
                disabled={!closeNotes.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Close Defect
              </button>
            </div>
          </div>
        </div>
      )}
 
      {/* Reopen Defect Modal */}
      {isReopenOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[var(--text-primary)]">Reopen Defect</h3>
              <p className="text-xs text-[var(--text-secondary)]">Enter a reason for reopening this closed defect (e.g. recurrence details).</p>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Reopen Reason</label>
              <textarea
                rows={4}
                required
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Why is this defect being reopened?..."
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
                Reopen Defect
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
