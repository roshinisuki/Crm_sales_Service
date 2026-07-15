"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { WarrantyAMCContextCard, AssetHistoryPanel } from "@/components/shared/ServiceComponents";
import { ServiceKPICard, ServiceKPIGrid } from "@/components/shared/ServiceKPICard";
import { Search, Plus, Filter, HardDrive, RefreshCw, Calendar, ChevronLeft, Package, AlertCircle, CheckCircle, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/ui-utils";
import { useToast } from "@/components/ToastProvider";

export default function CustomerAssetsPage() {
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [assetVisits, setAssetVisits] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [kpiFilter, setKpiFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("All");
  const [projects, setProjects] = useState<any[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [customers, setCustomers] = useState<any[]>([]);
  const toast = useToast();

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (projectFilter !== "All") params.set("projectId", projectFilter);
      const res = await fetch(`/api/service/assets?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch customer assets:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, projectFilter]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  useEffect(() => {
    fetch("/api/service/projects")
      .then(res => res.json())
      .then(json => { if (json.success) setProjects(json.data || []); })
      .catch(() => {});
    fetch("/api/customer-master?pageSize=500")
      .then(res => res.json())
      .then(json => { setCustomers(json.data || json || []); })
      .catch(() => {});
  }, []);

  const openEditModal = (asset: any) => {
    setEditForm({
      id: asset.id,
      serialNumber: asset.serialNumber || "",
      productName: asset.productName || "",
      customerId: asset.customerId || "",
      status: asset.status || "Active",
      purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split("T")[0] : "",
      warrantyExpiryDate: asset.warrantyExpiryDate ? new Date(asset.warrantyExpiryDate).toISOString().split("T")[0] : "",
      amcExpiryDate: asset.amcExpiryDate ? new Date(asset.amcExpiryDate).toISOString().split("T")[0] : "",
    });
    setShowEditModal(true);
  };

  const handleSaveAsset = async () => {
    try {
      const res = await fetch(`/api/service/assets/${editForm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        toast.success("Asset updated successfully");
        setShowEditModal(false);
        fetchAssets();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to update asset");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to update asset");
    }
  };

  // Fetch visits when an asset is selected
  useEffect(() => {
    if (selectedAsset) {
      fetch(`/api/service/visits?customerAssetId=${selectedAsset.id}`)
        .then(res => res.ok ? res.json() : [])
        .then(json => setAssetVisits(json))
        .catch(() => setAssetVisits([]));
    } else {
      setAssetVisits([]);
    }
  }, [selectedAsset]);

  // KPI computations from live data
  const kpiStats = useMemo(() => {
    const now = new Date();
    return {
      total: data.length,
      newlyOnboarded: data.filter(d => !d.serialNumber || d.serialNumber === "" || d.installationStatus === "Pending").length,
      installedActive: data.filter(d => d.status === "Active" || d.installationStatus === "Installed").length,
      underWarranty: data.filter(d => d.warrantyExpiryDate && new Date(d.warrantyExpiryDate) > now).length,
      underAMC: data.filter(d => d.amcExpiryDate && new Date(d.amcExpiryDate) > now).length,
    };
  }, [data]);

  const kpiFilterMap: Record<string, (d: any) => boolean> = {
    "Total Assets": () => true,
    "Newly Onboarded": (d) => !d.serialNumber || d.serialNumber === "" || d.installationStatus === "Pending",
    "Installed & Active": (d) => d.status === "Active" || d.installationStatus === "Installed",
    "Under Warranty": (d) => d.warrantyExpiryDate && new Date(d.warrantyExpiryDate) > new Date(),
    "Under AMC": (d) => d.amcExpiryDate && new Date(d.amcExpiryDate) > new Date(),
  };

  const filteredData = data.filter(item => {
    if (kpiFilter && kpiFilterMap[kpiFilter] && !kpiFilterMap[kpiFilter](item)) return false;
    if (projectFilter !== "All" && item.projectId !== projectFilter) return false;
    if (statusFilter !== "All" && item.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const serialMatch = item.serialNumber.toLowerCase().includes(q);
      const nameMatch = item.productName.toLowerCase().includes(q);
      const customerMatch = item.customer.name.toLowerCase().includes(q);
      if (!serialMatch && !nameMatch && !customerMatch) return false;
    }
    return true;
  });

  const columns: ColumnDef<any>[] = [
    { header: "Serial Number", accessorKey: "serialNumber" },
    { header: "Product Name", accessorKey: "productName" },
    { header: "Customer", cell: (row) => <span>{row.customer?.name || "-"}</span> },
    { header: "Project", cell: (row) => <span className="text-[10px] font-mono">{row.project?.projectCode || "-"}</span> },
    { header: "Purchase Date", cell: (row) => <span>{row.purchaseDate ? new Date(row.purchaseDate).toLocaleDateString() : "-"}</span> },
    { header: "Originating PO", cell: (row) => <span className="text-[10px] font-mono">{row.purchaseOrder?.poCode || "-"}</span> },
    { 
      header: "Status", 
      cell: (row) => (
        <span className={cn(
          "px-2 py-0.5 rounded-full text-[11px] font-bold border",
          row.status === "Active" ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"
        )}>
          {row.status}
        </span>
      )
    },
    {
      header: "Action",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedAsset(row)}
            className="text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline"
          >
            View
          </button>
          <button
            onClick={() => openEditModal(row)}
            className="text-xs font-bold text-amber-400 hover:text-amber-300 hover:underline"
          >
            Edit
          </button>
        </div>
      )
    }
  ];  if (selectedAsset) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setSelectedAsset(null)}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            &larr; Back to Installed Products
          </button>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 backdrop-blur-md space-y-2">
          <span className="text-[10px] font-mono tracking-wider text-[var(--text-muted)]">{selectedAsset.serialNumber}</span>
          <h2 className="text-xl font-black text-[var(--text-primary)]">{selectedAsset.productName}</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Assigned Customer: <span className="text-[var(--text-primary)] font-semibold">{selectedAsset.customer?.name || "N/A"}</span>
          </p>
          {selectedAsset.purchaseOrder?.poCode && (
            <p className="text-xs text-[var(--text-secondary)]">
              Originating PO: <span className="text-[var(--text-primary)] font-mono font-semibold">{selectedAsset.purchaseOrder.poCode}</span>
            </p>
          )}
          {selectedAsset.deal?.opportunityCode && (
            <p className="text-xs text-[var(--text-secondary)]">
              Originating Opportunity: <span className="text-[var(--text-primary)] font-mono font-semibold">{selectedAsset.deal.opportunityCode}</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <AssetHistoryPanel events={selectedAsset.history || []} />

 {/* Service Visits Section */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)]">Service Visits</h3>
                <button
                  onClick={() => router.push(`/service/visits?customerId=${selectedAsset.customerId || ""}&customerAssetId=${selectedAsset.id}`)}
                  className="flex items-center gap-1 px-3 py-1 bg-brand hover:bg-brand-hover text-white rounded-lg text-[10px] font-bold transition-colors"
                >
                  <Calendar size={12} /> Log Visit
                </button>
              </div>
              {assetVisits.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] py-4 text-center">No service visits logged for this asset yet.</p>
              ) : (
                <div className="space-y-2">
                  {assetVisits.map((v: any) => {
                    const statusName = v.status?.name || "Unknown";
                    const isOverdue = (statusName === "Scheduled" || statusName === "Assigned") && v.scheduledDate && new Date(v.scheduledDate) < new Date();
                    const liveStatus = isOverdue ? "Overdue" : statusName;
                    return (
                      <div key={v.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                        <div className="flex items-center gap-3">
                          <div className="text-xs">
                            <div className="font-bold text-[var(--text-primary)]">
                              {v.scheduledDate ? new Date(v.scheduledDate).toLocaleDateString() : "Unscheduled"}
                            </div>
                            <div className="text-[10px] text-[var(--text-secondary)]">{v.engineer?.user?.name || "Unassigned"}</div>
                          </div>
                        </div>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                          liveStatus === "Overdue" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                          liveStatus === "Completed" || liveStatus === "Closed" ? "bg-green-500/10 text-green-500 border-green-500/20" :
                          "bg-blue-500/10 text-blue-500 border-blue-500/20"
                        )}>
                          {liveStatus}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <WarrantyAMCContextCard 
              purchaseDate={selectedAsset.purchaseDate}
              warrantyExpiry={selectedAsset.warrantyExpiryDate}
              amcExpiry={selectedAsset.amcExpiryDate}
              amcContract={selectedAsset.AMCContract?.[0] ?? null}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-[var(--text-primary)]">Customer Assets (Installed Products)</h1>
          <p className="text-xs text-[var(--text-muted)]">Trace registered product serial numbers, warranty, and AMC coverages.</p>
        </div>
        <button
          onClick={fetchAssets}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <ServiceKPIGrid>
        <ServiceKPICard label="Total Assets" value={kpiStats.total} icon={<Package size={20} className="text-blue-500" />} color="bg-blue-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Total Assets"} />
        <ServiceKPICard label="Newly Onboarded" value={kpiStats.newlyOnboarded} icon={<AlertCircle size={20} className="text-amber-500" />} color="bg-amber-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Newly Onboarded"} />
        <ServiceKPICard label="Installed & Active" value={kpiStats.installedActive} icon={<CheckCircle size={20} className="text-green-500" />} color="bg-green-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Installed & Active"} />
        <ServiceKPICard label="Under Warranty" value={kpiStats.underWarranty} icon={<ShieldCheck size={20} className="text-purple-500" />} color="bg-purple-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Under Warranty"} />
        <ServiceKPICard label="Under AMC" value={kpiStats.underAMC} icon={<ShieldCheck size={20} className="text-cyan-500" />} color="bg-cyan-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Under AMC"} />
      </ServiceKPIGrid>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl backdrop-blur-md">
        <div className="relative md:col-span-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input 
            type="text" 
            placeholder="Search assets by serial code, product name, customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors placeholder-[var(--text-muted)]"
          />
        </div>

        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] focus:outline-none focus:border-blue-500 transition-colors"
        >
          <option value="All">All Projects</option>
          {projects.map((p: any) => (
            <option key={p.id} value={p.id}>{p.projectCode} — {p.name}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] focus:outline-none focus:border-blue-500 transition-colors"
        >
          <option value="All">All Coverage Statuses</option>
          <option value="Active">Active Coverage</option>
          <option value="Expired">Expired / No Coverage</option>
        </select>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden backdrop-blur-md">
        <DataTable data={filteredData} columns={columns} />
      </div>

      {/* Edit Asset Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-sm font-black text-[var(--text-primary)]">Edit Asset</h3>
              <button onClick={() => setShowEditModal(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[var(--text-secondary)]">Serial Number</label>
                  <input
                    type="text"
                    value={editForm.serialNumber || ""}
                    onChange={(e) => setEditForm(p => ({ ...p, serialNumber: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--text-secondary)]">Product Name</label>
                  <input
                    type="text"
                    value={editForm.productName || ""}
                    onChange={(e) => setEditForm(p => ({ ...p, productName: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)]">Customer</label>
                <select
                  value={editForm.customerId || ""}
                  onChange={(e) => setEditForm(p => ({ ...p, customerId: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value="">Select customer...</option>
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name || c.customerCode}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)]">Status</label>
                <select
                  value={editForm.status || "Active"}
                  onChange={(e) => setEditForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Under Warranty">Under Warranty</option>
                  <option value="Under AMC">Under AMC</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-[var(--text-secondary)]">Purchase Date</label>
                  <input
                    type="date"
                    value={editForm.purchaseDate || ""}
                    onChange={(e) => setEditForm(p => ({ ...p, purchaseDate: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--text-secondary)]">Warranty Expiry</label>
                  <input
                    type="date"
                    value={editForm.warrantyExpiryDate || ""}
                    onChange={(e) => setEditForm(p => ({ ...p, warrantyExpiryDate: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--text-secondary)]">AMC Expiry</label>
                  <input
                    type="date"
                    value={editForm.amcExpiryDate || ""}
                    onChange={(e) => setEditForm(p => ({ ...p, amcExpiryDate: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAsset}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-brand hover:bg-brand-hover text-white transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
