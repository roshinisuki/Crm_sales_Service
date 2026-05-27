"use client";

import { useState, useEffect } from "react";
import { getUsersAction, updateUserAction } from "@/app/actions/users";
import { createInternalUserByAdmin, createCustomerPortalUser, resendInvitation } from "@/app/actions/auth";
import { getCustomersAction } from "@/app/actions/customers";
import { User } from "@/types";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  plus:   "M12 4v16m8-8H4",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  x:      "M6 18L18 6M6 6l12 12",
  user:   "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm7-3a3 3 0 013 3v1m-3-4a3 3 0 013-3 3 3 0 013 3",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  check:  "M5 13l4 4L19 7",
  resend: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  edit:   "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
};

const ROLE_BADGE: Record<string, string> = {
  Admin:              "bg-purple-100 text-purple-700",
  MarketingLead:      "bg-blue-100 text-blue-700",
  MarketingExecutive: "bg-cyan-100 text-cyan-700",
  Customer:           "bg-emerald-100 text-emerald-700",
};

const ROLE_LABELS: Record<string, string> = {
  Admin:              "Admin",
  MarketingLead:      "Marketing Lead",
  MarketingExecutive: "Marketing Executive",
  Customer:           "Customer Portal",
};

export default function UserMasterPage() {
  const { user: loggedIn, loading: authLoading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"internal" | "customer">("internal");

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create_internal" | "create_customer" | "edit">("create_internal");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Internal form
  const [intName, setIntName] = useState("");
  const [intEmail, setIntEmail] = useState("");
  const [intRole, setIntRole] = useState<"MarketingLead" | "MarketingExecutive">("MarketingExecutive");

  // Customer portal form
  const [custId, setCustId] = useState("");

  // Edit form
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editActive, setEditActive] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, custRes] = await Promise.all([
        getUsersAction(),
        getCustomersAction({ status: "Active" }),
      ]);
      if (usersRes.success && usersRes.data) setUsers(usersRes.data as User[]);
      if (custRes.success && custRes.data)   setCustomers(custRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && loggedIn?.role !== "Admin") router.replace("/dashboard");
  }, [loggedIn, authLoading, router]);

  useEffect(() => {
    if (loggedIn?.role === "Admin") loadData();
  }, [loggedIn]);

  if (authLoading || loggedIn?.role !== "Admin") return null;

  // ── Filtered lists ──────────────────────────────────────────
  const internalUsers = users.filter(u =>
    (u.userType === "internal" || u.role !== "Customer") &&
    (u.name.toLowerCase().includes(search.toLowerCase()) ||
     u.email.toLowerCase().includes(search.toLowerCase()) ||
     u.role.toLowerCase().includes(search.toLowerCase()))
  );

  const customerUsers = users.filter(u =>
    (u.userType === "customer" || u.role === "Customer") &&
    (u.name.toLowerCase().includes(search.toLowerCase()) ||
     u.email.toLowerCase().includes(search.toLowerCase()))
  );

  const displayedUsers = activeTab === "internal" ? internalUsers : customerUsers;

  // ── Modal openers ───────────────────────────────────────────
  const openCreateInternal = () => {
    setIntName(""); setIntEmail(""); setIntRole("MarketingExecutive");
    setErrorMsg(""); setSuccessMsg("");
    setModalMode("create_internal");
    setIsModalOpen(true);
  };

  const openCreateCustomer = () => {
    setCustId("");
    setErrorMsg(""); setSuccessMsg("");
    setModalMode("create_customer");
    setIsModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditUser(u);
    setEditActive(u.isActive);
    setErrorMsg(""); setSuccessMsg("");
    setModalMode("edit");
    setIsModalOpen(true);
  };

  // ── Submit handlers ─────────────────────────────────────────
  const handleCreateInternal = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true); setErrorMsg(""); setSuccessMsg("");
    const res = await createInternalUserByAdmin({ name: intName, email: intEmail, role: intRole });
    setFormLoading(false);
    if (!res.success) { setErrorMsg(res.message); return; }
    setSuccessMsg(res.message);
    loadData();
    setTimeout(() => { setIsModalOpen(false); setSuccessMsg(""); }, 2000);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custId) { setErrorMsg("Please select a customer account."); return; }
    setFormLoading(true); setErrorMsg(""); setSuccessMsg("");
    const res = await createCustomerPortalUser(custId);
    setFormLoading(false);
    if (!res.success) { setErrorMsg(res.message); return; }
    setSuccessMsg("Portal activation link sent to the customer.");
    loadData();
    setTimeout(() => { setIsModalOpen(false); setSuccessMsg(""); }, 2000);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setFormLoading(true); setErrorMsg("");
    const res = await updateUserAction({ id: editUser.id, isActive: editActive });
    setFormLoading(false);
    if (!res.success) { setErrorMsg(res.message || "Update failed."); return; }
    setIsModalOpen(false);
    loadData();
  };

  const handleResend = async (userId: string) => {
    const res = await resendInvitation(userId);
    if (res.success) alert(`✓ ${res.message}`);
    else alert(`✗ ${res.message}`);
  };

  // ── Table row ───────────────────────────────────────────────
  const TableRow = ({ u }: { u: User }) => (
    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors group">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0D2137] to-[#1a4a7a] text-white flex items-center justify-center font-bold text-sm shrink-0">
            {u.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">{u.name}</p>
            <p className="text-xs text-slate-500">{u.email}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold ${ROLE_BADGE[u.role] || "bg-slate-100 text-slate-600"}`}>
          {ROLE_LABELS[u.role] || u.role}
        </span>
      </td>
      <td className="px-6 py-4">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${u.isActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
          {u.isActive ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-6 py-4 text-xs text-slate-500">
        {u.isFirstLogin ? (
          <span className="inline-flex px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-bold border border-amber-200 text-[10px]">Pending Setup</span>
        ) : (
          <span className="text-slate-400">Activated</span>
        )}
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {u.isFirstLogin && (
            <button
              onClick={() => handleResend(u.id)}
              title="Resend activation link"
              className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 transition-colors border border-amber-200"
            >
              <Ico d={icons.resend} size={14} />
            </button>
          )}
          <button
            onClick={() => openEdit(u)}
            title="Edit user"
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          >
            <Ico d={icons.edit} size={14} />
          </button>
        </div>
      </td>
    </tr>
  );

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage internal team members and customer portal accounts separately.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openCreateInternal}
            className="flex items-center gap-2 px-4 py-2 bg-[#0D2137] text-white rounded-xl text-sm font-medium hover:bg-[#1a365d] transition-colors shadow-sm"
          >
            <Ico d={icons.plus} size={16} />
            Add Internal User
          </button>
          <button
            onClick={openCreateCustomer}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Ico d={icons.plus} size={16} />
            Add Customer Portal
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: users.length, color: "bg-slate-100 text-slate-600" },
          { label: "Internal Team", value: internalUsers.length, color: "bg-blue-50 text-blue-600" },
          { label: "Customer Portals", value: customerUsers.length, color: "bg-emerald-50 text-emerald-600" },
          { label: "Pending Setup", value: users.filter(u => u.isFirstLogin).length, color: "bg-amber-50 text-amber-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
              <Ico d={icons.user} size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 tracking-tight">{loading ? "—" : value}</p>
              <p className="text-xs font-semibold text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main table card */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">

        {/* Tabs + Search */}
        <div className="px-6 pt-5 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
            {/* Tab selector */}
            <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
              <button
                onClick={() => setActiveTab("internal")}
                className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "internal" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Internal Team
                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${activeTab === "internal" ? "bg-[#0D2137] text-white" : "bg-slate-200 text-slate-500"}`}>
                  {internalUsers.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("customer")}
                className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "customer" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Customer Portal
                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${activeTab === "customer" ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"}`}>
                  {customerUsers.length}
                </span>
              </button>
            </div>

            {/* Search */}
            <div className="relative max-w-xs w-full">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Ico d={icons.search} size={16} />
              </span>
              <input
                type="text"
                placeholder="Search by name, email, role…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-shadow"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/60">
                <th className="px-6 py-4">
                  {activeTab === "internal" ? "Team Member" : "Customer Account"}
                </th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Setup</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12 text-sm text-slate-500">Loading users…</td></tr>
              ) : displayedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-sm text-slate-400">
                    {activeTab === "internal"
                      ? "No internal team members found."
                      : "No customer portal accounts found. Use the 'Add Customer Portal' button to create one."}
                  </td>
                </tr>
              ) : (
                displayedUsers.map(u => <TableRow key={u.id} u={u} />)
              )}
            </tbody>
          </table>
        </div>

        {!loading && displayedUsers.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/40">
            <span className="text-xs text-slate-400">Showing {displayedUsers.length} {activeTab === "internal" ? "team member" : "customer portal"}{displayedUsers.length !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {modalMode === "create_internal" && "Add Internal Employee"}
                  {modalMode === "create_customer" && "Add Customer Portal User"}
                  {modalMode === "edit" && "Edit User"}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {modalMode === "create_internal" && "Creates an internal CRM user. An activation email will be sent."}
                  {modalMode === "create_customer" && "Links a Customer record to a portal login. A portal activation email will be sent."}
                  {modalMode === "edit" && `Editing: ${editUser?.name}`}
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 transition-colors">
                <Ico d={icons.x} size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">

              {/* Feedback */}
              {successMsg && (
                <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 flex items-center gap-2">
                  <Ico d={icons.check} size={14} className="text-emerald-600" /> {successMsg}
                </div>
              )}
              {errorMsg && (
                <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-600 text-center">
                  {errorMsg}
                </div>
              )}

              {/* ── FORM: Create Internal Employee ── */}
              {modalMode === "create_internal" && (
                <form id="modal-form" onSubmit={handleCreateInternal} className="p-6 space-y-4">
                  {/* Info note */}
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
                    <strong>Internal Employee</strong> — role options are Marketing Lead or Marketing Executive only.
                    Email must end in <code className="font-mono">@sukisoftware.com</code>.
                    An <strong>activation link</strong> (not OTP) will be sent to set their password.
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Full Name <span className="text-red-500">*</span></label>
                    <input
                      type="text" required value={intName}
                      onChange={e => setIntName(e.target.value)}
                      placeholder="e.g. Priya Sharma"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Work Email <span className="text-red-500">*</span></label>
                    <input
                      type="email" required value={intEmail}
                      onChange={e => setIntEmail(e.target.value)}
                      placeholder="priya@sukisoftware.com"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Role <span className="text-red-500">*</span></label>
                    <select
                      value={intRole} required
                      onChange={e => setIntRole(e.target.value as typeof intRole)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
                    >
                      <option value="MarketingExecutive">Marketing Executive</option>
                      <option value="MarketingLead">Marketing Lead</option>
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">Admin accounts can only be created via database seeding.</p>
                  </div>
                </form>
              )}

              {/* ── FORM: Create Customer Portal User ── */}
              {modalMode === "create_customer" && (
                <form id="modal-form" onSubmit={handleCreateCustomer} className="p-6 space-y-4">
                  {/* Info note */}
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-700">
                    <strong>Customer Portal User</strong> — select an active customer. Their registered email will receive
                    a portal activation link to set their password and access the customer portal.
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Customer Account <span className="text-red-500">*</span></label>
                    <select
                      value={custId} required
                      onChange={e => setCustId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
                    >
                      <option value="">Select an active customer…</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.customerCode}) — {c.email || "no email on file"}
                        </option>
                      ))}
                    </select>
                    {customers.length === 0 && (
                      <p className="text-[11px] text-amber-600 mt-1 font-semibold">
                        No active customers found. A customer must be ACTIVE before a portal account can be created.
                      </p>
                    )}
                  </div>

                  {custId && customers.find(c => c.id === custId) && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                      <p><span className="font-semibold">Name:</span> {customers.find(c => c.id === custId)?.name}</p>
                      <p><span className="font-semibold">Email:</span> {customers.find(c => c.id === custId)?.email || "—"}</p>
                      <p><span className="font-semibold">Code:</span> {customers.find(c => c.id === custId)?.customerCode}</p>
                    </div>
                  )}
                </form>
              )}

              {/* ── FORM: Edit User ── */}
              {modalMode === "edit" && editUser && (
                <form id="modal-form" onSubmit={handleEdit} className="p-6 space-y-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <p className="text-sm font-bold text-slate-800">{editUser.name}</p>
                    <p className="text-xs text-slate-500">{editUser.email}</p>
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold ${ROLE_BADGE[editUser.role] || "bg-slate-100 text-slate-600"}`}>
                      {ROLE_LABELS[editUser.role] || editUser.role}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Account Status</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setEditActive(true)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${editActive ? "bg-emerald-50 border-emerald-400 text-emerald-700" : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"}`}
                      >
                        ✓ Active
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditActive(false)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${!editActive ? "bg-red-50 border-red-400 text-red-700" : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"}`}
                      >
                        ✗ Inactive
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 transition-colors">
                Cancel
              </button>
              <button
                form="modal-form"
                type="submit"
                disabled={formLoading || !!successMsg}
                className={`px-6 py-2 rounded-xl text-xs font-bold text-white transition-colors shadow-sm disabled:opacity-70 ${
                  modalMode === "create_customer" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-[#0D2137] hover:bg-[#153456]"
                }`}
              >
                {formLoading
                  ? "Please wait…"
                  : modalMode === "create_internal" ? "Create & Send Activation Link"
                  : modalMode === "create_customer" ? "Send Portal Activation"
                  : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
