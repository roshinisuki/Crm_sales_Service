"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getCustomerDecisionSummaryAction, updateCustomerStatusAction } from "@/app/actions/visits";
import { activateCustomerPortal } from "@/app/actions/auth";

// We'll mock a customer reject action here or update status
import { checkOutInboundAction } from "@/app/actions/visits"; // we can reuse checkout update or create a quick status updater

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-lg ${className ?? ""}`} />;
}

const icons = {
  check: <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
  x: <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
  search: <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
};

export default function DecisionSummaryPage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getCustomerDecisionSummaryAction();
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && ["Admin", "MarketingLead"].includes(user.role)) {
      loadData();
    }
  }, [user]);

  // Handle Unauthorized early
  if (!authLoading && user && !["Admin", "MarketingLead"].includes(user.role)) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-slate-200/60 shadow-sm max-w-md mx-auto mt-12 space-y-4">
        <div className="text-3xl">⚠️</div>
        <h2 className="text-base font-extrabold text-slate-800 uppercase tracking-wider">Access Restricted</h2>
        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          This page is only accessible to Marketing Leads and System Administrators to monitor and approve customer portal requests.
        </p>
        <a href="/dashboard" className="inline-block px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm">
          Return to Dashboard
        </a>
      </div>
    );
  }

  const handleApprove = async (customerId: string) => {
    const confirmApprove = window.confirm("Are you sure you want to APPROVE this customer? This will generate their password-set link and email it to them.");
    if (!confirmApprove) return;

    setActionLoading(customerId);
    try {
      // Trigger activation email
      const res = await activateCustomerPortal(customerId);
      if (res.success) {
        alert("Success! Customer approved and activation email sent.");
        loadData();
      } else {
        alert(res.message || "Failed to approve customer portal access.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (customerId: string) => {
    const reason = window.prompt("Please enter the reason for rejecting this customer:");
    if (reason === null) return; // cancel
    if (!reason.trim()) {
      alert("Validation: A reason is required to reject a customer.");
      return;
    }

    setActionLoading(customerId);
    try {
      const res = await updateCustomerStatusAction({ id: customerId, status: "REJECTED", reason: reason.trim() });
      if (res.success) {
        alert("Customer rejected and reason logged successfully.");
        loadData();
      } else {
        alert(res.message || "Failed to update customer status.");
      }
    } catch (err) {
      alert("Failed to process rejection.");
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCustomers = data?.pendingCustomersList || [];
  const searchedCustomers = pendingCustomers.filter((c: any) => {
    const name = c.name.toLowerCase();
    const code = c.customerCode.toLowerCase();
    const email = (c.email || "").toLowerCase();
    const term = search.toLowerCase();
    return name.includes(term) || code.includes(term) || email.includes(term);
  });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-200">
      
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Customer Decision summary</h1>
        <p className="text-xs text-slate-500 font-medium">Verify customer access, monitor conversion metrics, and manage approval queues.</p>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm flex flex-col gap-2">
          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Visited This Month</p>
          {loading ? <Skeleton className="h-6 w-12" /> : <p className="text-2xl font-black text-slate-800">{data?.totalVisitedThisMonth}</p>}
        </div>
        <div className="bg-white rounded-3xl p-5 border border-[#10B981]/20 shadow-sm flex flex-col gap-2 border-l-4 border-l-[#10B981]">
          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-[#10B981]">Approved Master</p>
          {loading ? <Skeleton className="h-6 w-12" /> : <p className="text-2xl font-black text-[#10B981]">{data?.approvedCount}</p>}
        </div>
        <div className="bg-white rounded-3xl p-5 border border-[#EF4444]/20 shadow-sm flex flex-col gap-2 border-l-4 border-l-[#EF4444]">
          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-[#EF4444]">Rejected Count</p>
          {loading ? <Skeleton className="h-6 w-12" /> : <p className="text-2xl font-black text-[#EF4444]">{data?.rejectedCount}</p>}
        </div>
        <div className="bg-white rounded-3xl p-5 border border-amber-200 shadow-sm flex flex-col gap-2 border-l-4 border-l-amber-500">
          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-amber-700">Pending Queue</p>
          {loading ? <Skeleton className="h-6 w-12" /> : <p className="text-2xl font-black text-amber-600">{data?.pendingCount}</p>}
        </div>
        <div className="bg-[#0D2137] rounded-3xl p-5 text-white shadow-sm flex flex-col gap-2">
          <p className="text-[10px] font-extrabold text-white/50 uppercase tracking-wider">Conversion Score</p>
          {loading ? <Skeleton className="h-6 w-12 bg-white/10" /> : <p className="text-2xl font-black text-[#5C8FFF]">{data?.conversionRate}%</p>}
        </div>
      </div>

      {/* Pending Customer Queue Panel */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Pending Customer Approval Queue</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Approve access to generate customer portal logins automatically</p>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icons.search}</span>
            <input
              type="text"
              placeholder="Search queue..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10 font-semibold text-slate-700 bg-white"
            />
          </div>
        </div>

        {/* Queue Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/30 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200/60">
                <th className="px-6 py-4">Customer Name</th>
                <th className="px-4 py-4">Customer Code</th>
                <th className="px-4 py-4">Contact Info</th>
                <th className="px-4 py-4">Assigned Executive</th>
                <th className="px-6 py-4 text-right">Verification Decisions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">Loading pending accounts...</td></tr>
              ) : searchedCustomers.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-slate-400 font-medium">No customers currently in the pending verification queue</td></tr>
              ) : (
                searchedCustomers.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">{c.name}</td>
                    <td className="px-4 py-4 text-slate-500 font-mono">{c.customerCode}</td>
                    <td className="px-4 py-4 font-medium text-slate-500">
                      <p>{c.email || "No email"}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{c.phone || "No phone"}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-600 font-semibold">{c.assignedUser?.name || "Unassigned"}</td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleApprove(c.id)}
                        disabled={actionLoading === c.id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl text-[10px] transition-all"
                      >
                        {icons.check} Approve Verify
                      </button>
                      <button
                        onClick={() => handleReject(c.id)}
                        disabled={actionLoading === c.id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-xl text-[10px] transition-all"
                      >
                        {icons.x} Reject
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
