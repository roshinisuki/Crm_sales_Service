"use client";

import { useState, useEffect } from "react";
import { PageShell } from "@/components/ui/PageShell";
import PageContainer from "@/components/PageContainer";
import { useToast } from "@/components/ToastProvider";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import {
  getLeadSourcesAction,
  createLeadSourceAction,
  updateLeadSourceAction
} from "@/app/actions/leadSources";
import { Plus, ToggleLeft, ToggleRight, Edit2, Check, X, RefreshCw } from "lucide-react";

export default function LeadSourcesSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [leadSources, setLeadSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form input states
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getLeadSourcesAction();
      if (res.success && res.data) {
        setLeadSources(res.data);
      } else {
        toast.error(res.message || "Failed to load lead sources");
      }
    } catch (err: any) {
      toast.error("Error loading lead sources");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      if (user.role !== "Admin" && user.role !== "SalesManager") {
        router.replace("/dashboard");
      } else {
        loadData();
      }
    }
  }, [user, authLoading, router]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error("Lead source name is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await createLeadSourceAction({ name: newName });
      if (res.success) {
        toast.success(res.message || "Lead source added successfully");
        setNewName("");
        loadData();
      } else {
        toast.error(res.message || "Failed to add lead source");
      }
    } catch (err) {
      toast.error("An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const res = await updateLeadSourceAction(id, { isActive: !currentActive });
      if (res.success) {
        toast.success(
          `Lead source ${!currentActive ? "activated" : "deactivated"} successfully`
        );
        loadData();
      } else {
        toast.error(res.message || "Failed to update lead source status");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
  };

  const startEdit = (source: any) => {
    setEditingId(source.id);
    setEditingName(source.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editingName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    setSubmitting(true);
    try {
      const res = await updateLeadSourceAction(editingId, { name: editingName });
      if (res.success) {
        toast.success("Lead source updated successfully");
        setEditingId(null);
        setEditingName("");
        loadData();
      } else {
        toast.error(res.message || "Failed to update lead source name");
      }
    } catch (err) {
      toast.error("An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user || (user.role !== "Admin" && user.role !== "SalesManager")) {
    return null;
  }

  return (
    <PageShell
      title="Configurable Lead Sources"
      subtitle="Configure lead channel options and deactivations for your dropdown master list"
    >
      <PageContainer className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left pane: Add Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-black text-[#B3592D] uppercase tracking-wider mb-4">
              Add New Lead Source
            </h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">
                  Lead Source Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Partner Portal, Facebook Ads"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#B3592D]/15 focus:border-[#B3592D] transition-all font-medium text-slate-700"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer disabled:opacity-50"
              >
                <Plus size={14} /> {submitting ? "Adding..." : "Add Lead Source"}
              </button>
            </form>
          </div>
        </div>

        {/* Right pane: List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-[#FAF6F3]">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">Company Lead Sources</h3>
                <p className="text-[10px] text-slate-500 font-medium">Manage channels and active/inactive status</p>
              </div>
              <button
                onClick={loadData}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                title="Refresh"
              >
                <RefreshCw size={15} />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {loading ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Loading lead sources...
                </div>
              ) : leadSources.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No lead sources found. Add one on the left.
                </div>
              ) : (
                leadSources.map((source) => (
                  <div key={source.id} className="p-4 flex items-center justify-between gap-4">
                    {editingId === source.id ? (
                      <form onSubmit={handleSaveEdit} className="flex-1 flex gap-2">
                        <input
                          type="text"
                          required
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={submitting}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                        >
                          <X size={16} />
                        </button>
                      </form>
                    ) : (
                      <div className="flex-1 flex items-center justify-between">
                        <div>
                          <span className={`text-sm font-bold block ${source.isActive ? "text-slate-800" : "text-slate-400 line-through"}`}>
                            {source.name}
                          </span>
                          {!source.companyId && (
                            <span className="text-[9px] bg-slate-150 text-slate-500 font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                              Global Default
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Edit button (only editable if company-scoped lead source) */}
                          {source.companyId ? (
                            <button
                              onClick={() => startEdit(source)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit Name"
                            >
                              <Edit2 size={13} />
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium italic">Read-only</span>
                          )}

                          {/* Toggle Active Switch */}
                          <button
                            onClick={() => handleToggleActive(source.id, source.isActive)}
                            className="cursor-pointer"
                            title={source.isActive ? "Deactivate" : "Activate"}
                          >
                            {source.isActive ? (
                              <ToggleRight size={26} className="text-emerald-500" />
                            ) : (
                              <ToggleLeft size={26} className="text-slate-300" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </PageContainer>
    </PageShell>
  );
}
