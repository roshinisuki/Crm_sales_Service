"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { Search, Plus, RefreshCw, FolderKanban, X, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/ui-utils";
import { useToast } from "@/components/ToastProvider";

interface Project {
  id: string;
  projectCode: string;
  name: string;
  status: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  customer?: { id: string; name: string; customerCode: string };
  deal?: { id: string; dealName: string; opportunityCode: string };
  _count?: { assets: number };
  assets?: any[];
  createdBy?: { id: string; name: string };
}

export default function ProjectsPage() {
  const toast = useToast();
  const [data, setData] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      const res = await fetch(`/api/service/projects?${params.toString()}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (showCreateModal) {
      fetch("/api/customer-master?status=ActiveCustomer&pageSize=500")
        .then(res => res.json())
        .then(json => {
          if (json.success) setCustomers(json.data || []);
          else if (json.data) setCustomers(json.data);
        })
        .catch(() => {});
    }
  }, [showCreateModal]);

  const handleCreate = async (formData: Record<string, any>) => {
    const res = await fetch("/api/service/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    const json = await res.json();
    if (json.success) {
      setShowCreateModal(false);
      fetchProjects();
    } else {
      toast.error(json.message || "Failed to create project");
    }
  };

  const columns: ColumnDef<any>[] = [
    { header: "Project Code", accessorKey: "projectCode", cell: (row) => <span className="text-[10px] font-mono">{row.projectCode}</span> },
    { header: "Project Name", accessorKey: "name" },
    { header: "Customer", cell: (row) => <span>{row.customer?.name || "-"}</span> },
    { header: "Assets", cell: (row) => <span className="font-bold">{row._count?.assets ?? 0}</span> },
    {
      header: "Status",
      cell: (row) => (
        <span className={cn(
          "px-2 py-0.5 rounded-full text-[11px] font-bold border",
          row.status === "Active" ? "bg-green-500/10 text-green-500 border-green-500/20" :
          row.status === "Completed" ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
          row.status === "On Hold" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
          "bg-red-500/10 text-red-500 border-red-500/20"
        )}>
          {row.status}
        </span>
      )
    },
    {
      header: "Action",
      cell: (row) => (
        <button
          onClick={() => setSelectedProject(row)}
          className="text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline"
        >
          View Details
        </button>
      )
    }
  ];

  if (selectedProject) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedProject(null)}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ChevronLeft size={14} className="inline" /> Back to Projects
          </button>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 backdrop-blur-md space-y-2">
          <span className="text-[10px] font-mono tracking-wider text-[var(--text-muted)]">{selectedProject.projectCode}</span>
          <h2 className="text-xl font-black text-[var(--text-primary)]">{selectedProject.name}</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Customer: <span className="text-[var(--text-primary)] font-semibold">{selectedProject.customer?.name || "N/A"}</span>
          </p>
          {selectedProject.deal?.dealName && (
            <p className="text-xs text-[var(--text-secondary)]">
              Deal: <span className="text-[var(--text-primary)] font-semibold">{selectedProject.deal.dealName}</span>
            </p>
          )}
          <div className="flex items-center gap-3 pt-2">
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[11px] font-bold border",
              selectedProject.status === "Active" ? "bg-green-500/10 text-green-500 border-green-500/20" :
              selectedProject.status === "Completed" ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
              selectedProject.status === "On Hold" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
              "bg-red-500/10 text-red-500 border-red-500/20"
            )}>
              {selectedProject.status}
            </span>
            {selectedProject.startDate && (
              <span className="text-[10px] text-[var(--text-muted)]">
                {new Date(selectedProject.startDate).toLocaleDateString()} — {selectedProject.endDate ? new Date(selectedProject.endDate).toLocaleDateString() : "Ongoing"}
              </span>
            )}
          </div>
          {selectedProject.notes && (
            <p className="text-xs text-[var(--text-secondary)] pt-2 border-t border-[var(--border)]">{selectedProject.notes}</p>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4 backdrop-blur-md">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
            Linked Assets ({selectedProject.assets?.length ?? 0})
          </h3>
          {selectedProject.assets && selectedProject.assets.length > 0 ? (
            <div className="space-y-2">
              {selectedProject.assets.map((asset: any) => (
                <div key={asset.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                  <div className="text-xs">
                    <div className="font-bold text-[var(--text-primary)]">{asset.productName}</div>
                    <div className="text-[10px] text-[var(--text-muted)] font-mono">{asset.serialNumber}</div>
                  </div>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                    asset.status === "Active" ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"
                  )}>
                    {asset.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)] py-4 text-center">No assets linked to this project yet.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-[var(--text-primary)]">Projects</h1>
          <p className="text-xs text-[var(--text-muted)]">Group and manage customer assets under projects.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchProjects}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand hover:bg-brand-hover text-white rounded-lg text-xs font-bold transition-colors"
          >
            <Plus size={14} /> New Project
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl backdrop-blur-md">
        <div className="relative md:col-span-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by project name, code, customer..."
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
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Completed">Completed</option>
          <option value="On Hold">On Hold</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden backdrop-blur-md">
        <DataTable data={data} columns={columns} />
      </div>

      {showCreateModal && (
        <CreateProjectModal
          customers={customers}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

function CreateProjectModal({
  customers,
  onClose,
  onCreate,
}: {
  customers: any[];
  onClose: () => void;
  onCreate: (data: Record<string, any>) => void;
}) {
  const toast = useToast();
  const [formData, setFormData] = useState<Record<string, any>>({
    name: "",
    projectCode: "",
    customerId: "",
    dealId: "",
    status: "Active",
    startDate: "",
    endDate: "",
    notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.projectCode.trim() || !formData.customerId) {
      toast.error("Name, project code, and customer are required");
      return;
    }
    onCreate(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#121214] p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="text-sm font-black text-white">New Project</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/50">Project Code *</label>
            <input
              type="text"
              required
              value={formData.projectCode}
              onChange={(e) => setFormData(p => ({ ...p, projectCode: e.target.value }))}
              placeholder="e.g. PROJ-001"
              className="w-full text-xs rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/50">Project Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
              className="w-full text-xs rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/50">Customer *</label>
            <select
              required
              value={formData.customerId}
              onChange={(e) => setFormData(p => ({ ...p, customerId: e.target.value }))}
              className="w-full text-xs rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">Select customer...</option>
              {customers.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/50">Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(p => ({ ...p, startDate: e.target.value }))}
                className="w-full text-xs rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/50">End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(p => ({ ...p, endDate: e.target.value }))}
                className="w-full text-xs rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/50">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData(p => ({ ...p, status: e.target.value }))}
              className="w-full text-xs rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
              <option value="On Hold">On Hold</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/50">Notes</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
              className="w-full text-xs rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] text-xs font-bold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg text-xs font-bold transition-colors"
            >
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
