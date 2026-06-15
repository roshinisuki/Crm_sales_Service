"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { getVisitHistoryAction, editVisitRemarksAction, deleteVisitAction, checkInOutboundAction, checkOutOutboundAction, checkInInboundAction, checkOutInboundAction } from "@/app/actions/visits";
import { getUsersAction } from "@/app/actions/users";
import { getCustomersAction } from "@/app/actions/customers";
import CheckOutModal from "@/components/CheckOutModal";
import OutboundCheckInModal from "@/components/OutboundCheckInModal";
import PageContainer from "@/components/PageContainer";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { MapPin, Clock, CheckCircle2 } from "lucide-react";

const icons = {
  search: <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  filter: <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>,
  eye: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  edit: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  delete: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  x: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
};

function LogPurposeStatusBadge({ purpose, status, outcome }: { purpose: string; status: string; outcome: string }) {
  const isCheckedIn = status === "CHECKED_IN";
  
  if (isCheckedIn) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50 animate-pulse">
        In Premises
      </span>
    );
  }

  const p = purpose ? purpose.toLowerCase() : "";
  const o = outcome || "";

  let badge = null;
  if (p.includes("support")) {
    if (o.toLowerCase().includes("resolved")) badge = { text: "Resolved", color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50" };
    else if (o.toLowerCase().includes("resolving")) badge = { text: "Resolving", color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50" };
    else badge = { text: "Enquired to IT", color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/50" };
  } else if (p.includes("subscription discussion") || p.includes("renewal") || p.includes("subscription")) {
    if (o.toLowerCase().includes("renewed")) badge = { text: "Renewed", color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50" };
    else if (o.toLowerCase().includes("processing")) badge = { text: "Renewal Processing", color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50" };
    else badge = { text: "Renewal Requested", color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/50" };
  } else if (p.includes("sales")) {
    if (o === "Converted") badge = { text: "Converted", color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50" };
    else if (o === "Not Interested") badge = { text: "Not Interested", color: "bg-red-50 text-red-700 border-red-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50" };
    else if (o === "Follow-up Required" || o === "Pending Decision") badge = { text: o, color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50" };
    else badge = { text: o || "Interested", color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/50" };
  } else if (p.includes("demo")) {
    if (o.toLowerCase().includes("completed")) badge = { text: "Demo Completed", color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50" };
    else badge = { text: "Demo Scheduled", color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/50" };
  } else if (o.includes("Walk-in Guest")) {
    badge = { text: "Walk-in Guest", color: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/50" };
  } else if (o) {
    badge = { text: o, color: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/50" };
  }

  if (!badge) return null;

  return (
    <span className={`inline-flex items-center justify-center w-32 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${badge.color} truncate`}>
      {badge.text}
    </span>
  );
}

export default function MarketingLogPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [executives, setExecutives] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Filters state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [visitType, setVisitType] = useState("");
  const [outcome, setOutcome] = useState("");
  const [decision, setDecision] = useState("");
  const [selectedExecutiveId, setSelectedExecutiveId] = useState("");

  // Shared modal state
  const [errorMsg, setErrorMsg] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // View / Edit modal state
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const hasActiveFilters = !!(startDate || endDate || visitType || outcome || decision || selectedExecutiveId);
  const toast = useToast();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [remarksInput, setRemarksInput] = useState("");

  // Check-In modal state
  const [isOutboundOpen, setIsOutboundOpen] = useState(false);

  const [isCheckOutOpen, setIsCheckOutOpen] = useState(false);
  const [checkoutVisit, setCheckoutVisit] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getVisitHistoryAction({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        visitType: visitType || undefined,
        outcome: outcome || undefined,
        decision: decision || undefined,
        executiveId: selectedExecutiveId || undefined
      });
      if (res.success && res.data) {
        setLogs(res.data);
      }

      // Fetch executives list for Lead/Admin filter
      if (user?.role !== "SalesExecutive") {
        const execRes = await getUsersAction();
        if (execRes.success && execRes.data) {
          const filteredExecs = execRes.data.filter((u: any) => ["SalesExecutive", "SalesManager"].includes(u.role));
          setExecutives(filteredExecs);
        }
      }

      // Load customers for check-in dropdown
      const [r1, r2, r3] = await Promise.all([
        getCustomersAction({ status: "Active" }),
        getCustomersAction({ status: "Prospect" }),
        getCustomersAction({ status: "PENDING" }),
      ]);
      const combined = [
        ...(r1.success && r1.data ? r1.data : []),
        ...(r2.success && r2.data ? r2.data : []),
        ...(r3.success && r3.data ? r3.data : []),
      ];
      setCustomers(combined);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate, visitType, outcome, decision, selectedExecutiveId]);

  // ── View / Edit handlers ──────────────────────────────────────────
  const handleOpenDetails = (item: any) => {
    setSelectedVisit(item);
    setIsDetailsOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    const hoursDiff = (new Date().getTime() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60);
    if (hoursDiff > 24) {
      toast.error("Validation: Visit remarks can only be edited within 24 hours of check-in.");
      return;
    }
    setSelectedVisit(item);
    setRemarksInput(item.notes || "");
    setErrorMsg("");
    setIsEditOpen(true);
  };

  const handleSaveRemarksSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setErrorMsg("");
    try {
      const res = await editVisitRemarksAction(selectedVisit.id, selectedVisit.visitType, remarksInput.trim());
      if (res.success) {
        setIsEditOpen(false);
        loadData();
      } else {
        setErrorMsg(res.message || "Failed to update remarks.");
      }
    } catch (err) {
      setErrorMsg("An unexpected error occurred.");
    } finally {
      setFormLoading(false);
    }
  };





  // ── Check-Out handlers ────────────────────────────────────────────
  const openCheckOut = (visit: any) => {
    setCheckoutVisit({
      id: visit.id,
      customerId: visit.customerId,
      customerName: visit.customerName,
      customerCode: visit.customerCode,
      visitType: visit.visitType,
      purpose: visit.purpose,
      checkInTime: visit.checkInTime,
    });
    setIsCheckOutOpen(true);
  };

  // ── Search filter (client-side) ───────────────────────────────────
  const searchedLogs = logs.filter((l) => {
    const term = search.toLowerCase();
    return (
      l.customerName.toLowerCase().includes(term) ||
      l.executiveName.toLowerCase().includes(term) ||
      l.purpose.toLowerCase().includes(term)
    );
  });

  const handleExportCSV = () => {
    if (searchedLogs.length === 0) return;
    const headers = ["Customer", "Customer Code", "Executive", "Visit Type", "Purpose", "Check-In", "Check-Out", "Outcome", "Decision"];
    const rows = searchedLogs.map((l) => [
      `"${l.customerName}"`,
      `"${l.customerCode}"`,
      `"${l.executiveName}"`,
      `"${l.visitType}"`,
      `"${l.purpose.replace(/"/g, '""')}"`,
      `"${new Date(l.checkInTime).toLocaleString()}"`,
      `"${l.checkOutTime ? new Date(l.checkOutTime).toLocaleString() : "Active"}"`,
      `"${l.outcome}"`,
      `"${l.customerDecision}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `visit_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };



  return (
    <PageContainer>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Visit & Field Logs</h1>
          <p className="text-xs text-slate-500 font-medium">Log check-ins, capture GPS, and track every customer visit.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsOutboundOpen(true)}
            disabled={formLoading}
            className="flex items-center gap-2 px-4 py-2 bg-[#D44D4D] text-white rounded-xl text-sm font-bold hover:bg-[#C94F4F] transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
          >
            📍 Field Check-In
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-[#151515] text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-2 mt-4">
        <SummaryCard 
          label="Total Field Visits" 
          value={logs.length} 
          icon={<MapPin size={20} />} 
          variant="slate" 
          subtitle="All recorded visits"
        />
        <SummaryCard 
          label="Active Field Visits" 
          value={logs.filter((l) => !l.checkOutTime).length} 
          icon={<Clock size={20} />} 
          variant="amber" 
          subtitle="Currently onsite"
        />
        <SummaryCard 
          label="Completed Visits" 
          value={logs.filter((l) => l.checkOutTime).length} 
          icon={<CheckCircle2 size={20} />} 
          variant="green" 
          subtitle="Successfully checked-out"
        />
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              {icons.filter}
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Advanced Filters</span>
              {hasActiveFilters && (
                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-[9px] font-bold">
                  Active
                </span>
              )}
            </div>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setVisitType("");
                  setOutcome("");
                  setDecision("");
                  setSelectedExecutiveId("");
                }}
                className="text-[10px] font-bold text-[#D44D4D] hover:underline cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 text-xs font-semibold text-slate-600">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20 focus:border-[#D44D4D] transition-all text-slate-700 font-medium" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20 focus:border-[#D44D4D] transition-all text-slate-700 font-medium" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Visit Type</label>
              <select value={visitType} onChange={(e) => setVisitType(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20 focus:border-[#D44D4D] transition-all font-semibold text-slate-700 cursor-pointer">
                <option value="">All Types</option>
                <option value="Inbound">Inbound (Walk-in)</option>
                <option value="Outbound">Outbound (Field)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Outcome</label>
              <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20 focus:border-[#D44D4D] transition-all font-semibold text-slate-700 cursor-pointer">
                <option value="">All Outcomes</option>
                <option value="Interested">Interested</option>
                <option value="Not Interested">Not Interested</option>
                <option value="Follow-up Required">Follow-up Required</option>
                <option value="Pending Decision">Pending Decision</option>
                <option value="Converted">Converted</option>
                <option value="Renewal Requested">Renewal Requested</option>
                <option value="Renewal Processing">Renewal Processing</option>
                <option value="Renewed">Renewed</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Decision Status</label>
              <select value={decision} onChange={(e) => setDecision(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20 focus:border-[#D44D4D] transition-all font-semibold text-slate-700 cursor-pointer">
                <option value="">All Decisions</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>
            {user?.role !== "SalesExecutive" && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Executive</label>
                <select value={selectedExecutiveId} onChange={(e) => setSelectedExecutiveId(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20 focus:border-[#D44D4D] transition-all font-semibold text-slate-700 cursor-pointer">
                  <option value="">All Executives</option>
                  {executives.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MOBILE CARD VIEW (replaces table on small screens) ─────────────────── */}
      <div className="md:hidden">
        {/* Search bar for mobile */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 flex items-center gap-3">
            <span className="shrink-0 text-slate-400">{icons.search}</span>
            <input
              type="text"
              placeholder="Search visits..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm focus:outline-none font-medium text-slate-700 placeholder-slate-400"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-4 rounded-2xl border shadow-sm flex items-center justify-center transition-colors cursor-pointer relative ${
              showFilters 
                ? "bg-[#D44D4D] border-[#D44D4D] text-white" 
                : "bg-white border-slate-200/60 text-slate-500 hover:bg-slate-50"
            }`}
            title="Toggle Filters"
          >
            {icons.filter}
            {hasActiveFilters && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-amber-500 rounded-full border border-white" />
            )}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="w-7 h-7 rounded-full border-4 border-[#D44D4D] border-t-transparent animate-spin" />
          </div>
        ) : searchedLogs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center text-slate-400 font-semibold text-sm">
            No visit logs recorded matching filters
          </div>
        ) : (
          <div className="space-y-3">
            {/* Active (checked-in) visits pinned to top with prominent checkout */}
            {searchedLogs.filter(l => !l.checkOutTime).map((l) => {
              const checkInText = new Date(l.checkInTime).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
              const isEditable = (new Date().getTime() - new Date(l.createdAt).getTime()) / (1000 * 60 * 60) <= 24;
              return (
                <div key={l.id} className="bg-white rounded-2xl border-2 border-red-200 shadow-sm overflow-hidden">
                  {/* Active banner */}
                  <div className="bg-red-50 px-4 py-2 flex items-center justify-between border-b border-red-100">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-[#D44D4D] rounded-full animate-pulse" />
                      <span className="text-[10px] font-black text-[#D44D4D] uppercase tracking-widest">Active Visit</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] ${
                      l.visitType === "Inbound" ? "bg-red-100 text-[#800000]" : "bg-slate-100 text-slate-800"
                    }`}>{l.visitType}</span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">{l.customerName}</p>
                        <p className="text-[10px] text-slate-500 font-bold mt-0.5">{l.customerCode}</p>
                        <p className="text-xs text-slate-600 font-semibold mt-1">{l.purpose}</p>
                        <p className="text-[10px] text-slate-400 mt-1">Checked in: {checkInText}</p>
                        {l.executiveName && user?.role !== "SalesExecutive" && (
                          <p className="text-[10px] text-slate-400">by {l.executiveName}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <button
                          onClick={() => openCheckOut(l)}
                          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#D44D4D] hover:bg-[#C94F4F] active:bg-[#800000] text-white font-black text-xs rounded-xl transition-colors shadow-sm uppercase tracking-wide cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          Check-Out
                        </button>
                        <button
                          onClick={() => handleOpenDetails(l)}
                          className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
                        >
                          {icons.eye}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Completed visits as compact cards */}
            {searchedLogs.filter(l => !!l.checkOutTime).map((l) => {
              const checkInText = new Date(l.checkInTime).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
              const checkOutText = new Date(l.checkOutTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
              const isEditable = (new Date().getTime() - new Date(l.createdAt).getTime()) / (1000 * 60 * 60) <= 24;
              return (
                <div key={l.id} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] ${
                            l.visitType === "Inbound" ? "bg-red-100 text-[#800000]" : "bg-slate-100 text-slate-800"
                          }`}>{l.visitType}</span>
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-bold text-[9px] border border-emerald-200">Done</span>
                        </div>
                        <p className="font-bold text-slate-800 text-sm truncate">{l.customerName}</p>
                        <p className="text-[10px] text-slate-500 font-bold">{l.customerCode}</p>
                        <p className="text-xs text-slate-600 font-semibold mt-0.5">{l.purpose}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{checkInText} → Out: {checkOutText}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <button
                          onClick={() => handleOpenDetails(l)}
                          className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
                        >
                          {icons.eye}
                        </button>
                        <button
                          onClick={() => handleOpenEdit(l)}
                          disabled={!isEditable}
                          title={isEditable ? "Edit Remarks" : "Expired (24 hr limit)"}
                          className={`p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors ${!isEditable ? "opacity-30 cursor-not-allowed" : ""}`}
                        >
                          {icons.edit}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── DESKTOP TABLE (hidden on mobile) ─────────────────────────────────── */}
      <div className="hidden md:block crm-card overflow-hidden flex flex-col">
        <div className="p-5 border-b border-theme flex items-center justify-between bg-surface-offset gap-4">
          <div className="flex-1 relative flex items-center">
            <span className="absolute left-4 text-slate-400">{icons.search}</span>
            <input
              type="text"
              placeholder="Search by customer name, purpose, or executive..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all font-medium text-theme-primary"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border transition-all text-xs font-bold cursor-pointer shrink-0 ${
              showFilters 
                ? "bg-[var(--primary)] border-[var(--primary)] text-white hover:opacity-90" 
                : "bg-[var(--surface)] border-[var(--border)] text-theme-secondary hover:bg-[var(--surface-2)]"
            }`}
          >
            {icons.filter}
            <span>Advanced Filters</span>
            {hasActiveFilters && (
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
            )}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr className="bg-surface-offset">
                <th className="crm-th whitespace-nowrap">Customer</th>
                <th className="crm-th whitespace-nowrap">Type</th>
                <th className="crm-th whitespace-nowrap">Purpose</th>
                <th className="crm-th whitespace-nowrap">Timings</th>
                <th className="crm-th whitespace-nowrap">Outcome</th>
                <th className="crm-th whitespace-nowrap">Decision</th>
                <th className="crm-th text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-subtle text-xs">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10 text-theme-muted font-bold">Loading visit history logs...</td></tr>
              ) : searchedLogs.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-theme-muted font-semibold">No visit logs recorded matching filters</td></tr>
              ) : (
                searchedLogs.map((l) => {
                  const checkInText = new Date(l.checkInTime).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
                  const checkOutText = l.checkOutTime
                    ? new Date(l.checkOutTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                    : "Active";
                  const isEditable = (new Date().getTime() - new Date(l.createdAt).getTime()) / (1000 * 60 * 60) <= 24;
                  const isActive = !l.checkOutTime;

                  return (
                    <tr key={l.id} className="crm-tr">
                      <td className="crm-td whitespace-nowrap">
                        <p className="font-bold text-theme-primary">
                          {l.executiveName}
                        </p>
                        <p className="text-[10px] text-theme-muted font-bold mt-0.5">
                          {l.customerCode} • {l.customerName}
                        </p>
                      </td>
                      <td className="crm-td whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] ${l.visitType === "Inbound" ? "bg-red-100 text-[#800000] dark:bg-rose-950/40 dark:text-rose-400" : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"}`}>
                          {l.visitType}
                        </span>
                      </td>
                      <td className="crm-td font-semibold text-theme-secondary whitespace-nowrap">{l.purpose}</td>
                      <td className="crm-td font-medium text-theme-secondary whitespace-nowrap">
                        <p>{checkInText}</p>
                        <p className={`text-[10px] mt-0.5 font-bold ${isActive ? "text-[#D44D4D] dark:text-rose-400" : "text-theme-muted"}`}>
                          {isActive 
                            ? `🟡 Active${l.visitType === "Outbound" ? ` (by ${l.executiveName})` : ""}` 
                            : (l.visitType === "Inbound" 
                                ? `Ended: ${checkOutText}` 
                                : `Out: ${checkOutText} (by ${l.executiveName})`
                              )
                          }
                        </p>
                      </td>
                      <td className="crm-td whitespace-nowrap">
                        <LogPurposeStatusBadge purpose={l.purpose} status={l.status} outcome={l.outcome} />
                      </td>
                      <td className="crm-td whitespace-nowrap">
                        <span className={`inline-flex items-center justify-center w-20 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                          l.customerDecision === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50"
                            : l.customerDecision === "REJECTED"
                              ? "bg-red-50 text-red-700 border-red-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50"
                              : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/50"
                        }`}>
                          {l.customerDecision}
                        </span>
                      </td>
                      <td className="crm-td text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isActive && (
                            <button
                              onClick={() => openCheckOut(l)}
                              className="px-2.5 py-1 bg-[#D44D4D] hover:bg-[#C94F4F] text-white font-bold text-[10px] rounded-lg transition-colors uppercase tracking-wider cursor-pointer"
                            >
                              Check Out
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenDetails(l)}
                            title="View Details"
                            className="p-1.5 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-offset)] text-theme-secondary transition-colors"
                          >
                            {icons.eye}
                          </button>
                          <button
                            onClick={() => handleOpenEdit(l)}
                            disabled={!isEditable}
                            title={isEditable ? "Edit Remarks" : "Expired (24 hr limit reached)"}
                            className={`p-1.5 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-offset)] text-theme-secondary transition-colors ${!isEditable ? "opacity-35 cursor-not-allowed" : ""}`}
                          >
                            {icons.edit}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Details Modal ─────────────────────────────────────────── */}
      {isDetailsOpen && selectedVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-red-50 to-slate-50 dark:from-red-950/20 dark:to-slate-900 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Visit & Meeting Inspection</h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5 uppercase tracking-wide">ID: {selectedVisit.id.slice(-8).toUpperCase()}</p>
              </div>
              <button onClick={() => setIsDetailsOpen(false)} className="w-8 h-8 rounded-xl bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all cursor-pointer">
                {icons.x}
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Customer</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-1">{selectedVisit.customerName}</p>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">{selectedVisit.customerCode}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Executive Host</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-1">{selectedVisit.executiveName}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50 dark:border-slate-800">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Visit Type</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">{selectedVisit.visitType} Visit</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Purpose</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">{selectedVisit.purpose}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50 dark:border-slate-800">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Check-In Time</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">{new Date(selectedVisit.checkInTime).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Check-Out Time</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">
                    {selectedVisit.checkOutTime ? new Date(selectedVisit.checkOutTime).toLocaleString() : "Still onsite"}
                  </p>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-50 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Meeting Description / Summary</p>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800 mt-1.5 leading-relaxed">
                  {selectedVisit.notes || "No check-out description saved."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50 dark:border-slate-800">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Outcome</p>
                  <div className="mt-1">
                    <LogPurposeStatusBadge purpose={selectedVisit.purpose} status={selectedVisit.status} outcome={selectedVisit.outcome} />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Customer Decision</p>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black border mt-1 ${
                    selectedVisit.customerDecision === "APPROVED"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50"
                      : selectedVisit.customerDecision === "REJECTED"
                        ? "bg-red-50 text-red-700 border-red-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50"
                        : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-450 dark:border-slate-700/50"
                  }`}>
                    {selectedVisit.customerDecision}
                  </span>
                </div>
              </div>
              {selectedVisit.customerDecision === "REJECTED" && (
                <div className="p-3.5 bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 rounded-xl text-red-800 dark:text-red-300">
                  <p className="text-[9px] font-bold uppercase tracking-wider">Rejection Reason</p>
                  <p className="text-xs font-semibold mt-1">{selectedVisit.rejectionReason || "None specified"}</p>
                </div>
              )}
              {selectedVisit.nextMeetingDate && (
                <div className="p-3.5 bg-amber-50/40 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-2xl">
                  <p className="text-[9px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">Next Scheduled Follow-Up</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-350 mt-1">⌚ {new Date(selectedVisit.nextMeetingDate).toLocaleString()}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
              <button onClick={() => setIsDetailsOpen(false)} className="px-5 py-2.5 bg-[#151515] hover:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer">
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Remarks Modal ────────────────────────────────────── */}
      {isEditOpen && selectedVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-red-50 to-slate-50 dark:from-red-950/20 dark:to-slate-900 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Edit Visit Remarks</h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">Customer: {selectedVisit.customerName}</p>
              </div>
              <button onClick={() => setIsEditOpen(false)} className="w-8 h-8 rounded-xl bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all cursor-pointer">
                {icons.x}
              </button>
            </div>
            <form onSubmit={handleSaveRemarksSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                {errorMsg && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 text-xs font-semibold text-red-600 dark:text-red-400 text-center">{errorMsg}</div>
                )}
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-100 dark:border-amber-900/40 leading-relaxed uppercase tracking-wider">
                  ⚠️ Note: Remarks can only be updated within 24 hours of creation. After 24 hours, the visit log is completely read-only.
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1.5">Remarks / Notes</label>
                  <textarea
                    rows={6}
                    required
                    value={remarksInput}
                    onChange={(e) => setRemarksInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-750 text-sm focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20 focus:border-[#D44D4D] transition-all text-slate-700 dark:text-slate-200 font-medium resize-none"
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsEditOpen(false)} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={formLoading} className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#D44D4D] hover:bg-[#C94F4F] transition-colors shadow-sm cursor-pointer">
                  {formLoading ? "Saving..." : "Save Remarks"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Check-In Modal ────────────────────────────────────────── */}
      <OutboundCheckInModal
        isOpen={isOutboundOpen}
        onClose={() => setIsOutboundOpen(false)}
        onSuccess={loadData}
        loggedInUser={user ? { name: user.name, id: user.id } : null}
      />

      {/* Shared Check-Out Modal */}
      <CheckOutModal
        isOpen={isCheckOutOpen}
        onClose={() => setIsCheckOutOpen(false)}
        onSuccess={loadData}
        onCheckInNext={(type) => {
          setIsCheckOutOpen(false);
          if (type === "Outbound") setIsOutboundOpen(true);
          // Inbound check-in is not available on this page — navigate to dashboard
          else window.location.href = "/dashboard";
        }}
        visit={checkoutVisit}
      />

    </PageContainer>
  );
}
