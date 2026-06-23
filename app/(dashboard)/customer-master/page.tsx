"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCustomersAction, createCustomerAction, updateCustomerAction, deleteCustomersAction } from "@/app/actions/customers";
import { getUsersAction } from "@/app/actions/users";
import { Customer, User } from "@/types";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import { useGlobalLoading } from "@/components/GlobalLoadingProvider";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  plus: "M12 4v16m8-8H4",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  filter: "M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z",
  x: "M6 18L18 6M6 6l12 12",
  users: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  check: "M5 13l4 4L19 7",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  map: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ActiveCustomer: "bg-emerald-100 text-emerald-800 border-emerald-200",
    Prospect: "bg-amber-100 text-amber-800 border-amber-200",
    Renewed: "bg-blue-100 text-blue-800 border-blue-200",
    Churned: "bg-rose-100 text-rose-800 border-rose-200",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${styles[status] || "bg-gray-100 text-gray-800"}`}>
      {status}
    </span>
  );
}

export default function CustomerMasterPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const { startLoading, stopLoading } = useGlobalLoading();
  const [search, setSearch] = useState("");
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [leadSourceFilter, setLeadSourceFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [executives, setExecutives] = useState<User[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const toast = useToast();
  const [confirmState, setConfirmState] = useState<{isOpen: boolean; title: string; message: string; action: () => void}>({ isOpen: false, title: "", message: "", action: () => {} });

  const [formData, setFormData] = useState({
    id: "",
    customerCode: "",
    name: "",
    email: "",
    phone: "",
    city: "",
    status: "Prospect" as any,
    assignedUserId: "",
    leadSource: "",
  });

  const loadCustomers = async () => {
    setLoading(true);
    startLoading("Loading customers...");
    try {
      const params: any = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (leadSourceFilter) params.leadSource = leadSourceFilter;

      const res = await getCustomersAction(params);
      if (res.success && res.data) {
        setCustomers(res.data as any);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      stopLoading();
    }
  };

  const loadExecutives = async () => {
    if (user?.role === "Admin" || user?.role === "SalesManager") {
      const res = await getUsersAction();
      if (res.success && res.data) {
        setExecutives(res.data.filter((u: any) => u.role === "SalesExecutive") as any);
      }
    }
  };

  useEffect(() => {
    setStatusFilter(searchParams.get("status") || "");
  }, [searchParams]);

  useEffect(() => {
    loadCustomers();
  }, [search, statusFilter, leadSourceFilter]);

  useEffect(() => {
    loadExecutives();
  }, [user]);

  const exportToCSV = () => {
    if (customers.length === 0) {
      toast.error("No data available to export.");
      return;
    }
    
    // Headers
    const headers = ["ID", "Customer Code", "Name", "Email", "Phone", "City", "Status", "Lead Source", "Created At"];
    
    // Rows
    const rows = customers.map(c => [
      c.id,
      c.customerCode,
      c.name,
      c.email || "",
      c.phone || "",
      c.city || "",
      c.status,
      c.leadSource || "",
      c.createdAt ? new Date(c.createdAt).toLocaleString() : ""
    ]);
    
    // Construct CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    // Trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Customers_Export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV export initiated successfully.");
  };

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
    });
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
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
    });
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setErrorMsg("");

    if (!formData.name.trim()) {
      setErrorMsg("Customer Name is required");
      setFormLoading(false);
      return;
    }

    if (formData.id && !formData.customerCode.trim()) {
      setErrorMsg("Customer Code is required for updating");
      setFormLoading(false);
      return;
    }

    let res;
    if (formData.id) {
      res = await updateCustomerAction(formData);
    } else {
      res = await createCustomerAction(formData);
    }

    if (res.success) {
      setIsModalOpen(false);
      loadCustomers();
    } else {
      setErrorMsg(res.message || "Operation failed");
    }
    setFormLoading(false);
  };

  const toggleAll = () => {
    if (selectedIds.length === customers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(customers.map(c => c.id));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleDeleteSelected = () => {
    setConfirmState({
      isOpen: true,
      title: "Delete Customers",
      message: `Are you sure you want to permanently delete ${selectedIds.length} customer(s)? This will erase ALL their visits, subscriptions, and portal access. This action CANNOT be undone.`,
      action: async () => {
        setIsDeleting(true);
        const res = await deleteCustomersAction(selectedIds);
        setIsDeleting(false);
        if (res.success) {
          toast.success(res.message || "Customers deleted.");
          setSelectedIds([]);
          loadCustomers();
        } else {
          toast.error(res.message || "Failed to delete customers.");
        }
      }
    });
  };

  const handleDeleteOne = (c: Customer) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Customer",
      message: `Delete "${c.name}" (${c.customerCode})?\n\nThis will permanently erase ALL their visits, subscriptions, and portal access.\n\nThis action CANNOT be undone.`,
      action: async () => {
        setIsDeleting(true);
        const res = await deleteCustomersAction([c.id]);
        setIsDeleting(false);
        if (res.success) {
          toast.success(`"${c.name}" has been deleted.`);
          setSelectedIds(prev => prev.filter(x => x !== c.id));
          loadCustomers();
        } else {
          toast.error(res.message || "Failed to delete customer.");
        }
      }
    });
  };


  return (
    <PageContainer className="space-y-4">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Customer Master</h2>
          <p className="text-sm text-slate-500 mt-1">Manage and track your active customers and prospects.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-md text-[13px] font-bold hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
          <button 
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--primary)] text-white rounded-md text-[13px] font-medium hover:bg-[var(--primary-hover)] transition-colors shadow-sm cursor-pointer"
          >
            <Ico d={icons.plus} size={16} />
            Create Customer
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Customers - Blue palette */}
        <div className="kpi-total">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Customers</p>
            <div className="w-9 h-9 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center text-[var(--primary)]">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>
            </div>
          </div>
          <div>
            <p className="text-3xl font-black text-slate-800">{customers.length}</p>
            <p className="text-[10px] font-semibold text-slate-500 mt-0.5">All customer accounts</p>
          </div>
        </div>

        {/* Active Customers - Green palette */}
        <div className="kpi-completed">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active</p>
            <div className="w-9 h-9 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center text-emerald-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" clipRule="evenodd" /></svg>
            </div>
          </div>
          <div>
            <p className="text-3xl font-black text-slate-800">{customers.filter(c => c.status === "ActiveCustomer" || c.status === "Renewed").length}</p>
            <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Active clients</p>
          </div>
        </div>

        {/* Prospects - Amber/Pending palette */}
        <div className="kpi-pending">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Prospects</p>
            <div className="w-9 h-9 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center text-amber-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>
            </div>
          </div>
          <div>
            <p className="text-3xl font-black text-slate-800">{customers.filter(c => c.status === "Prospect").length}</p>
            <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Prospect accounts</p>
          </div>
        </div>

        {/* Churned - Red palette */}
        <div className="kpi-overdue">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Churned</p>
            <div className="w-9 h-9 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center text-red-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" /><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" /></svg>
            </div>
          </div>
          <div>
            <p className="text-3xl font-black text-slate-800">{customers.filter(c => c.status === "Churned").length}</p>
            <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Churned accounts</p>
          </div>
        </div>
      </div>


      {/* Main Table */}
      <div className="crm-card overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-slate-800">Customers List</h3>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Ico d={icons.search} size={16} />
              </span>
              <input 
                type="text" 
                placeholder="Search customers..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
              />
            </div>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-600 font-medium focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="Prospect">Prospect</option>
              <option value="ActiveCustomer">Active Customer</option>
              <option value="Renewed">Renewed</option>
              <option value="Churned">Churned</option>
            </select>
            <select 
              value={leadSourceFilter}
              onChange={(e) => setLeadSourceFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-600 font-medium focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
            >
              <option value="">All Lead Sources</option>
              <option value="Website">Website</option>
              <option value="Facebook">Facebook</option>
              <option value="Instagram">Instagram</option>
              <option value="LinkedIn">LinkedIn</option>
              <option value="Referral">Referral</option>
              <option value="WalkIn">Walk-in</option>
              <option value="ColdCall">Cold Call</option>
              <option value="Partner">Partner</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {selectedIds.length > 0 && (
            <div className="bg-slate-800 text-white px-5 py-3 flex items-center justify-between text-sm font-medium animate-in fade-in slide-in-from-top-4">
              <span>{selectedIds.length} customer(s) selected</span>
              <button 
                onClick={handleDeleteSelected}
                disabled={isDeleting}
                className="px-4 py-1.5 bg-red-500 hover:bg-red-600 rounded-md transition-colors flex items-center gap-2 shadow-sm border border-red-400 text-xs"
              >
                {isDeleting ? "Deleting..." : "Delete Selected"}
              </button>
            </div>
          )}
          <table className="crm-table">
            <thead>
              <tr className="crm-tr border-b border-slate-100">
                <th className="crm-th w-10">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)]/50 cursor-pointer"
                    checked={customers.length > 0 && selectedIds.length === customers.length}
                    onChange={toggleAll}
                  />
                </th>
                <th className="crm-th">Customer Code</th>
                <th className="crm-th">Customer Name</th>
                <th className="crm-th">City</th>
                <th className="crm-th">Status</th>
                <th className="crm-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-sm text-slate-400">
                    Loading...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-sm text-slate-500">
                    No customers found.
                  </td>
                </tr>
              ) : (
                customers.map(c => (
                  <tr key={c.id} className={`crm-tr hover:bg-slate-50/80 transition-colors ${selectedIds.includes(c.id) ? 'bg-red-50/30' : ''}`}>
                    <td className="crm-td">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)]/50 cursor-pointer"
                        checked={selectedIds.includes(c.id)}
                        onChange={() => toggleOne(c.id)}
                      />
                    </td>
                    <td className="crm-td text-slate-500 font-medium">{c.customerCode}</td>
                    <td className="crm-td">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-red-100 text-[var(--primary)] flex items-center justify-center text-[10px] font-bold shrink-0">
                          {c.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-700 block leading-tight">{c.name}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-slate-400 block leading-tight">{c.email || "No email"}</span>
                            {c.leadSource && (
                              <span className="text-[9px] px-1 bg-slate-100 text-slate-500 border border-slate-200 rounded font-semibold uppercase tracking-wider">
                                {c.leadSource}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="crm-td text-slate-600">{c.city || "-"}</td>
                    <td className="crm-td"><StatusBadge status={c.status} /></td>
                    <td className="crm-td text-right">
                      <div className="flex items-center justify-end gap-2 text-slate-400">
                        <button
                          onClick={() => router.push(`/customer-master/${c.id}`)}
                          className="hover:text-emerald-600 transition-colors p-1"
                          title="View Customer Details"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>
                        <button
                          onClick={() => openEditModal(c)}
                          className="hover:text-blue-600 transition-colors p-1"
                          title="Edit Customer"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>

                        {(user?.role === "Admin" || user?.role === "SalesManager") && (
                          <button
                            onClick={() => handleDeleteOne(c)}
                            disabled={isDeleting}
                            className="hover:text-red-600 transition-colors p-1 disabled:opacity-50"
                            title="Delete Customer"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
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
              <h2 className="text-base font-bold text-slate-800">
                {formData.id ? "Edit Customer Record" : "Add New Customer"}
              </h2>
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
                {!formData.id ? (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Customer Code
                    </label>
                    <input 
                      type="text" 
                      disabled
                      value="Auto-generated upon save"
                      className="w-full px-4 py-2 rounded-xl bg-slate-100 border border-slate-200 text-sm text-slate-500 font-semibold cursor-not-allowed" 
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Customer Code <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      required
                      disabled
                      value={formData.customerCode}
                      onChange={(e) => setFormData({ ...formData, customerCode: e.target.value })}
                      placeholder="e.g. RAM-101" 
                      className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all disabled:opacity-60 cursor-not-allowed" 
                    />
                    <p className="text-xs text-slate-500 mt-1">Manual identifier code (cannot be changed once created).</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter customer name" 
                    className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
                    <input 
                      type="email" 
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Email address" 
                      className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone</label>
                    <input 
                      type="tel" 
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="Phone number" 
                      className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">City</label>
                    <input 
                      type="text" 
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="City" 
                      className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Status</label>
                    <select 
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
                    >
                      <option value="Prospect">Prospect</option>
                      <option value="ActiveCustomer">Active Customer</option>
                      <option value="Renewed">Renewed</option>
                      <option value="Churned">Churned</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Lead Source</label>
                    <select 
                      value={formData.leadSource}
                      onChange={(e) => setFormData({ ...formData, leadSource: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
                    >
                      <option value="">Select Source</option>
                      <option value="Website">Website</option>
                      <option value="Facebook">Facebook</option>
                      <option value="Instagram">Instagram</option>
                      <option value="LinkedIn">LinkedIn</option>
                      <option value="Referral">Referral</option>
                      <option value="WalkIn">Walk-in</option>
                      <option value="ColdCall">Cold Call</option>
                      <option value="Partner">Partner</option>
                    </select>
                  </div>
                  {(user?.role === "Admin" || user?.role === "SalesManager") ? (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Assign to Executive</label>
                      <select 
                        value={formData.assignedUserId}
                        onChange={(e) => setFormData({ ...formData, assignedUserId: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
                      >
                        <option value="">Unassigned</option>
                        {executives.map(exec => (
                          <option key={exec.id} value={exec.id}>{exec.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : <div />}
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
                  {formLoading ? "Saving..." : "Save Customer"}
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
        onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        isDestructive={true}
      />
    </PageContainer>
  );
}
