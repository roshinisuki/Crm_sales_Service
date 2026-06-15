"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import PageContainer from "@/components/PageContainer";
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

function DecisionPurposeStatusBadge({ purpose, outcome }: { purpose: string; outcome: string }) {
  let badge = null;
  const p = purpose ? purpose.toLowerCase() : "";
  const o = outcome || "";

  if (p.includes("support")) {
    if (o.toLowerCase().includes("resolved")) badge = { text: "Resolved", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    else if (o.toLowerCase().includes("resolving")) badge = { text: "Resolving", color: "bg-amber-50 text-amber-700 border-amber-200" };
    else badge = { text: "Enquired to IT", color: "bg-blue-50 text-blue-700 border-blue-200" };
  } else if (p.includes("subscription") || p.includes("renewal")) {
    if (o.toLowerCase().includes("renewed")) badge = { text: "Renewed", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    else if (o.toLowerCase().includes("processing")) badge = { text: "Renewal Processing", color: "bg-amber-50 text-amber-700 border-amber-200" };
    else badge = { text: "Renewal Requested", color: "bg-blue-50 text-blue-700 border-blue-200" };
  } else if (p.includes("sales")) {
    if (o === "Converted") badge = { text: "Converted", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    else if (o === "Not Interested") badge = { text: "Not Interested", color: "bg-red-50 text-red-700 border-red-200" };
    else if (o === "Follow-up Required" || o === "Pending Decision") badge = { text: o, color: "bg-amber-50 text-amber-700 border-amber-200" };
    else badge = { text: o || "Interested", color: "bg-blue-50 text-blue-700 border-blue-200" };
  } else if (p.includes("demo")) {
    if (o.toLowerCase().includes("completed")) badge = { text: "Demo Completed", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    else badge = { text: "Demo Scheduled", color: "bg-blue-50 text-blue-700 border-blue-200" };
  } else if (o) {
    badge = { text: o, color: "bg-slate-100 text-slate-600 border-slate-200" };
  }

  if (!badge) return null;

  return (
    <span className={`inline-flex items-center justify-center w-32 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${badge.color} truncate`}>
      {badge.text}
    </span>
  );
}

export default function DecisionSummaryPage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
    if (user && ["Admin", "SalesManager"].includes(user.role)) {
      loadData();
    }
  }, [user]);

  // Handle Unauthorized early
  if (!authLoading && user && !["Admin", "SalesManager"].includes(user.role)) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-slate-200/60 shadow-sm max-w-md mx-auto mt-12 space-y-4">
        <div className="text-3xl">⚠️</div>
        <h2 className="text-base font-extrabold text-slate-800 uppercase tracking-wider">Access Restricted</h2>
        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          This page is only accessible to Marketing Leads and System Administrators to monitor and approve customer portal requests.
        </p>
        <a href="/dashboard" className="inline-block px-5 py-2.5 bg-[#151515] hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm">
          Return to Dashboard
        </a>
      </div>
    );
  }



  return (
    <PageContainer>
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Customer Decision summary</h1>
        <p className="text-xs text-slate-500 font-medium">Verify customer access, monitor conversion metrics, and manage approval queues.</p>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Visited This Month */}
        <div className="kpi-total">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Visited This Month</p>
          </div>
          <div className="mt-2">
            {loading ? <Skeleton className="h-6 w-12" /> : <p className="text-3xl font-black text-slate-800">{data?.totalVisitedThisMonth}</p>}
          </div>
        </div>

        {/* Approved Master */}
        <div className="kpi-completed">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Approved Master</p>
          </div>
          <div className="mt-2">
            {loading ? <Skeleton className="h-6 w-12" /> : <p className="text-3xl font-black text-slate-800">{data?.approvedCount}</p>}
          </div>
        </div>

        {/* Rejected Count */}
        <div className="kpi-overdue">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rejected Count</p>
          </div>
          <div className="mt-2">
            {loading ? <Skeleton className="h-6 w-12" /> : <p className="text-3xl font-black text-slate-800">{data?.rejectedCount}</p>}
          </div>
        </div>

        {/* Pending Queue */}
        <div className="kpi-pending">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pending Queue</p>
          </div>
          <div className="mt-2">
            {loading ? <Skeleton className="h-6 w-12" /> : <p className="text-3xl font-black text-slate-800">{data?.pendingCount}</p>}
          </div>
        </div>

        {/* Conversion Score */}
        <div className="kpi-total">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Conversion Score</p>
          </div>
          <div className="mt-2">
            {loading ? <Skeleton className="h-6 w-12" /> : <p className="text-3xl font-black text-slate-800">{data?.conversionRate}%</p>}
          </div>
        </div>
      </div>


      {/* Customer Inbound Start & End Visit History */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col mt-6">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Customer Visit History (Start & End Logs)</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Complete chronological log of office customer arrivals, timings, and meeting outcomes</p>
          </div>
        </div>

        {/* History Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/30 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200/60">
                <th className="px-6 py-4 whitespace-nowrap">Customer</th>
                <th className="px-4 py-4 whitespace-nowrap">Purpose</th>
                <th className="px-4 py-4 whitespace-nowrap">Host Name</th>
                <th className="px-4 py-4 whitespace-nowrap">Visit Timings</th>
                <th className="px-4 py-4 whitespace-nowrap">Outcome</th>
                <th className="px-4 py-4 whitespace-nowrap">Portal Decision</th>
                <th className="px-6 py-4">Meeting Notes / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">Loading visit history...</td></tr>
              ) : !data?.visitHistory || data.visitHistory.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400 font-medium">No customer office visits logged yet</td></tr>
              ) : (
                data.visitHistory.map((v: any) => {
                  const checkIn = new Date(v.checkInTime).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
                  const checkOut = v.checkOutTime 
                    ? new Date(v.checkOutTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) 
                    : null;
                  
                  return (
                    <tr key={v.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="font-bold text-slate-800">{v.customer?.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">{v.customer?.customerCode}</p>
                      </td>
                      <td className="px-4 py-4 text-slate-650 whitespace-nowrap">{v.purpose}</td>
                      <td className="px-4 py-4 text-slate-600 whitespace-nowrap">{v.host?.name || "System Admin"}</td>
                      <td className="px-4 py-4 text-slate-500 font-medium whitespace-nowrap">
                        <p>Started: {checkIn}</p>
                        <p className={`text-[10px] font-bold mt-0.5 ${!checkOut ? "text-[#D44D4D] animate-pulse" : "text-slate-400"}`}>
                          {!checkOut ? "● In Office" : `Ended: ${checkOut}`}
                        </p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {v.status === "CHECKED_IN" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            In Premises
                          </span>
                        ) : (
                          <DecisionPurposeStatusBadge purpose={v.purpose} outcome={v.outcome} />
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center justify-center w-20 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                          v.customerDecision === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : v.customerDecision === "REJECTED"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}>
                          {v.customerDecision || "PENDING"}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-500 max-w-xs truncate" title={v.meetingSummary || ""}>
                        {v.meetingSummary || "No notes / in progress"}
                        {v.rejectionReason && (
                          <p className="text-[10px] text-red-600 font-bold mt-1">Rejection: {v.rejectionReason}</p>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </PageContainer>
  );
}
