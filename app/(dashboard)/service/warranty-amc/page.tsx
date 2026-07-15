"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { WarrantyAMCContextCard } from "@/components/shared/ServiceComponents";
import { ServiceKPICard, ServiceKPIGrid } from "@/components/shared/ServiceKPICard";
import { Search, ShieldAlert, Award, FileText, ClipboardList, LifeBuoy, AlertCircle, CalendarClock, Plus, X, Pencil } from "lucide-react";
import { cn } from "@/lib/ui-utils";
import { useToast } from "@/components/ToastProvider";

export default function WarrantyAMCPage() {
  const toast = useToast();
  const [amcContracts, setAmcContracts] = useState<any[]>([]);
  const [warrantyClaims, setWarrantyClaims] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"AMC" | "Warranty">("AMC");
  const [loading, setLoading] = useState(true);
  const [kpiFilter, setKpiFilter] = useState("");

  // AMC Create/Edit modal state
  const [showAmcModal, setShowAmcModal] = useState(false);
  const [editingAmc, setEditingAmc] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [savingAmc, setSavingAmc] = useState(false);
  const [amcForm, setAmcForm] = useState<Record<string, any>>({
    contractNumber: "",
    customerId: "",
    customerAssetId: "",
    statusId: "",
    startDate: "",
    endDate: "",
    renewalStatus: "Pending",
    planTier: "",
    preventiveVisitsIncluded: 0,
    breakdownCallsUnlimited: false,
    breakdownCallsIncluded: 0,
    sparesCoverage: "",
  });

  // Warranty Claim Create modal state
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [savingClaim, setSavingClaim] = useState(false);
  const [claimForm, setClaimForm] = useState<Record<string, any>>({
    title: "",
    description: "",
    customerId: "",
    customerAssetId: "",
    statusId: "",
    resolution: "",
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [amcRes, warrantyRes] = await Promise.all([
        fetch("/api/service/amc-contracts"),
        fetch("/api/service/warranty-claims")
      ]);
      
      if (amcRes.ok) {
        const amcData = await amcRes.json();
        setAmcContracts(amcData);
      }
      if (warrantyRes.ok) {
        const warrantyData = await warrantyRes.json();
        setWarrantyClaims(warrantyData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreateAmcModal = useCallback(async () => {
    setEditingAmc(null);
    setAmcForm({
      contractNumber: `AMC-${Date.now().toString().substring(0, 8)}`,
      customerId: "",
      customerAssetId: "",
      statusId: "",
      startDate: "",
      endDate: "",
      renewalStatus: "Pending",
      planTier: "",
      preventiveVisitsIncluded: 0,
      breakdownCallsUnlimited: false,
      breakdownCallsIncluded: 0,
      sparesCoverage: "",
    });
    try {
      const [custRes, assetRes, refRes] = await Promise.all([
        fetch("/api/customer-master?pageSize=500"),
        fetch("/api/service/assets"),
        fetch("/api/service/reference-data"),
      ]);
      if (custRes.ok) { const j = await custRes.json(); setCustomers(j.data || j || []); }
      if (assetRes.ok) { const j = await assetRes.json(); setAssets(j.data || []); }
      if (refRes.ok) { const j = await refRes.json(); setStatuses(j.ServiceStatus || []); }
    } catch (e) { console.error(e); }
    setShowAmcModal(true);
  }, []);

  const openEditAmcModal = useCallback(async (contract: any) => {
    setEditingAmc(contract);
    setAmcForm({
      contractNumber: contract.contractNumber,
      customerId: contract.customerId,
      customerAssetId: contract.customerAssetId,
      statusId: contract.statusId,
      startDate: contract.startDate ? new Date(contract.startDate).toISOString().split("T")[0] : "",
      endDate: contract.endDate ? new Date(contract.endDate).toISOString().split("T")[0] : "",
      renewalStatus: contract.renewalStatus || "Pending",
      planTier: contract.planTier || "",
      preventiveVisitsIncluded: contract.preventiveVisitsIncluded || 0,
      breakdownCallsUnlimited: contract.breakdownCallsUnlimited || false,
      breakdownCallsIncluded: contract.breakdownCallsIncluded || 0,
      sparesCoverage: contract.sparesCoverage || "",
    });
    try {
      const [custRes, assetRes, refRes] = await Promise.all([
        fetch("/api/customer-master?pageSize=500"),
        fetch("/api/service/assets"),
        fetch("/api/service/reference-data"),
      ]);
      if (custRes.ok) { const j = await custRes.json(); setCustomers(j.data || j || []); }
      if (assetRes.ok) { const j = await assetRes.json(); setAssets(j.data || []); }
      if (refRes.ok) { const j = await refRes.json(); setStatuses(j.ServiceStatus || []); }
    } catch (e) { console.error(e); }
    setShowAmcModal(true);
  }, []);

  const handleSaveAmc = useCallback(async () => {
    if (!amcForm.contractNumber || !amcForm.customerId || !amcForm.customerAssetId || !amcForm.statusId || !amcForm.startDate || !amcForm.endDate) {
      toast.error("Please fill all required fields");
      return;
    }
    setSavingAmc(true);
    try {
      const payload: Record<string, any> = {
        contractNumber: amcForm.contractNumber,
        customerId: amcForm.customerId,
        customerAssetId: amcForm.customerAssetId,
        statusId: amcForm.statusId,
        startDate: amcForm.startDate,
        endDate: amcForm.endDate,
        renewalStatus: amcForm.renewalStatus,
        planTier: amcForm.planTier || null,
        preventiveVisitsIncluded: parseInt(amcForm.preventiveVisitsIncluded) || 0,
        breakdownCallsUnlimited: amcForm.breakdownCallsUnlimited,
        breakdownCallsIncluded: parseInt(amcForm.breakdownCallsIncluded) || 0,
        sparesCoverage: amcForm.sparesCoverage || null,
      };

      let res;
      if (editingAmc) {
        res = await fetch(`/api/service/amc-contracts/${editingAmc.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/service/amc-contracts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      if (res.ok) {
        toast.success(editingAmc ? "AMC contract updated" : "AMC contract created");
        setShowAmcModal(false);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save AMC contract");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to save AMC contract");
    } finally {
      setSavingAmc(false);
    }
  }, [amcForm, editingAmc, fetchData, toast]);

  const openCreateClaimModal = useCallback(async () => {
    setClaimForm({ title: "", description: "", customerId: "", customerAssetId: "", statusId: "", resolution: "" });
    try {
      const [custRes, assetRes, refRes] = await Promise.all([
        fetch("/api/customer-master?pageSize=500"),
        fetch("/api/service/assets"),
        fetch("/api/service/reference-data"),
      ]);
      if (custRes.ok) { const j = await custRes.json(); setCustomers(j.data || j || []); }
      if (assetRes.ok) { const j = await assetRes.json(); setAssets(j.data || []); }
      if (refRes.ok) { const j = await refRes.json(); setStatuses(j.ServiceStatus || []); }
    } catch (e) { console.error(e); }
    setShowClaimModal(true);
  }, []);

  const handleSaveClaim = useCallback(async () => {
    if (!claimForm.title || !claimForm.customerId || !claimForm.customerAssetId || !claimForm.statusId) {
      toast.error("Title, customer, asset, and status are required");
      return;
    }
    setSavingClaim(true);
    try {
      const res = await fetch("/api/service/warranty-claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(claimForm),
      });
      if (res.ok) {
        toast.success("Warranty claim created");
        setShowClaimModal(false);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to create warranty claim");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to create warranty claim");
    } finally {
      setSavingClaim(false);
    }
  }, [claimForm, fetchData, toast]);

  // KPI computations from live data
  const kpiStats = useMemo(() => {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    // Combine all assets from both AMC contracts and warranty claims to count coverage
    const allAssets = new Set<string>();
    amcContracts.forEach(a => { if (a.customerAssetId) allAssets.add(a.customerAssetId); });
    warrantyClaims.forEach(w => { if (w.customerAssetId) allAssets.add(w.customerAssetId); });

    const activeWarranty = warrantyClaims.filter(w => w.status?.name === "Active" || w.status?.name === "Open").length;
    const activeAMC = amcContracts.filter(a => a.status?.name === "Active").length;

    const expiringIn30 = [
      ...amcContracts.filter(a => a.endDate && new Date(a.endDate) <= in30Days && new Date(a.endDate) >= now),
      ...warrantyClaims.filter(w => w.customerAsset?.warrantyExpiryDate && new Date(w.customerAsset.warrantyExpiryDate) <= in30Days && new Date(w.customerAsset.warrantyExpiryDate) >= now),
    ].length;

    const expired = [
      ...amcContracts.filter(a => a.endDate && new Date(a.endDate) < now),
      ...warrantyClaims.filter(w => w.customerAsset?.warrantyExpiryDate && new Date(w.customerAsset.warrantyExpiryDate) < now),
    ].length;

    return {
      totalCovered: allAssets.size,
      activeWarranty,
      activeAMC,
      expiringIn30,
      expired,
    };
  }, [amcContracts, warrantyClaims]);

  const kpiFilterMap: Record<string, () => boolean> = {
    "Total Assets Covered": () => true,
    "Active Warranty": () => activeTab === "Warranty",
    "Active AMC": () => activeTab === "AMC",
    "Expiring in 30 Days": () => true,
    "Expired": () => true,
  };

  const filteredAMC = amcContracts.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.contractNumber?.toLowerCase().includes(q) ||
      item.customerAsset?.productName?.toLowerCase().includes(q) ||
      item.customer?.name?.toLowerCase().includes(q)
    );
  });

  const filteredWarranty = warrantyClaims.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title?.toLowerCase().includes(q) ||
      item.customerAsset?.productName?.toLowerCase().includes(q) ||
      item.customer?.name?.toLowerCase().includes(q)
    );
  });

  const amcColumns: ColumnDef<any>[] = [
    { header: "Contract No.", accessorKey: "contractNumber" },
    { header: "Product", cell: (row) => row.customerAsset?.productName || "Unknown" },
    { header: "Customer", cell: (row) => row.customer?.name || "Unknown" },
    { header: "End Date", cell: (row) => row.endDate ? new Date(row.endDate).toLocaleDateString() : "-" },
    { 
      header: "Status", 
      cell: (row) => (
        <span className={cn(
          "px-2 py-0.5 rounded-full text-[11px] font-bold border",
          row.status?.name === "Active" ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)]"
        )}>
          {row.status?.name || "Unknown"}
        </span>
      )
    },
    {
      header: "Action",
      cell: (row) => (
        <button 
          onClick={() => setSelectedRecord({ type: "AMC", data: row })}
          className="text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline"
        >
          View Details
        </button>
      )
    }
  ];

  const warrantyColumns: ColumnDef<any>[] = [
    { header: "Title", accessorKey: "title" },
    { header: "Product", cell: (row) => row.customerAsset?.productName || "Unknown" },
    { header: "Customer", cell: (row) => row.customer?.name || "Unknown" },
    { header: "Claim Date", cell: (row) => row.claimDate ? new Date(row.claimDate).toLocaleDateString() : "-" },
    { 
      header: "Status", 
      cell: (row) => (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold border bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)]">
          {row.status?.name || "Unknown"}
        </span>
      )
    },
    {
      header: "Action",
      cell: (row) => (
        <button 
          onClick={() => setSelectedRecord({ type: "Warranty", data: row })}
          className="text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline"
        >
          View Details
        </button>
      )
    }
  ];

  if (selectedRecord) {
    const isAMC = selectedRecord.type === "AMC";
    const data = selectedRecord.data;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setSelectedRecord(null)}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            &larr; Back to List
          </button>
          {isAMC && (
            <button
              onClick={() => openEditAmcModal(data)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border)] bg-[var(--surface-2)] rounded-lg text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--surface-3)] transition-all"
            >
              <Pencil size={14} /> Edit Entitlements
            </button>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 backdrop-blur-md space-y-2">
          <span className="text-[10px] font-mono tracking-wider text-[var(--text-muted)]">
            {isAMC ? data.contractNumber : data.id}
          </span>
          <h2 className="text-xl font-black text-[var(--text-primary)]">
            {isAMC ? `AMC: ${data.customerAsset?.productName}` : data.title}
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Customer: <span className="text-[var(--text-primary)] font-semibold">{data.customer?.name}</span>
          </p>
          {!isAMC && data.description && (
            <p className="text-xs text-[var(--text-secondary)] mt-4 p-3 bg-[var(--surface-2)] rounded border border-[var(--border)]">
              {data.description}
            </p>
          )}
        </div>

        <div className="max-w-md">
          <WarrantyAMCContextCard 
            warrantyExpiry={data.customerAsset?.warrantyExpiryDate}
            amcExpiry={data.customerAsset?.amcExpiryDate}
            amcContract={isAMC ? data : (data.customerAsset?.AMCContract?.[0] ?? null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-[var(--text-primary)]">Warranty & AMC Contracts</h1>
          <p className="text-xs text-[var(--text-muted)]">Manage coverage verification, expiration notifications, and claims.</p>
        </div>
        {activeTab === "AMC" && (
          <button
            onClick={openCreateAmcModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand hover:bg-brand-hover text-white rounded-lg text-xs font-bold transition-colors"
          >
            <Plus size={14} /> New AMC Contract
          </button>
        )}
        {activeTab === "Warranty" && (
          <button
            onClick={openCreateClaimModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand hover:bg-brand-hover text-white rounded-lg text-xs font-bold transition-colors"
          >
            <Plus size={14} /> New Warranty Claim
          </button>
        )}
      </div>

      <ServiceKPIGrid>
        <ServiceKPICard label="Total Assets Covered" value={kpiStats.totalCovered} icon={<LifeBuoy size={20} className="text-blue-500" />} color="bg-blue-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Total Assets Covered"} />
        <ServiceKPICard label="Active Warranty" value={kpiStats.activeWarranty} icon={<ShieldAlert size={20} className="text-green-500" />} color="bg-green-500/10" onClick={(f) => { setKpiFilter(f); if (f) setActiveTab("Warranty"); }} active={kpiFilter === "Active Warranty"} />
        <ServiceKPICard label="Active AMC" value={kpiStats.activeAMC} icon={<ClipboardList size={20} className="text-purple-500" />} color="bg-purple-500/10" onClick={(f) => { setKpiFilter(f); if (f) setActiveTab("AMC"); }} active={kpiFilter === "Active AMC"} />
        <ServiceKPICard label="Expiring in 30 Days" value={kpiStats.expiringIn30} icon={<CalendarClock size={20} className="text-amber-500" />} color="bg-amber-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Expiring in 30 Days"} />
        <ServiceKPICard label="Expired" value={kpiStats.expired} icon={<AlertCircle size={20} className="text-red-500" />} color="bg-red-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Expired"} />
      </ServiceKPIGrid>

      <div className="flex items-center gap-4 border-b border-[var(--border)] pb-2">
        <button
          onClick={() => setActiveTab("AMC")}
          className={cn(
            "flex items-center gap-2 text-sm font-bold pb-2 border-b-2 transition-all",
            activeTab === "AMC" ? "border-blue-500 text-blue-500" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          )}
        >
          <ClipboardList size={16} /> AMC Contracts
        </button>
        <button
          onClick={() => setActiveTab("Warranty")}
          className={cn(
            "flex items-center gap-2 text-sm font-bold pb-2 border-b-2 transition-all",
            activeTab === "Warranty" ? "border-blue-500 text-blue-500" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          )}
        >
          <FileText size={16} /> Warranty Claims
        </button>
      </div>

      <div className="relative bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl backdrop-blur-md flex items-center">
        <Search size={14} className="absolute left-6 text-[var(--text-muted)] pointer-events-none" />
        <input 
          type="text" 
          placeholder={`Search ${activeTab === "AMC" ? "contracts" : "claims"} by title, product, or customer...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors placeholder-[var(--text-muted)]"
        />
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden backdrop-blur-md">
        {loading ? (
          <div className="p-8 text-center text-sm text-[var(--text-muted)] animate-pulse">Loading data...</div>
        ) : (
          <DataTable 
            data={activeTab === "AMC" ? filteredAMC : filteredWarranty} 
            columns={activeTab === "AMC" ? amcColumns : warrantyColumns} 
          />
        )}
      </div>

      {/* AMC Create/Edit Modal */}
      {showAmcModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-sm font-black text-[var(--text-primary)]">
                {editingAmc ? "Edit AMC Contract" : "New AMC Contract"}
              </h3>
              <button onClick={() => setShowAmcModal(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Contract Number *</label>
                  <input
                    type="text"
                    value={amcForm.contractNumber}
                    onChange={(e) => setAmcForm(p => ({ ...p, contractNumber: e.target.value }))}
                    className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Status *</label>
                  <select
                    value={amcForm.statusId}
                    onChange={(e) => setAmcForm(p => ({ ...p, statusId: e.target.value }))}
                    className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Select...</option>
                    {statuses.map((s: any) => (
                      <option key={s.value || s.id} value={s.value || s.id}>{s.label || s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Customer *</label>
                <select
                  value={amcForm.customerId}
                  onChange={(e) => setAmcForm(p => ({ ...p, customerId: e.target.value, customerAssetId: "" }))}
                  className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select customer...</option>
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Customer Asset *</label>
                <select
                  value={amcForm.customerAssetId}
                  onChange={(e) => {
                    const asset = assets.find((a: any) => a.id === e.target.value);
                    setAmcForm(p => ({ ...p, customerAssetId: e.target.value, customerId: asset?.customerId || p.customerId }));
                  }}
                  className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select asset...</option>
                  {assets
                    .filter((a: any) => !amcForm.customerId || a.customerId === amcForm.customerId)
                    .map((a: any) => (
                      <option key={a.id} value={a.id}>{a.productName} ({a.serialNumber}) — {a.customer?.name || "Unknown"}</option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Start Date *</label>
                  <input
                    type="date"
                    value={amcForm.startDate}
                    onChange={(e) => setAmcForm(p => ({ ...p, startDate: e.target.value }))}
                    className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">End Date *</label>
                  <input
                    type="date"
                    value={amcForm.endDate}
                    onChange={(e) => setAmcForm(p => ({ ...p, endDate: e.target.value }))}
                    className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="border-t border-[var(--border)] pt-3 space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">Entitlement Plan</span>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Plan Tier</label>
                    <select
                      value={amcForm.planTier}
                      onChange={(e) => setAmcForm(p => ({ ...p, planTier: e.target.value }))}
                      className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                    >
                      <option value="">None</option>
                      <option value="Basic">Basic</option>
                      <option value="Standard">Standard</option>
                      <option value="Premium">Premium</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Spares Coverage</label>
                    <select
                      value={amcForm.sparesCoverage}
                      onChange={(e) => setAmcForm(p => ({ ...p, sparesCoverage: e.target.value }))}
                      className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                    >
                      <option value="">None</option>
                      <option value="Full">Full</option>
                      <option value="Partial">Partial</option>
                      <option value="None">None</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Preventive Visits Included</label>
                    <input
                      type="number"
                      min="0"
                      value={amcForm.preventiveVisitsIncluded}
                      onChange={(e) => setAmcForm(p => ({ ...p, preventiveVisitsIncluded: e.target.value }))}
                      className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Breakdown Calls Included</label>
                    <input
                      type="number"
                      min="0"
                      value={amcForm.breakdownCallsIncluded}
                      disabled={amcForm.breakdownCallsUnlimited}
                      onChange={(e) => setAmcForm(p => ({ ...p, breakdownCallsIncluded: e.target.value }))}
                      className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 disabled:opacity-50"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={amcForm.breakdownCallsUnlimited}
                    onChange={(e) => setAmcForm(p => ({ ...p, breakdownCallsUnlimited: e.target.checked }))}
                    className="rounded"
                  />
                  Unlimited breakdown calls
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                onClick={() => setShowAmcModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAmc}
                disabled={savingAmc}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-brand hover:bg-brand-hover text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingAmc ? "Saving..." : editingAmc ? "Update Contract" : "Create Contract"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warranty Claim Create Modal */}
      {showClaimModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-sm font-black text-[var(--text-primary)]">New Warranty Claim</h3>
              <button onClick={() => setShowClaimModal(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)]">Title *</label>
                <input
                  type="text"
                  value={claimForm.title}
                  onChange={(e) => setClaimForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-brand"
                  placeholder="e.g. Defective pump replacement"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[var(--text-secondary)]">Customer *</label>
                  <select
                    value={claimForm.customerId}
                    onChange={(e) => setClaimForm(p => ({ ...p, customerId: e.target.value, customerAssetId: "" }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    <option value="">Select customer...</option>
                    {customers.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name || c.customerCode}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--text-secondary)]">Asset *</label>
                  <select
                    value={claimForm.customerAssetId}
                    onChange={(e) => setClaimForm(p => ({ ...p, customerAssetId: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    <option value="">Select asset...</option>
                    {assets
                      .filter((a: any) => !claimForm.customerId || a.customerId === claimForm.customerId)
                      .map((a: any) => (
                        <option key={a.id} value={a.id}>{a.productName} ({a.serialNumber})</option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)]">Status *</label>
                <select
                  value={claimForm.statusId}
                  onChange={(e) => setClaimForm(p => ({ ...p, statusId: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value="">Select status...</option>
                  {statuses.map((s: any) => (
                    <option key={s.value || s.id} value={s.value || s.id}>{s.label || s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)]">Description</label>
                <textarea
                  value={claimForm.description}
                  onChange={(e) => setClaimForm(p => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-brand"
                  placeholder="Describe the warranty issue..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                onClick={() => setShowClaimModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveClaim}
                disabled={savingClaim}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-brand hover:bg-brand-hover text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingClaim ? "Saving..." : "Create Claim"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
