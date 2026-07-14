"use client";

import { useState, useEffect } from "react";
import { getSubscriptionsAction, createSubscriptionAction, updateSubscriptionAction, renewSubscriptionAction } from "@/app/actions/subscriptions";
import { getCustomersAction } from "@/app/actions/customers";
import { Subscription, Customer } from "@/types";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/PageContainer";
import { useAuth } from "@/components/AuthProvider";
import { validateDateRange } from "@/lib/formValidation";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  plus: "M12 4v16m8-8H4",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  check: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  alert: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  chart: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  x: "M6 18L18 6M6 6l12 12",
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    "Active": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "Expiring": "bg-amber-50 text-amber-700 border-amber-200",
    "Expired": "bg-red-50 text-red-600 border-red-200",
    "Renewed": "bg-slate-100 text-slate-600 border-slate-300",
    "Pending": "bg-blue-50 text-blue-700 border-blue-200",
  };
  return (
    <span className={`inline-flex items-center justify-center w-24 px-2 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${styles[status] || "bg-slate-100"}`}>
      {status === "Expiring" && (
        <span className="relative flex h-1.5 w-1.5 mr-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
        </span>
      )}
      {status}
    </span>
  );
}

export default function SubscriptionsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);

  // Renewal states
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [renewPlanName, setRenewPlanName] = useState("");
  const [renewStartDate, setRenewStartDate] = useState("");
  const [renewEndDate, setRenewEndDate] = useState("");
  const [renewNotes, setRenewNotes] = useState("");

  const [formData, setFormData] = useState({
    customerId: "",
    planName: "",
    startDate: "",
    endDate: "",
    status: "Active" as "Active" | "Expired" | "Cancelled" | "Pending",
    notes: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [subRes, custRes] = await Promise.all([
        getSubscriptionsAction({}),
        getCustomersAction(),
      ]);
      if (subRes.success) setSubscriptions(subRes.data || []);
      if (custRes.success) setCustomers((custRes.data || []) as Customer[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const params = new URLSearchParams(window.location.search);
    if (params.get("add") === "true") {
      setTimeout(() => {
        openCreateModal();
        router.replace(window.location.pathname, { scroll: false });
      }, 100);
    }
  }, [router]);

  const openCreateModal = () => {
    setIsEdit(false);
    setSelectedSub(null);
    setFormData({
      customerId: "",
      planName: "",
      startDate: "",
      endDate: "",
      status: "Active",
      notes: "",
    });
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const openEditModal = (sub: Subscription) => {
    setIsEdit(true);
    setSelectedSub(sub);
    setFormData({
      customerId: sub.customerId,
      planName: sub.planName,
      startDate: sub.startDate ? new Date(sub.startDate).toISOString().split('T')[0] : "",
      endDate: sub.endDate ? new Date(sub.endDate).toISOString().split('T')[0] : "",
      status: sub.status as any,
      notes: sub.notes || "",
    });
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleCreateForApproved = (cId: string) => {
    setIsEdit(false);
    setSelectedSub(null);
    setFormData({
      customerId: cId,
      planName: "",
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
      status: "Active",
      notes: "",
    });
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setErrorMsg("");

    if (!formData.customerId || !formData.planName || !formData.startDate || !formData.endDate) {
      setErrorMsg("Customer, plan name, start and end date are required");
      setFormLoading(false);
      return;
    }

    const dateErr = validateDateRange(formData.startDate, formData.endDate, "Start date", "End date");
    if (dateErr) { setErrorMsg(dateErr); setFormLoading(false); return; }

    let res;
    if (isEdit && selectedSub) {
      res = await updateSubscriptionAction(selectedSub.id, {
        planName: formData.planName,
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: formData.status,
        notes: formData.notes,
      });
    } else {
      res = await createSubscriptionAction({
        customerId: formData.customerId,
        planName: formData.planName,
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: formData.status,
        notes: formData.notes,
      });
    }

    if (res.success) {
      setIsModalOpen(false);
      loadData();
    } else {
      setErrorMsg(res.message || "Failed to process subscription");
    }
    setFormLoading(false);
  };

  const openRenewModal = (sub: Subscription) => {
    setSelectedSub(sub);
    setRenewPlanName(sub.planName);
    const nextStart = new Date(sub.endDate);
    nextStart.setDate(nextStart.getDate() + 1);
    setRenewStartDate(nextStart.toISOString().split('T')[0]);
    const nextEnd = new Date(nextStart);
    nextEnd.setFullYear(nextEnd.getFullYear() + 1);
    setRenewEndDate(nextEnd.toISOString().split('T')[0]);
    setRenewNotes("");
    setErrorMsg("");
    setIsRenewModalOpen(true);
  };

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setErrorMsg("");

    if (!selectedSub || !renewPlanName || !renewStartDate || !renewEndDate) {
      setErrorMsg("Plan name, start and end date are required.");
      setFormLoading(false);
      return;
    }

    if (new Date(renewEndDate) <= new Date(renewStartDate)) {
      setErrorMsg("End date must be after start date.");
      setFormLoading(false);
      return;
    }

    const res = await renewSubscriptionAction({
      oldSubscriptionId: selectedSub.id,
      planName: renewPlanName,
      startDate: renewStartDate,
      endDate: renewEndDate,
      notes: renewNotes,
    });

    if (res.success) {
      setIsRenewModalOpen(false);
      loadData();
    } else {
      setErrorMsg(res.message || "Failed to renew subscription.");
    }
    setFormLoading(false);
  };


  const existingSubCustomerIds = new Set(subscriptions.map(s => s.customerId));
  const activeCustomerIds = new Set(
    subscriptions
      .filter(s => s.status === "Active" || s.status === "Expiring")
      .map(s => s.customerId)
  );

  const approvedPendingSubs: Subscription[] = customers
    .filter(c => c.status === "ActiveCustomer" && !existingSubCustomerIds.has(c.id))
    .map(c => ({
      id: `virtual-pending-${c.id}`,
      customerId: c.id,
      planName: "— (Plan Not Assigned)",
      startDate: "",
      endDate: "",
      status: "Pending" as any,
      notes: "Customer is approved. Click '+ Setup Plan' to establish their subscription.",
      createdAt: c.createdAt || "",
      updatedAt: c.updatedAt || "",
      customer: {
        id: c.id,
        name: c.name,
        customerCode: c.customerCode,
      } as any
    }));

  // Sort "Pending", "Expiring", and "Expired" subscriptions to the top
  const allSubs = [...subscriptions, ...approvedPendingSubs].sort((a, b) => {
    const getPriority = (status: string) => {
      if (status === "Pending") return 0;
      if (status === "Expiring" || status === "Expired") return 1;
      return 2;
    };
    return getPriority(a.status) - getPriority(b.status);
  });

  const filtered = allSubs.filter((s) => {
    const custName = s.customer?.name?.toLowerCase() || "";
    const plan = s.planName.toLowerCase();
    const term = search.toLowerCase();
    const matchesSearch = custName.includes(term) || plan.includes(term) || s.customerId.includes(term);
    const matchesStatus = statusFilter ? s.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  return (
    <PageContainer>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Subscriptions</h1>
          <p className="text-sm text-slate-500 mt-1">Manage customer plans, renewals, and expirations.</p>
        </div>
        {user?.role !== "SalesExecutive" && (
          <button 
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors shadow-sm cursor-pointer"
          >
            <Ico d={icons.plus} size={16} />
            Add Subscription
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Active - Green palette */}
        <div className="kpi-completed">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active</p>
            <div className="w-9 h-9 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center">
              <Ico d={icons.check} size={18} className="text-emerald-600" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-black text-slate-800">{allSubs.filter(s => s.status === "Active").length}</p>
            <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Active subscriptions</p>
          </div>
        </div>

        {/* Expiring - Amber palette */}
        <div className="kpi-pending">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Expiring Soon</p>
            <div className="w-9 h-9 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center relative">
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <Ico d={icons.clock} size={18} className="text-amber-600" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-black text-slate-800">{allSubs.filter(s => s.status === "Expiring").length}</p>
            <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Renew soon</p>
          </div>
        </div>

        {/* Expired - Red palette */}
        <div className="kpi-overdue">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Expired</p>
            <div className="w-9 h-9 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center">
              <Ico d={icons.alert} size={18} className="text-red-600" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-black text-slate-800">{allSubs.filter(s => s.status === "Expired").length}</p>
            <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Expired plans</p>
          </div>
        </div>

        {/* Pending - Blue palette */}
        <div className="kpi-total">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending</p>
            <div className="w-9 h-9 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center">
              <Ico d={icons.chart} size={18} className="text-slate-600" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-black text-slate-800">{allSubs.filter(s => s.status === "Pending").length}</p>
            <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Pending setup</p>
          </div>
        </div>
      </div>



      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col w-full min-w-0">
        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <Ico d={icons.search} size={16} />
            </span>
            <input 
              type="text" 
              placeholder="Search by customer or plan..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Expiring">Expiring Soon</option>
              <option value="Expired">Expired</option>
              <option value="Renewed">Renewed</option>
              <option value="Pending">Pending Setup</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/60">
                <th className="px-4 py-3 whitespace-nowrap">Customer</th>
                <th className="px-4 py-3 whitespace-nowrap">Plan Details</th>
                <th className="px-4 py-3 whitespace-nowrap">Timeline</th>
                <th className="px-4 py-3 whitespace-nowrap">Status</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-sm text-slate-500">
                    Loading subscription entries...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-sm text-slate-500">
                    No subscriptions logged.
                  </td>
                </tr>
              ) : (
                filtered.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm font-bold text-slate-800">{s.customer?.name || "Unknown Customer"}</p>
                      <p className="text-xs text-slate-500">
                        {s.customer?.customerCode || (s.customerId.length > 8 ? `${s.customerId.slice(0, 8)}...` : s.customerId)}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm font-medium text-slate-700">{s.planName}</p>
                      {!s.id.startsWith("virtual-") && (
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5" title={s.id}>
                          ID: {s.id.slice(0, 8)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                      {s.startDate ? (
                        <div className="flex flex-col gap-1">
                          <span>Start: <span className="font-semibold text-slate-750">{new Date(s.startDate).toLocaleDateString()}</span></span>
                          <span>End: <span className="font-semibold text-slate-750">{new Date(s.endDate).toLocaleDateString()}</span></span>
                        </div>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 bg-red-50 text-[var(--primary)] rounded-md text-[10px] font-bold uppercase border border-red-100">Setup Required</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 italic max-w-[180px] truncate" title={s.notes || ""}>
                      {s.notes || "—"}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {((s.status === "Expiring" && user?.role !== "SalesExecutive") || 
                        (s.status === "Expired" && !activeCustomerIds.has(s.customerId))) && (
                        <button
                          onClick={() => openRenewModal(s)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-xl text-xs font-bold transition-all shadow-xs"
                        >
                          🔄 Renew
                        </button>
                      )}
                      {user?.role !== "SalesExecutive" && s.status !== "Pending" && (
                        <button
                          onClick={() => openEditModal(s)}
                          className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs"
                        >
                          ✏️ Edit
                        </button>
                      )}
                      {user?.role !== "SalesExecutive" && s.status === "Pending" && !s.startDate && (
                        <button
                          onClick={() => handleCreateForApproved(s.customerId)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-50 border border-red-200 text-[var(--primary)] rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                        >
                          ⚙️ Setup Plan
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-red-50 to-slate-50 shrink-0">
              <h2 className="text-base font-bold text-slate-800">Add Subscription Plan</h2>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-xl bg-white/80 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all cursor-pointer">
                <Ico d={icons.x} size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 overflow-y-auto space-y-4">
                {errorMsg && (
                  <div className="p-3 rounded-[8px] bg-[#ffdad6] border border-[#ffb4ab] text-[13px] text-[#93000a] font-medium text-center">
                    {errorMsg}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Customer Account <span className="text-red-500">*</span>
                  </label>
                  <select 
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                    required
                    className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
                  >
                    <option value="">Select a customer...</option>
                    {customers
                      .filter((c) => c.status === "ActiveCustomer" || c.status === "Renewed")
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.customerCode})
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">Showing <span className="font-semibold text-emerald-600">Active</span> customers. Prospect or Churned customers will not appear.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Subscription Plan Name <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    value={formData.planName}
                    onChange={(e) => setFormData({ ...formData, planName: e.target.value })}
                    placeholder="e.g. Enterprise Premium Annual" 
                    className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="date" 
                      required
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all text-slate-700" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      End Date <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="date" 
                      required
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all text-slate-700" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Status</label>
                    <select 
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
                    >
                      <option value="Active">Active</option>
                      <option value="Expired">Expired</option>
                      <option value="Cancelled">Cancelled</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes (optional)</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Any remarks about this subscription..."
                    className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-5 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={formLoading}
                  className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors shadow-sm disabled:opacity-75 cursor-pointer"
                >
                  {formLoading ? "Saving..." : "Add Subscription"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subscription Renewal Modal */}
      {isRenewModalOpen && selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-red-50 to-slate-50 shrink-0">
              <div>
                <h2 className="text-base font-bold text-slate-800">🔄 Renew Subscription</h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Extend customer subscription lifecycle</p>
              </div>
              <button 
                onClick={() => setIsRenewModalOpen(false)} 
                className="w-8 h-8 rounded-xl bg-white/80 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
              >
                <Ico d={icons.x} size={16} />
              </button>
            </div>

            <form onSubmit={handleRenewSubmit}>
              <div className="p-6 overflow-y-auto space-y-4">
                {errorMsg && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs font-semibold text-red-600 text-center">
                    {errorMsg}
                  </div>
                )}

                {/* Info Card */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Client Account</span>
                    <span className="text-xs font-bold text-slate-750">{selectedSub.customer?.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Previous Expiry</span>
                    <span className="text-xs font-bold text-red-600">
                      {selectedSub.endDate ? new Date(selectedSub.endDate).toLocaleDateString() : "—"}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                    Plan Name <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    value={renewPlanName}
                    onChange={(e) => setRenewPlanName(e.target.value)}
                    placeholder="e.g. Enterprise Premium Annual" 
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all text-slate-700 font-semibold" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                      New Start Date <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="date" 
                      required
                      value={renewStartDate}
                      onChange={(e) => setRenewStartDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all text-slate-700 font-semibold" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                      New End Date <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="date" 
                      required
                      value={renewEndDate}
                      onChange={(e) => setRenewEndDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all text-slate-700 font-semibold" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Notes (optional)</label>
                  <textarea
                    rows={3}
                    value={renewNotes}
                    onChange={(e) => setRenewNotes(e.target.value)}
                    placeholder="Provide details about payment terms, revised pricing, or contract adjustments..."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none font-medium text-slate-700"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setIsRenewModalOpen(false)} 
                  className="px-5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={formLoading}
                  className="px-6 py-2 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors shadow-sm disabled:opacity-75 cursor-pointer"
                >
                  {formLoading ? "Renewing..." : "Confirm Renewal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

