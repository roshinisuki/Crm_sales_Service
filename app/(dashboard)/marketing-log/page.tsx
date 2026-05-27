"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getVisitHistoryAction, editVisitRemarksAction, deleteVisitAction, checkInOutboundAction, checkOutOutboundAction, checkInInboundAction, checkOutInboundAction } from "@/app/actions/visits";
import { getUsersAction } from "@/app/actions/users";
import { getCustomersAction } from "@/app/actions/customers";

const icons = {
  search: <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  filter: <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>,
  eye: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  edit: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  delete: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  x: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
};

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
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [remarksInput, setRemarksInput] = useState("");

  // Check-In modal state
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [checkInType, setCheckInType] = useState<"Inbound" | "Outbound">("Outbound");
  const [ciCustomerId, setCiCustomerId] = useState("");
  const [ciPurpose, setCiPurpose] = useState("");
  const [ciNotes, setCiNotes] = useState("");
  const [ciLat, setCiLat] = useState<number | null>(null);
  const [ciLng, setCiLng] = useState<number | null>(null);

  // Check-Out modal state
  const [isCheckOutOpen, setIsCheckOutOpen] = useState(false);
  const [checkoutVisit, setCheckoutVisit] = useState<any>(null);
  const [coMeetingSummary, setCoMeetingSummary] = useState("");
  const [coOutcome, setCoOutcome] = useState("");
  const [coDecision, setCoDecision] = useState("PENDING");
  const [coRejectionReason, setCoRejectionReason] = useState("");
  const [coNextDate, setCoNextDate] = useState("");
  const [coNextNotes, setCoNextNotes] = useState("");
  const [coLat, setCoLat] = useState<number | null>(null);
  const [coLng, setCoLng] = useState<number | null>(null);

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
      if (user?.role !== "MarketingExecutive") {
        const execRes = await getUsersAction();
        if (execRes.success && execRes.data) {
          const filteredExecs = execRes.data.filter((u: any) => ["MarketingExecutive", "MarketingLead"].includes(u.role));
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
      alert("Validation: Visit remarks can only be edited within 24 hours of check-in.");
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

  const handleDeleteVisit = async (item: any) => {
    const confirmDelete = window.confirm("Are you absolutely sure you want to delete this visit record? This action cannot be undone.");
    if (!confirmDelete) return;
    try {
      const res = await deleteVisitAction(item.id, item.visitType);
      if (res.success) {
        loadData();
      } else {
        alert(res.message || "Failed to delete visit record.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ── Check-In handlers ─────────────────────────────────────────────
  const openCheckIn = (type: "Inbound" | "Outbound") => {
    setCheckInType(type);
    setCiCustomerId("");
    setCiPurpose("");
    setCiNotes("");
    setCiLat(null);
    setCiLng(null);
    setErrorMsg("");

    if (type === "Outbound" && navigator.geolocation) {
      setFormLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCiLat(pos.coords.latitude);
          setCiLng(pos.coords.longitude);
          setFormLoading(false);
          setIsCheckInOpen(true);
        },
        (err) => {
          alert("Could not fetch GPS location: " + err.message + "\nYou can still check in manually without it.");
          setFormLoading(false);
          setIsCheckInOpen(true);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setIsCheckInOpen(true);
    }
  };

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setErrorMsg("");
    try {
      let res;
      if (checkInType === "Inbound") {
        res = await checkInInboundAction({ customerId: ciCustomerId, purpose: ciPurpose, notes: ciNotes });
      } else {
        res = await checkInOutboundAction({
          customerId: ciCustomerId,
          purpose: ciPurpose,
          notes: ciNotes,
          checkInLat: ciLat ?? undefined,
          checkInLng: ciLng ?? undefined,
        });
      }
      if (res.success) {
        setIsCheckInOpen(false);
        loadData();
      } else {
        setErrorMsg(res.message ?? "Check-in failed.");
      }
    } catch {
      setErrorMsg("Failed to check in.");
    } finally {
      setFormLoading(false);
    }
  };

  // ── Check-Out handlers ────────────────────────────────────────────
  const openCheckOut = (visit: any) => {
    setCheckoutVisit(visit);
    setCoMeetingSummary(visit.notes || "");
    setCoOutcome("");
    setCoDecision("PENDING");
    setCoRejectionReason("");
    setCoNextDate("");
    setCoNextNotes("");
    setCoLat(null);
    setCoLng(null);
    setErrorMsg("");

    if (visit.visitType === "Outbound" && navigator.geolocation) {
      setFormLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoLat(pos.coords.latitude);
          setCoLng(pos.coords.longitude);
          setFormLoading(false);
          setIsCheckOutOpen(true);
        },
        () => {
          setFormLoading(false);
          setIsCheckOutOpen(true);
        }
      );
    } else {
      setIsCheckOutOpen(true);
    }
  };

  const handleCheckOutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setErrorMsg("");
    try {
      const base = {
        id: checkoutVisit.id,
        outcome: coOutcome,
        customerDecision: coDecision,
        rejectionReason: coRejectionReason || undefined,
        nextMeetingDate: coNextDate || undefined,
        nextMeetingNotes: coNextNotes || undefined,
      };
      let res;
      if (checkoutVisit.visitType === "Inbound") {
        res = await checkOutInboundAction({ ...base, meetingSummary: coMeetingSummary });
      } else {
        res = await checkOutOutboundAction({
          ...base,
          meetingDescription: coMeetingSummary,
          checkOutLat: coLat ?? undefined,
          checkOutLng: coLng ?? undefined,
        });
      }
      if (res.success) {
        setIsCheckOutOpen(false);
        loadData();
      } else {
        setErrorMsg(res.message ?? "Checkout failed.");
      }
    } catch {
      setErrorMsg("Checkout failed.");
    } finally {
      setFormLoading(false);
    }
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

  const needsFollowUp = ["Interested", "Follow-up Required", "Pending Decision"].includes(coOutcome);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-200">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Visit & Field Logs</h1>
          <p className="text-xs text-slate-500 font-medium">Log check-ins, capture GPS, and track every customer visit.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => openCheckIn("Outbound")}
            disabled={formLoading}
            className="flex items-center gap-2 px-4 py-2 bg-[#0D2137] text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
          >
            📍 Field Check-In
          </button>
          <button
            onClick={() => openCheckIn("Inbound")}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors"
          >
            🏢 Walk-in Log
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          {icons.filter}
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Advanced Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 text-xs font-semibold text-slate-600">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Visit Type</label>
            <select value={visitType} onChange={(e) => setVisitType(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none font-semibold text-slate-700">
              <option value="">All Types</option>
              <option value="Inbound">Inbound (Walk-in)</option>
              <option value="Outbound">Outbound (Field)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Outcome</label>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none font-semibold text-slate-700">
              <option value="">All Outcomes</option>
              <option value="Interested">Interested</option>
              <option value="Not Interested">Not Interested</option>
              <option value="Follow-up Required">Follow-up Required</option>
              <option value="Pending Decision">Pending Decision</option>
              <option value="Converted">Converted</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Decision Status</label>
            <select value={decision} onChange={(e) => setDecision(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none font-semibold text-slate-700">
              <option value="">All Decisions</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>
          {user?.role !== "MarketingExecutive" && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Executive</label>
              <select value={selectedExecutiveId} onChange={(e) => setSelectedExecutiveId(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none font-semibold text-slate-700">
                <option value="">All Executives</option>
                {executives.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-center bg-slate-50/30 relative">
          <span className="absolute left-9 text-slate-400">{icons.search}</span>
          <input
            type="text"
            placeholder="Search by customer name, purpose, or executive..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 font-medium text-slate-700"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200/60">
                <th className="px-6 py-4">Customer</th>
                <th className="px-4 py-4">Type</th>
                <th className="px-4 py-4">Purpose</th>
                <th className="px-4 py-4">Timings</th>
                <th className="px-4 py-4">Outcome</th>
                <th className="px-4 py-4">Decision</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400 font-bold">Loading visit history logs...</td></tr>
              ) : searchedLogs.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400 font-semibold">No visit logs recorded matching filters</td></tr>
              ) : (
                searchedLogs.map((l) => {
                  const checkInText = new Date(l.checkInTime).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
                  const checkOutText = l.checkOutTime
                    ? new Date(l.checkOutTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                    : "Active";
                  const isEditable = (new Date().getTime() - new Date(l.createdAt).getTime()) / (1000 * 60 * 60) <= 24;
                  const isActive = !l.checkOutTime;

                  return (
                    <tr key={l.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800">{l.customerName}</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">{l.customerCode} • {l.executiveName}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] ${l.visitType === "Inbound" ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-800"}`}>
                          {l.visitType}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-600">{l.purpose}</td>
                      <td className="px-4 py-4 font-medium text-slate-500">
                        <p>{checkInText}</p>
                        <p className={`text-[10px] mt-0.5 font-bold ${isActive ? "text-amber-500" : "text-slate-400"}`}>
                          {isActive ? "🟡 Active" : `Out: ${checkOutText}`}
                        </p>
                      </td>
                      <td className="px-4 py-4 font-bold text-slate-700">{l.outcome}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full font-black text-[9px] border ${
                          l.customerDecision === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : l.customerDecision === "REJECTED"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}>
                          {l.customerDecision}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isActive && (
                            <button
                              onClick={() => openCheckOut(l)}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] rounded-lg transition-colors uppercase tracking-wider"
                            >
                              Check Out
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenDetails(l)}
                            title="View Details"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                          >
                            {icons.eye}
                          </button>
                          <button
                            onClick={() => handleOpenEdit(l)}
                            disabled={!isEditable}
                            title={isEditable ? "Edit Remarks" : "Expired (24 hr limit reached)"}
                            className={`p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors ${!isEditable ? "opacity-35 cursor-not-allowed" : ""}`}
                          >
                            {icons.edit}
                          </button>
                          {user?.role === "Admin" && (
                            <button
                              onClick={() => handleDeleteVisit(l)}
                              title="Delete Record"
                              className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                            >
                              {icons.delete}
                            </button>
                          )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-800">Visit & Meeting Inspection</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-wide">ID: {selectedVisit.id.slice(-8).toUpperCase()}</p>
              </div>
              <button onClick={() => setIsDetailsOpen(false)} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700">
                {icons.x}
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs font-semibold text-slate-600">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Customer</p>
                  <p className="text-sm font-bold text-slate-800 mt-1">{selectedVisit.customerName}</p>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">{selectedVisit.customerCode}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Executive Host</p>
                  <p className="text-sm font-bold text-slate-800 mt-1">{selectedVisit.executiveName}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Visit Type</p>
                  <p className="text-xs font-bold text-slate-700 mt-1">{selectedVisit.visitType} Visit</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Purpose</p>
                  <p className="text-xs font-bold text-slate-700 mt-1">{selectedVisit.purpose}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Check-In Time</p>
                  <p className="text-xs font-bold text-slate-700 mt-1">{new Date(selectedVisit.checkInTime).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Check-Out Time</p>
                  <p className="text-xs font-bold text-slate-700 mt-1">
                    {selectedVisit.checkOutTime ? new Date(selectedVisit.checkOutTime).toLocaleString() : "Still onsite"}
                  </p>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-50">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Meeting Description / Summary</p>
                <p className="text-xs font-semibold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 mt-1.5 leading-relaxed">
                  {selectedVisit.notes || "No check-out description saved."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Outcome</p>
                  <p className="text-xs font-bold text-slate-700 mt-1">{selectedVisit.outcome}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Customer Decision</p>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black border mt-1 ${
                    selectedVisit.customerDecision === "APPROVED"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : selectedVisit.customerDecision === "REJECTED"
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}>
                    {selectedVisit.customerDecision}
                  </span>
                </div>
              </div>
              {selectedVisit.customerDecision === "REJECTED" && (
                <div className="p-3.5 bg-red-50/50 border border-red-100 rounded-xl text-red-800">
                  <p className="text-[9px] font-bold uppercase tracking-wider">Rejection Reason</p>
                  <p className="text-xs font-semibold mt-1">{selectedVisit.rejectionReason || "None specified"}</p>
                </div>
              )}
              {selectedVisit.nextMeetingDate && (
                <div className="p-3.5 bg-amber-50/40 border border-amber-100 rounded-2xl">
                  <p className="text-[9px] font-bold text-amber-800 uppercase tracking-wider">Next Scheduled Follow-Up</p>
                  <p className="text-xs font-bold text-slate-700 mt-1">⌚ {new Date(selectedVisit.nextMeetingDate).toLocaleString()}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
              <button onClick={() => setIsDetailsOpen(false)} className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs">
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Remarks Modal ────────────────────────────────────── */}
      {isEditOpen && selectedVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-800">Edit Visit Remarks</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Customer: {selectedVisit.customerName}</p>
              </div>
              <button onClick={() => setIsEditOpen(false)} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700">
                {icons.x}
              </button>
            </div>
            <form onSubmit={handleSaveRemarksSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                {errorMsg && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs font-semibold text-red-600 text-center">{errorMsg}</div>
                )}
                <p className="text-[10px] font-bold text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-100 leading-relaxed uppercase tracking-wider">
                  ⚠️ Note: Remarks can only be updated within 24 hours of creation. After 24 hours, the visit log is completely read-only.
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Remarks / Notes</label>
                  <textarea
                    rows={6}
                    required
                    value={remarksInput}
                    onChange={(e) => setRemarksInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 font-medium resize-none"
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsEditOpen(false)} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200">
                  Cancel
                </button>
                <button type="submit" disabled={formLoading} className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#0D2137] hover:bg-slate-800 transition-colors">
                  {formLoading ? "Saving..." : "Save Remarks"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Check-In Modal ────────────────────────────────────────── */}
      {isCheckInOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {checkInType === "Outbound" ? "📍 New Field Check-In" : "🏢 New Walk-in Check-In"}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Start a new visit — timer begins now</p>
              </div>
              <button onClick={() => setIsCheckInOpen(false)} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700">
                {icons.x}
              </button>
            </div>
            <form onSubmit={handleCheckInSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                {errorMsg && (
                  <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100">{errorMsg}</div>
                )}
                {checkInType === "Outbound" && (
                  <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${ciLat && ciLng ? "bg-emerald-50 border border-emerald-100 text-emerald-700" : "bg-amber-50 border border-amber-100 text-amber-700"}`}>
                    {ciLat && ciLng
                      ? `✅ GPS Captured: (${ciLat.toFixed(4)}, ${ciLng.toFixed(4)})`
                      : "⚠️ GPS not captured — visit will be logged without coordinates"}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Customer *</label>
                  <select
                    required
                    value={ciCustomerId}
                    onChange={(e) => setCiCustomerId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold text-slate-700"
                  >
                    <option value="">Select Customer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.customerCode})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Purpose of Visit *</label>
                  <select
                    required
                    value={ciPurpose}
                    onChange={(e) => setCiPurpose(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold text-slate-700"
                  >
                    <option value="">Select Purpose...</option>
                    <option value="Sales Pitch">Sales Pitch</option>
                    <option value="Follow-up Meeting">Follow-up Meeting</option>
                    <option value="Subscription Renewal">Subscription Renewal</option>
                    <option value="Demo">Demo / Presentation</option>
                    <option value="Support Visit">Support / Training</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Initial Notes (Optional)</label>
                  <textarea
                    rows={3}
                    value={ciNotes}
                    onChange={(e) => setCiNotes(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium resize-none text-slate-700"
                    placeholder="Meeting objectives, agenda..."
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsCheckInOpen(false)} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200">
                  Cancel
                </button>
                <button type="submit" disabled={formLoading} className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
                  {formLoading ? "Processing..." : "✓ Confirm Check-In"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Check-Out Modal ───────────────────────────────────────── */}
      {isCheckOutOpen && checkoutVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-800">Complete Check-Out</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                  {checkoutVisit.visitType} visit • {checkoutVisit.customerName}
                </p>
              </div>
              <button onClick={() => setIsCheckOutOpen(false)} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700">
                {icons.x}
              </button>
            </div>
            <form onSubmit={handleCheckOutSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                {errorMsg && (
                  <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100">{errorMsg}</div>
                )}
                {checkoutVisit.visitType === "Outbound" && (
                  <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${coLat && coLng ? "bg-emerald-50 border border-emerald-100 text-emerald-700" : "bg-amber-50 border border-amber-100 text-amber-700"}`}>
                    {coLat && coLng
                      ? `✅ Check-out GPS Captured: (${coLat.toFixed(4)}, ${coLng.toFixed(4)})`
                      : "⚠️ GPS not captured — checkout will be logged without coordinates"}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Meeting Summary *</label>
                  <textarea
                    required
                    rows={3}
                    value={coMeetingSummary}
                    onChange={(e) => setCoMeetingSummary(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:outline-none text-slate-700 resize-none"
                    placeholder="What was discussed? Key takeaways..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Outcome *</label>
                    <select
                      required
                      value={coOutcome}
                      onChange={(e) => setCoOutcome(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 text-slate-700"
                    >
                      <option value="">Select...</option>
                      <option value="Interested">Interested</option>
                      <option value="Not Interested">Not Interested</option>
                      <option value="Follow-up Required">Follow-up Required</option>
                      <option value="Pending Decision">Pending Decision</option>
                      <option value="Converted">Converted</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Decision *</label>
                    <select
                      required
                      value={coDecision}
                      onChange={(e) => setCoDecision(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 text-slate-700"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="APPROVED">Approved ✓ (Activates Portal)</option>
                      <option value="REJECTED">Rejected</option>
                    </select>
                  </div>
                </div>
                {coDecision === "REJECTED" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Rejection Reason *</label>
                    <input
                      required
                      type="text"
                      value={coRejectionReason}
                      onChange={(e) => setCoRejectionReason(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 text-slate-700"
                      placeholder="Why did the customer decline?"
                    />
                  </div>
                )}
                {needsFollowUp && (
                  <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-xl space-y-3">
                    <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">📅 Schedule Next Follow-Up</p>
                    <input
                      required
                      type="datetime-local"
                      value={coNextDate}
                      onChange={(e) => setCoNextDate(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Follow-up notes or agenda..."
                      value={coNextNotes}
                      onChange={(e) => setCoNextNotes(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none text-slate-700"
                    />
                  </div>
                )}
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsCheckOutOpen(false)} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200">
                  Cancel
                </button>
                <button type="submit" disabled={formLoading} className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50">
                  {formLoading ? "Processing..." : "✓ Complete Check-Out"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
