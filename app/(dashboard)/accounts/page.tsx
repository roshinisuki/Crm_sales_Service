"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCustomersAction, createCustomerAction, updateCustomerAction, deleteCustomersAction } from "@/app/actions/customers";
import { getUsersAction } from "@/app/actions/users";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useGlobalLoading } from "@/components/GlobalLoadingProvider";

const Icons = {
  plus: "M12 4v16m8-8H4",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  filter: "M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z",
  edit: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  trash: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
  x: "M6 18L18 6M6 6l12 12",
};

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Prospect: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  ActiveCustomer: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  Renewed: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  Churned: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  Inactive: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.Inactive;
  const label = status === "ActiveCustomer" ? "Active Customer" : status;
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}>
      {label}
    </span>
  );
}

export default function AccountsPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { startLoading, stopLoading } = useGlobalLoading();
  const [search, setSearch] = useState("");
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [cityFilter, setCityFilter] = useState("");
  const [leadSourceFilter, setLeadSourceFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [executives, setExecutives] = useState<any[]>([]);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const toast = useToast();
  const [confirmState, setConfirmState] = useState<{isOpen: boolean; title: string; message: string; action: () => void}>({ isOpen: false, title: "", message: "", action: () => {} });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [formData, setFormData] = useState({
    id: "",
    customerCode: "",
    name: "",
    email: "",
    phone: "",
    city: "",
    status: "Prospect",
    assignedUserId: "",
    leadSource: "",
    accountType: "Prospect",
    gstNumber: "",
    industryType: "",
    billingAddress: "",
    shippingAddress: "",
    creditLimit: "",
    creditTermsDays: "30",
  });

  const loadCustomers = async () => {
    setLoading(true);
    setError("");
    startLoading("Loading accounts...");
    try {
      const params: any = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (cityFilter) params.city = cityFilter;
      if (leadSourceFilter) params.leadSource = leadSourceFilter;

      const res = await getCustomersAction(params);
      if (res.success && res.data) {
        setCustomers(res.data);
      } else {
        setError(res.message || "Failed to load accounts");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load accounts");
    } finally {
      setLoading(false);
      stopLoading();
    }
  };

  const loadExecutives = async () => {
    if (user?.role === "Admin" || user?.role === "SalesManager") {
      const res = await getUsersAction();
      if (res.success && res.data) {
        setExecutives(res.data.filter((u: any) => u.role === "SalesExecutive"));
      }
    }
  };

  useEffect(() => {
    setStatusFilter(searchParams.get("status") || "");
  }, [searchParams]);

  useEffect(() => {
    loadCustomers();
  }, [search, cityFilter, leadSourceFilter, statusFilter]);

  useEffect(() => {
    loadExecutives();
  }, [user]);

  const openCreateModal = () => {
    setFormData({
      id: "",
      customerCode: "",
      name: "",
      email: "",
      phone: "",
      city: "",
      status: "Prospect",
      assignedUserId: "",
      leadSource: "",
      accountType: "Prospect",
      gstNumber: "",
      industryType: "",
      billingAddress: "",
      shippingAddress: "",
      creditLimit: "",
      creditTermsDays: "30",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (c: any) => {
    setFormData({
      id: c.id,
      customerCode: c.customerCode,
      name: c.name,
      email: c.email || "",
      phone: c.phone || "",
      city: c.city || "",
      status: c.status,
      assignedUserId: c.assignedUserId || "",
      leadSource: c.leadSource || "",
      accountType: c.accountType || "Prospect",
      gstNumber: c.gstNumber || "",
      industryType: c.industryType || "",
      billingAddress: c.billingAddress || "",
      shippingAddress: c.shippingAddress || "",
      creditLimit: c.creditLimit || 0,
      creditTermsDays: c.creditTermsDays || 30,
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");

    if (!formData.name.trim()) {
      setFormError("Customer Name is required");
      setFormLoading(false);
      return;
    }

    if (formData.gstNumber) {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
      if (!gstinRegex.test(formData.gstNumber)) {
        setFormError("Invalid GSTIN format");
        setFormLoading(false);
        return;
      }
    }

    let res;
    if (formData.id) {
      res = await updateCustomerAction(formData);
    } else {
      res = await createCustomerAction(formData);
    }

    if (res.success) {
      setIsModalOpen(false);
      toast.success(res.message || "Account saved successfully");
      loadCustomers();
    } else {
      setFormError(res.message || "Failed to save account");
    }
    setFormLoading(false);
  };

  const toggleAll = () => {
    if (selectedIds.length === filteredCustomers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCustomers.map(c => c.id));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleDeleteSelected = () => {
    setConfirmState({
      isOpen: true,
      title: "Delete Accounts",
      message: `Are you sure you want to delete ${selectedIds.length} account(s)? This will permanently erase all associated data including visits, subscriptions, and portal access.`,
      action: async () => {
        setIsDeleting(true);
        const res = await deleteCustomersAction(selectedIds);
        setIsDeleting(false);
        if (res.success) {
          toast.success(res.message || "Accounts deleted successfully");
          setSelectedIds([]);
          loadCustomers();
        } else {
          toast.error(res.message || "Failed to delete accounts");
        }
      }
    });
  };

  const handleDeleteOne = (c: any) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Account",
      message: `Delete "${c.name}" (${c.customerCode})? This will permanently erase all associated data.`,
      action: async () => {
        setIsDeleting(true);
        const res = await deleteCustomersAction([c.id]);
        setIsDeleting(false);
        if (res.success) {
          toast.success(`"${c.name}" has been deleted`);
          setSelectedIds(prev => prev.filter(x => x !== c.id));
          loadCustomers();
        } else {
          toast.error(res.message || "Failed to delete account");
        }
      }
    });
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setCityFilter("");
    setLeadSourceFilter("");
  };

  const activeCount = customers.filter(c => c.status === "ActiveCustomer" || c.status === "Renewed").length;
  const prospectCount = customers.filter(c => c.status === "Prospect").length;
  const churnedCount = customers.filter(c => c.status === "Churned").length;
  const inactiveCount = customers.filter(c => c.status === "Inactive").length;

  const filteredCustomers = customers.filter(c => {
    if (statusFilter) {
      if (statusFilter === "ActiveCustomer" && c.status !== "ActiveCustomer" && c.status !== "Renewed") return false;
      if (statusFilter !== "ActiveCustomer" && c.status !== statusFilter) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Accounts</h1>
                <p className="text-sm text-slate-500">Manage customer accounts and track their lifecycle</p>
              </div>
              {statusFilter && (
                <button
                  onClick={() => setStatusFilter("")}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                >
                  Clear Filter
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={Icons.filter} />
                </svg>
                Filters
                {(search || statusFilter || cityFilter || leadSourceFilter) && (
                  <span className="w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </button>
              <button
                onClick={openCreateModal}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={Icons.plus} />
                </svg>
                New Account
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div 
            onClick={() => setStatusFilter("")}
            className={`rounded-xl p-5 border cursor-pointer transition-colors ${statusFilter === "" ? "bg-blue-50 border-blue-200 ring-1 ring-blue-500" : "bg-white border-slate-200 hover:bg-slate-50"}`}
          >
            <div className={`text-sm font-medium ${statusFilter === "" ? "text-blue-700" : "text-slate-500"}`}>Total Accounts</div>
            <div className="text-2xl font-semibold text-slate-900 mt-1">{customers.length}</div>
          </div>
          <div 
            onClick={() => setStatusFilter(statusFilter === "ActiveCustomer" ? "" : "ActiveCustomer")}
            className={`rounded-xl p-5 border cursor-pointer transition-colors ${statusFilter === "ActiveCustomer" ? "bg-emerald-50 border-emerald-200 ring-1 ring-emerald-500" : "bg-white border-slate-200 hover:bg-slate-50"}`}
          >
            <div className={`text-sm font-medium ${statusFilter === "ActiveCustomer" ? "text-emerald-700" : "text-slate-500"}`}>Active</div>
            <div className="text-2xl font-semibold text-emerald-600 mt-1">{activeCount}</div>
          </div>
          <div 
            onClick={() => setStatusFilter(statusFilter === "Prospect" ? "" : "Prospect")}
            className={`rounded-xl p-5 border cursor-pointer transition-colors ${statusFilter === "Prospect" ? "bg-amber-50 border-amber-200 ring-1 ring-amber-500" : "bg-white border-slate-200 hover:bg-slate-50"}`}
          >
            <div className={`text-sm font-medium ${statusFilter === "Prospect" ? "text-amber-700" : "text-slate-500"}`}>Prospects</div>
            <div className="text-2xl font-semibold text-amber-600 mt-1">{prospectCount}</div>
          </div>
          <div 
            onClick={() => setStatusFilter(statusFilter === "Churned" ? "" : "Churned")}
            className={`rounded-xl p-5 border cursor-pointer transition-colors ${statusFilter === "Churned" ? "bg-rose-50 border-rose-200 ring-1 ring-rose-500" : "bg-white border-slate-200 hover:bg-slate-50"}`}
          >
            <div className={`text-sm font-medium ${statusFilter === "Churned" ? "text-rose-700" : "text-slate-500"}`}>Churned</div>
            <div className="text-2xl font-semibold text-rose-600 mt-1">{churnedCount}</div>
          </div>
          <div 
            onClick={() => setStatusFilter(statusFilter === "Inactive" ? "" : "Inactive")}
            className={`rounded-xl p-5 border cursor-pointer transition-colors ${statusFilter === "Inactive" ? "bg-slate-100 border-slate-300 ring-1 ring-slate-400" : "bg-white border-slate-200 hover:bg-slate-50"}`}
          >
            <div className={`text-sm font-medium ${statusFilter === "Inactive" ? "text-slate-700" : "text-slate-500"}`}>Inactive</div>
            <div className="text-2xl font-semibold text-slate-600 mt-1">{inactiveCount}</div>
          </div>
        </div>

        {isFilterOpen && (
          <div className="bg-white rounded-xl p-5 border border-slate-200 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Filters</h3>
              <button onClick={clearFilters} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Clear all
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Search</label>
                <input
                  type="text"
                  placeholder="Search by name or code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="Prospect">Prospect</option>
                  <option value="ActiveCustomer">Active Customer</option>
                  <option value="Renewed">Renewed</option>
                  <option value="Churned">Churned</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">City</label>
                <input
                  type="text"
                  placeholder="Filter by city..."
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Lead Source</label>
                <select
                  value={leadSourceFilter}
                  onChange={(e) => setLeadSourceFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">All Sources</option>
                  <option value="Website">Website</option>
                  <option value="Facebook">Facebook</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Referral">Referral</option>
                  <option value="Cold Call">Cold Call</option>
                  <option value="Trade Show">Trade Show</option>
                  <option value="Email Campaign">Email Campaign</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {selectedIds.length > 0 && (
            <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
              <span className="text-sm font-medium">{selectedIds.length} account(s) selected</span>
              <button
                onClick={handleDeleteSelected}
                disabled={isDeleting}
                className="px-4 py-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete Selected"}
              </button>
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center text-slate-500">Loading accounts...</div>
          ) : error ? (
            <div className="p-12 text-center">
              <div className="text-red-600 mb-2">{error}</div>
              <button onClick={loadCustomers} className="text-blue-600 hover:text-blue-700 font-medium">
                Retry
              </button>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <div className="text-4xl mb-4">📋</div>
              <div className="text-lg font-medium text-slate-700 mb-2">No accounts found</div>
              <p className="text-sm text-slate-400">
                {search || statusFilter || cityFilter || leadSourceFilter
                  ? "Try adjusting your filters"
                  : "Create your first account to get started"}
              </p>
              {!search && !statusFilter && !cityFilter && !leadSourceFilter && (
                <button
                  onClick={openCreateModal}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Create Account
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Account Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">City</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Account Type</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/customer-master/${c.id}`)}
                    >
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{c.customerCode}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center text-xs font-bold">
                            {c.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-900">{c.name}</div>
                            <div className="text-xs text-slate-500">{c.email || "No email"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{c.city || "-"}</td>
                      <td className="px-6 py-4"><StatusBadge status={c.status} /></td>
                      <td className="px-6 py-4 text-sm text-slate-600">{c.accountType || "-"}</td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(c)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d={Icons.edit} />
                            </svg>
                          </button>
                          {(user?.role === "Admin" || user?.role === "SalesManager") && (
                            <button
                              onClick={() => handleDeleteOne(c)}
                              disabled={isDeleting}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d={Icons.trash} />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {formData.id ? "Edit Account" : "Create New Account"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={Icons.x} />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                {formError && (
                  <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Customer Code <span className="text-red-500">*</span>
                    </label>
                    {!formData.id ? (
                      <div className="px-3 py-2 bg-slate-100 rounded-lg text-sm text-slate-500">
                        Auto-generated (ACC-NNNNN format)
                      </div>
                    ) : (
                      <input
                        type="text"
                        disabled
                        value={formData.customerCode}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-500 cursor-not-allowed"
                      />
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Account Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter account name"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="account@example.com"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="City"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="Prospect">Prospect</option>
                      <option value="ActiveCustomer">Active Customer</option>
                      <option value="Renewed">Renewed</option>
                      <option value="Churned">Churned</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Account Type</label>
                    <select
                      value={formData.accountType}
                      onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="Prospect">Prospect</option>
                      <option value="Customer">Customer</option>
                      <option value="Partner">Partner</option>
                      <option value="Vendor">Vendor</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Lead Source</label>
                    <select
                      value={formData.leadSource}
                      onChange={(e) => setFormData({ ...formData, leadSource: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="">Select Source</option>
                      <option value="Website">Website</option>
                      <option value="Facebook">Facebook</option>
                      <option value="LinkedIn">LinkedIn</option>
                      <option value="Referral">Referral</option>
                      <option value="Cold Call">Cold Call</option>
                      <option value="Trade Show">Trade Show</option>
                      <option value="Email Campaign">Email Campaign</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">GST Number</label>
                    <input
                      type="text"
                      value={formData.gstNumber}
                      onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                      placeholder="22AAAAA0000A1Z5"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase"
                    />
                    <p className="text-xs text-slate-400 mt-1">15-character GSTIN format</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Industry Type</label>
                    <input
                      type="text"
                      value={formData.industryType}
                      onChange={(e) => setFormData({ ...formData, industryType: e.target.value })}
                      placeholder="e.g., Manufacturing, Healthcare"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Billing Address</label>
                    <textarea
                      value={formData.billingAddress}
                      onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                      placeholder="Enter billing address"
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Shipping Address</label>
                    <textarea
                      value={formData.shippingAddress}
                      onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
                      placeholder="Enter shipping address"
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Credit Limit</label>
                    <input
                      type="number"
                      value={formData.creditLimit}
                      onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Credit Terms (Days)</label>
                    <input
                      type="number"
                      value={formData.creditTermsDays}
                      onChange={(e) => setFormData({ ...formData, creditTermsDays: e.target.value })}
                      placeholder="30"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  {(user?.role === "Admin" || user?.role === "SalesManager") && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Assign to Executive</label>
                      <select
                        value={formData.assignedUserId}
                        onChange={(e) => setFormData({ ...formData, assignedUserId: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value="">Unassigned</option>
                        {executives.map((exec) => (
                          <option key={exec.id} value={exec.id}>{exec.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {formLoading ? "Saving..." : "Save Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.action}
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
        isDestructive={true}
      />
    </div>
  );
}
