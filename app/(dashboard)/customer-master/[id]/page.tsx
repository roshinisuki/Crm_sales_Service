"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCustomerByIdAction, updateCustomerAction } from "@/app/actions/customers";
import { createFollowUpAction } from "@/app/actions/followUps";
import { createCallAction } from "@/app/actions/activities";
import { getCallLogsAction } from "@/app/actions/calls";
import { createDealAction, updateDealAction, updateDealStatusAction, deleteDealAction } from "@/app/actions/deals";
import { getUsersAction } from "@/app/actions/users";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";

const icons = {
  back: "M10 19l-7-7m0 0l7-7m-7 7h18",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  check: "M5 13l4 4L19 7",
  plus: "M12 4v16m8-8H4",
  phone: "M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z",
  briefcase: "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  calendar: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  document: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  trash: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
  pencil: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
};

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const STATUS_OPTIONS = [
  "New",
  "Contacted",
  "Qualified",
  "ProposalSent",
  "Negotiation",
  "Converted",
  "Lost"
];

const LEAD_SOURCES = [
  "Website",
  "Facebook",
  "Instagram",
  "LinkedIn",
  "Referral",
  "WalkIn",
  "ColdCall",
  "Partner"
];

const DEAL_STATUSES = ["Open", "ProposalSent", "Negotiation", "Won", "Lost"];

export default function Customer360Page({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(paramsPromise);
  const customerId = resolvedParams.id;
  const router = useRouter();
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [executives, setExecutives] = useState<any[]>([]);

  // Call Logger Widget State
  const [callNotes, setCallNotes] = useState("");
  const [callDuration, setCallDuration] = useState("");
  const [savingCall, setSavingCall] = useState(false);

  // Follow Up Modal State
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [followUpPriority, setFollowUpPriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [followUpAssigneeId, setFollowUpAssigneeId] = useState("");
  const [savingFollowUp, setSavingFollowUp] = useState(false);

  // Deal Modal State
  const [showDealModal, setShowDealModal] = useState(false);
  const [dealModalMode, setDealModalMode] = useState<"create" | "edit">("create");
  const [currentDealId, setCurrentDealId] = useState("");
  const [dealName, setDealName] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [dealNotes, setDealNotes] = useState("");
  const [dealStatus, setDealStatus] = useState("Open");
  const [savingDeal, setSavingDeal] = useState(false);

  const loadCustomer = async () => {
    setLoading(true);
    const res = await getCustomerByIdAction(customerId);
    if (res.success) {
      setCustomer(res.data);
    } else {
      toast.error("Failed to load customer details.");
      router.push("/customer-master");
    }
    setLoading(false);
  };

  const loadExecutives = async () => {
    const res = await getUsersAction();
    if (res.success && res.data) {
      setExecutives(res.data.filter((u: any) => u.role === "SalesExecutive" || u.role === "SalesManager"));
    }
  };

  useEffect(() => {
    loadCustomer();
    loadExecutives();
  }, [customerId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!customer) return;
    const res = await updateCustomerAction({
      id: customer.id,
      customerCode: customer.customerCode,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      city: customer.city,
      status: newStatus,
      assignedUserId: customer.assignedUserId,
      leadSource: customer.leadSource
    });
    if (res.success) {
      toast.success(`Status updated to ${newStatus}`);
      setCustomer({ ...customer, status: newStatus });
    } else {
      toast.error(res.message || "Failed to update status");
    }
  };

  const handleLeadSourceChange = async (newSource: string) => {
    if (!customer) return;
    const res = await updateCustomerAction({
      id: customer.id,
      customerCode: customer.customerCode,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      city: customer.city,
      status: customer.status,
      assignedUserId: customer.assignedUserId,
      leadSource: newSource
    });
    if (res.success) {
      toast.success("Lead source updated");
      setCustomer({ ...customer, leadSource: newSource });
    } else {
      toast.error(res.message || "Failed to update lead source");
    }
  };

  const handleLogCall = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCall(true);
    const res = await createCallAction({
      customerId: customerId,
      leadId: null,
      dealId: null,
      direction: "Outbound",
      duration: callDuration ? parseInt(callDuration, 10) : undefined,
      content: callNotes,
      status: "Completed",
    });

    if (res.success) {
      toast.success("Call logged successfully.");
      setCallNotes("");
      setCallDuration("");
      loadCustomer(); // reload lists and timeline
    } else {
      toast.error(res.message || "Failed to log call");
    }
    setSavingCall(false);
  };

  const handleAddFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingFollowUp(true);
    const res = await createFollowUpAction({
      customerId: customerId,
      nextMeetingDate: followUpDate,
      scheduledTime: followUpDate,
      notes: followUpNotes,
      remarks: followUpNotes,
      priority: followUpPriority,
      assignedUserId: currentUser?.role === "SalesExecutive" ? currentUser.id : (followUpAssigneeId || currentUser?.id),
      assignedToId: currentUser?.role === "SalesExecutive" ? currentUser.id : (followUpAssigneeId || currentUser?.id),
      sourceType: "MANUAL",
      autoCreated: false
    });

    if (res.success) {
      toast.success("Follow-up scheduled.");
      setShowFollowUpModal(false);
      setFollowUpDate("");
      setFollowUpNotes("");
      loadCustomer();
    } else {
      toast.error(res.message || "Failed to schedule follow-up.");
    }
    setSavingFollowUp(false);
  };

  const openCreateDealModal = () => {
    setDealModalMode("create");
    setDealName("");
    setDealValue("");
    setExpectedCloseDate("");
    setAssignedUserId(currentUser?.id || "");
    setDealNotes("");
    setDealStatus("Open");
    setShowDealModal(true);
  };

  const openEditDealModal = (deal: any) => {
    setDealModalMode("edit");
    setCurrentDealId(deal.id);
    setDealName(deal.dealName);
    setDealValue(deal.dealValue.toString());
    setExpectedCloseDate(deal.expectedCloseDate.substring(0, 10));
    setAssignedUserId(deal.assignedUserId || "");
    setDealNotes(deal.notes || "");
    setDealStatus(deal.status);
    setShowDealModal(true);
  };

  const handleDealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealName || !expectedCloseDate || !dealValue) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const parsedVal = parseFloat(dealValue);
    if (isNaN(parsedVal) || parsedVal <= 0) {
      toast.error("Deal Value must be a positive number.");
      return;
    }

    const selectedDate = new Date(expectedCloseDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      toast.error("Expected Close Date must be today or a future date.");
      return;
    }

    setSavingDeal(true);
    const payload = {
      dealName,
      customerId: customerId,
      dealValue: parsedVal,
      expectedCloseDate: selectedDate.toISOString(),
      assignedUserId: assignedUserId || undefined,
      notes: dealNotes,
      status: dealStatus
    };

    let res;
    if (dealModalMode === "create") {
      res = await createDealAction(payload);
    } else {
      res = await updateDealAction({ id: currentDealId, ...payload });
    }

    if (res.success) {
      toast.success(res.message || "Deal processed successfully");
      setShowDealModal(false);
      loadCustomer(); // Refreshes deals & status
    } else {
      toast.error(res.message || "Failed to save deal");
    }
    setSavingDeal(false);
  };

  const handleFastDealStatusChange = async (dealId: string, newStatus: string) => {
    const res = await updateDealStatusAction(dealId, newStatus);
    if (res.success) {
      toast.success("Deal status updated");
      loadCustomer();
    } else {
      toast.error(res.message || "Failed to update status");
    }
  };

  const handleDeleteDeal = async (dealId: string) => {
    if (!confirm("Are you sure you want to delete this deal?")) return;
    const res = await deleteDealAction(dealId);
    if (res.success) {
      toast.success("Deal deleted");
      loadCustomer();
    } else {
      toast.error(res.message || "Failed to delete deal");
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-500">Loading Customer details...</div>;
  }
  if (!customer) return null;

  const currentIndex = STATUS_OPTIONS.indexOf(customer.status);

  // Dynamic next follow-up and last contact calculation
  const pendingFollowUps = customer.followUps?.filter((f: any) => f.status === "Pending" || f.status === "Overdue");
  const sortedPending = pendingFollowUps ? [...pendingFollowUps].sort((a: any, b: any) => new Date(a.nextMeetingDate).getTime() - new Date(b.nextMeetingDate).getTime()) : [];
  const nextFollowUp = sortedPending[0];
  const nextFollowUpDateText = nextFollowUp ? new Date(nextFollowUp.nextMeetingDate).toLocaleString() : "None scheduled";

  const completedFollowUps = customer.followUps?.filter((f: any) => f.status === "Completed");
  const sortedCompleted = completedFollowUps ? [...completedFollowUps].sort((a: any, b: any) => new Date(b.completedAt || b.nextMeetingDate).getTime() - new Date(a.completedAt || a.nextMeetingDate).getTime()) : [];
  const lastCompleted = sortedCompleted[0];
  const lastContactDateText = lastCompleted ? new Date(lastCompleted.completedAt || lastCompleted.nextMeetingDate).toLocaleString() : "No completed contact yet";

  // Unified Timeline Event Aggregator
  const timelineEvents: any[] = [];

  // 1. Lead Creation
  timelineEvents.push({
    id: "creation",
    type: "creation",
    title: "Lead Created",
    date: new Date(customer.createdAt),
    details: `Customer code ${customer.customerCode} registered.`,
    icon: icons.user,
    colorClass: "bg-blue-100 text-blue-600"
  });

  // 2. Call Logs
  customer.callLogs?.forEach((c: any) => {
    timelineEvents.push({
      id: c.id,
      type: "call",
      title: `Call Logged by ${c.user?.name || "System"}`,
      date: new Date(c.timestamp),
      details: c.notes || "No call notes.",
      duration: c.duration,
      icon: icons.phone,
      colorClass: "bg-amber-100 text-amber-600"
    });
  });

  // 3. Follow Ups
  customer.followUps?.forEach((f: any) => {
    const isCompleted = f.status === "Completed";
    const autoCreatedText = f.autoCreated ? " (Auto-created)" : "";
    timelineEvents.push({
      id: f.id,
      type: "followup",
      title: `Follow-Up: ${f.status}${autoCreatedText}`,
      date: new Date(f.createdAt),
      details: f.remarks || f.notes || "No additional follow-up notes.",
      scheduledDate: new Date(f.nextMeetingDate),
      dueDate: f.dueDate ? new Date(f.dueDate) : null,
      assignee: f.assignedUser?.name,
      status: f.status,
      sourceType: f.sourceType || "MANUAL",
      autoCreated: f.autoCreated,
      completionNotes: f.completionNotes,
      completedBy: f.completedBy?.name,
      completedAt: f.completedAt ? new Date(f.completedAt) : null,
      icon: icons.clock,
      colorClass: isCompleted ? "bg-emerald-100 text-emerald-600" : f.status === "Cancelled" ? "bg-slate-100 text-slate-400" : f.status === "Overdue" ? "bg-red-100 text-red-650 animate-pulse" : "bg-red-100 text-red-500"
    });
  });

  // 4. Deals
  customer.deals?.forEach((d: any) => {
    timelineEvents.push({
      id: d.id,
      type: "deal",
      title: `Deal "${d.dealName}" updated to ${d.status}`,
      date: new Date(d.updatedAt),
      details: `Value: $${d.dealValue.toLocaleString()} • Target Close: ${new Date(d.expectedCloseDate).toLocaleDateString()}`,
      notes: d.notes,
      icon: icons.briefcase,
      colorClass: d.status === "Won" ? "bg-emerald-100 text-emerald-600" : d.status === "Lost" ? "bg-rose-100 text-rose-600" : "bg-purple-100 text-purple-600"
    });
  });

  // 5. Visits
  customer.marketingVisits?.forEach((v: any) => {
    timelineEvents.push({
      id: v.id,
      type: "visit",
      title: `Field Visit: ${v.status}`,
      date: new Date(v.checkIn),
      details: `Purpose: ${v.purpose || "General meeting"} • Outcomes: ${v.outcome || "N/A"}`,
      remarks: v.remarks,
      icon: icons.calendar,
      colorClass: "bg-sky-100 text-sky-600"
    });
  });

  customer.customerVisits?.forEach((v: any) => {
    timelineEvents.push({
      id: v.id,
      type: "visit",
      title: `Office Visit: ${v.status}`,
      date: new Date(v.checkInTime),
      details: `Purpose: ${v.purpose || "Walk-In"} • Hosted by ${v.host?.name || "System"}`,
      outcome: v.outcome,
      icon: icons.calendar,
      colorClass: "bg-teal-100 text-teal-600"
    });
  });

  // 6. Subscriptions
  customer.subscriptions?.forEach((s: any) => {
    timelineEvents.push({
      id: s.id,
      type: "subscription",
      title: `Subscription ${s.planName} Activated (${s.status})`,
      date: new Date(s.createdAt),
      details: `Validity: ${new Date(s.startDate).toLocaleDateString()} to ${new Date(s.endDate).toLocaleDateString()}`,
      notes: s.notes,
      icon: icons.document,
      colorClass: "bg-indigo-100 text-indigo-600"
    });
  });

  // Sort chronologically descending
  timelineEvents.sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push("/customer-master")}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-650 transition-colors"
          >
            <Ico d={icons.back} size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{customer.name}</h1>
            <p className="text-sm text-slate-500 font-medium">
              {customer.customerCode} • {customer.city || "No City"}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {currentUser?.role !== "Customer" && (
            <button 
              onClick={openCreateDealModal}
              className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Ico d={icons.plus} />
              New Deal
            </button>
          )}
        </div>
      </div>

      {/* Progress Pipeline */}
      <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Lead Status Pipeline</h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {STATUS_OPTIONS.map((status, index) => {
            const isCompleted = currentIndex > index || (currentIndex === index && (status === "Converted" || status === "Lost"));
            const isCurrent = currentIndex === index && status !== "Converted" && status !== "Lost";
            
            let colorClass = "bg-slate-100 text-slate-400 border-slate-200";
            if (isCompleted) colorClass = "bg-emerald-50 text-emerald-600 border-emerald-200";
            if (isCurrent) colorClass = "bg-[var(--primary)] text-white border-[#C94F4F] shadow-md";
            
            return (
              <React.Fragment key={status}>
                <div 
                  onClick={() => handleStatusChange(status)}
                  className={`flex items-center justify-center px-4 py-2 rounded-xl text-sm font-bold border transition-all cursor-pointer ${colorClass} ${status === "Lost" && isCurrent ? "!bg-rose-500 !text-white !border-rose-600" : ""}`}
                >
                  {status}
                </div>
                {index < STATUS_OPTIONS.length - 1 && (
                  <div className={`h-0.5 w-8 shrink-0 ${isCompleted ? "bg-emerald-200" : "bg-slate-100"}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="flex border-b border-slate-200 gap-6 overflow-x-auto pb-px">
        {[
          { id: "overview", label: "Overview" },
          { id: "timeline", label: "Timeline History" },
          { id: "deals", label: `Deals (${customer.deals?.length || 0})` },
          { id: "visits", label: "Visits" },
          { id: "followups", label: "Follow-Ups" },
          { id: "subscriptions", label: "Subscriptions" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === tab.id
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Box: details */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Customer Name</h4>
                  <p className="text-slate-800 text-base font-semibold">{customer.name}</p>
                </div>
                <div>
                  <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Customer Code</h4>
                  <p className="text-slate-800 text-base font-semibold">{customer.customerCode}</p>
                </div>
                <div>
                  <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Email Address</h4>
                  <p className="text-slate-800 text-sm font-medium">{customer.email || "Not provided"}</p>
                </div>
                <div>
                  <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Phone Number</h4>
                  <p className="text-slate-800 text-sm font-medium">{customer.phone || "Not provided"}</p>
                </div>
                <div>
                  <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">City</h4>
                  <p className="text-slate-800 text-sm font-medium">{customer.city || "Not provided"}</p>
                </div>
                <div>
                  <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Lead Source</h4>
                  <select
                    value={customer.leadSource || ""}
                    onChange={(e) => handleLeadSourceChange(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-1.5 text-sm bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] rounded-xl font-medium text-slate-800 transition-all cursor-pointer"
                  >
                    <option value="">Select source...</option>
                    {LEAD_SOURCES.map((source) => (
                      <option key={source} value={source}>{source}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Pipeline Status</h4>
                  <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full border mt-1 ${
                    customer.status === "Converted" || customer.status === "Active"
                      ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                      : customer.status === "Lost"
                      ? "bg-rose-50 text-rose-600 border-rose-200"
                      : "bg-amber-50 text-amber-600 border-amber-200"
                  }`}>
                    {customer.status}
                  </span>
                </div>
                <div>
                  <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Assigned Executive</h4>
                  <p className="text-slate-800 text-sm font-medium mt-1">
                    {customer.assignedUserId ? executives.find(e => e.id === customer.assignedUserId)?.name || "Assigned" : "Unassigned"}
                  </p>
                </div>
                <div>
                  <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Next Follow Up Date</h4>
                  <p className="text-slate-850 text-sm font-bold text-orange-600 mt-1">
                    {nextFollowUpDateText}
                  </p>
                </div>
                <div>
                  <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Last Contact Date</h4>
                  <p className="text-slate-850 text-sm font-medium mt-1">
                    {lastContactDateText}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Box: Quick Call Logger Widget */}
            <div className="lg:col-span-1">
              <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-bold border-b border-slate-100 pb-3">
                  <Ico d={icons.phone} size={18} className="text-[var(--primary)]" />
                  <h4>Quick Log Call</h4>
                </div>
                <form onSubmit={handleLogCall} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Call Duration (seconds)</label>
                    <input
                      type="number"
                      placeholder="e.g. 120"
                      value={callDuration}
                      onChange={(e) => setCallDuration(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Conversation Notes</label>
                    <textarea
                      rows={3}
                      placeholder="What was discussed?"
                      value={callNotes}
                      required
                      onChange={(e) => setCallNotes(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] rounded-xl resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingCall}
                    className="w-full py-2 bg-slate-850 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    {savingCall ? "Saving..." : "Log Completed Call"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {activeTab === "timeline" && (
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-6">
            <h3 className="text-base font-bold text-slate-800">360° Activity History</h3>
            {timelineEvents.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-6 text-center">No history logs recorded yet.</p>
            ) : (
              <div className="relative border-l border-slate-200 ml-4 pl-6 space-y-8">
                {timelineEvents.map((evt, idx) => (
                  <div key={idx} className="relative">
                    {/* Circle marker */}
                    <span className={`absolute -left-10 top-0.5 w-8 h-8 rounded-full flex items-center justify-center border border-white ring-8 ring-white ${evt.colorClass}`}>
                      <Ico d={evt.icon} size={14} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-800">{evt.title}</h4>
                        <span className="text-xs text-slate-400 font-medium">{evt.date.toLocaleString()}</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-500 mt-0.5">{evt.details}</p>
                      
                      {evt.type === "call" && evt.duration && (
                        <span className="inline-block text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded mt-1">
                          Duration: {Math.floor(evt.duration / 60)}m {evt.duration % 60}s
                        </span>
                      )}

                      {evt.type === "followup" && evt.scheduledDate && (
                        <div className="mt-2 text-xs bg-slate-50 border border-slate-200/80 p-3 rounded-xl text-slate-655 space-y-1.5 max-w-xl">
                          <div><strong>Due Date / Scheduled:</strong> {evt.scheduledDate.toLocaleString()}</div>
                          <div><strong>Assignee:</strong> {evt.assignee || "Unassigned"}</div>
                          <div><strong>Source:</strong> <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-slate-105 text-slate-600">{evt.sourceType}</span></div>
                          {evt.completedAt && (
                            <div className="border-t border-slate-200/60 pt-1.5 mt-1.5 space-y-1 text-slate-500">
                              <div><strong>Completed At:</strong> {evt.completedAt.toLocaleString()}</div>
                              <div><strong>Completed By:</strong> {evt.completedBy || "Unknown"}</div>
                              {evt.completionNotes && <div><strong>Outcome Remarks:</strong> {evt.completionNotes}</div>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "deals" && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Associated Sales Deals</h3>
              {currentUser?.role !== "Customer" && (
                <button
                  onClick={openCreateDealModal}
                  className="text-xs font-bold bg-red-50 text-[#C94F4F] hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Ico d={icons.plus} size={14} />
                  Add Deal
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              {!customer.deals || customer.deals.length === 0 ? (
                <p className="text-sm text-slate-500 italic text-center py-8">No deals logged for this customer.</p>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="p-4">Deal Name</th>
                      <th className="p-4">Value</th>
                      <th className="p-4">Expected Close</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Executive</th>
                      {currentUser?.role !== "Customer" && <th className="p-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {customer.deals.map((deal: any) => (
                      <tr key={deal.id} className="hover:bg-slate-55/30 transition-colors">
                        <td className="p-4 font-bold text-slate-800">{deal.dealName}</td>
                        <td className="p-4">${deal.dealValue.toLocaleString()}</td>
                        <td className="p-4">{new Date(deal.expectedCloseDate).toLocaleDateString()}</td>
                        <td className="p-4">
                          <select
                            value={deal.status}
                            onChange={(e) => handleFastDealStatusChange(deal.id, e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 font-semibold text-slate-800 cursor-pointer"
                          >
                            {DEAL_STATUSES.map((st) => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-4">{deal.assignedUser?.name || "System"}</td>
                        {currentUser?.role !== "Customer" && (
                          <td className="p-4 text-right space-x-2">
                            <button
                              onClick={() => openEditDealModal(deal)}
                              className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                            >
                              <Ico d={icons.pencil} size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteDeal(deal.id)}
                              className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                            >
                              <Ico d={icons.trash} size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Deal Stage progression Audit Trail */}
            {customer.deals && customer.deals.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-5 pb-5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-5">Deal Stage Progression Audit Trail</h4>
                <div className="px-5 space-y-4">
                  {customer.deals.map((deal: any) => (
                    <div key={deal.id} className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                        <span className="text-xs font-bold text-slate-800">{deal.dealName}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          deal.status === "Won" ? "bg-emerald-50 text-emerald-600" :
                          deal.status === "Lost" ? "bg-red-50 text-red-600" :
                          "bg-blue-50 text-blue-600"
                        }`}>{deal.status}</span>
                      </div>
                      
                      {!deal.stageHistories || deal.stageHistories.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic">No transition history logged yet.</p>
                      ) : (
                        <div className="relative border-l-2 border-slate-200 ml-2.5 pl-4 space-y-4">
                          {deal.stageHistories.map((hist: any) => (
                            <div key={hist.id} className="relative">
                              {/* Dot */}
                              <span className="absolute -left-[22.5px] top-1 w-2.5 h-2.5 rounded-full bg-white border-2 border-[var(--primary)] flex items-center justify-center shrink-0" />
                              <div className="text-xs">
                                <p className="font-semibold text-slate-750">
                                  {hist.fromStatus ? (
                                    <>Changed from <span className="text-slate-500">{hist.fromStatus}</span> to <span className="text-slate-800 font-extrabold">{hist.toStatus}</span></>
                                  ) : (
                                    <>Initialized stage as <span className="text-slate-850 font-extrabold">{hist.toStatus}</span></>
                                  )}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  by {hist.changedBy?.name || "System"} on {new Date(hist.changedAt).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "visits" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Field Visits */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <h4 className="text-xs font-bold text-slate-800">Field Visits Log</h4>
              </div>
              <div className="p-4 divide-y divide-slate-100 space-y-4">
                {!customer.marketingVisits || customer.marketingVisits.length === 0 ? (
                  <p className="text-xs text-slate-500 italic text-center py-4">No field visits recorded.</p>
                ) : (
                  customer.marketingVisits.map((v: any) => (
                    <div key={v.id} className="pt-3 first:pt-0">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-slate-800">{new Date(v.checkIn).toLocaleString()}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">{v.status}</span>
                      </div>
                      <p className="text-xs text-slate-500">Executive: {v.executive?.name || "System"}</p>
                      {v.purpose && <p className="text-xs text-slate-600 mt-1"><strong>Purpose:</strong> {v.purpose}</p>}
                      {v.remarks && <p className="text-xs text-slate-650 bg-slate-50/70 p-2 rounded border border-slate-100 mt-1">{v.remarks}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Office Visits */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <h4 className="text-xs font-bold text-slate-800">Office Check-Ins</h4>
              </div>
              <div className="p-4 divide-y divide-slate-100 space-y-4">
                {!customer.customerVisits || customer.customerVisits.length === 0 ? (
                  <p className="text-xs text-slate-500 italic text-center py-4">No office visits recorded.</p>
                ) : (
                  customer.customerVisits.map((v: any) => (
                    <div key={v.id} className="pt-3 first:pt-0">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-slate-800">{new Date(v.checkInTime).toLocaleString()}</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 font-semibold">{v.status}</span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium">Host: {v.host?.name || "System"}</p>
                      {v.purpose && <p className="text-xs text-slate-600 mt-1"><strong>Purpose:</strong> {v.purpose}</p>}
                      {v.outcome && <p className="text-xs text-slate-600"><strong>Outcome:</strong> {v.outcome}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "followups" && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Follow-up Checklist</h3>
              <button 
                onClick={() => setShowFollowUpModal(true)}
                className="text-xs font-bold bg-red-50 text-[#C94F4F] hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Ico d={icons.plus} size={14} />
                Schedule Follow-up
              </button>
            </div>
            <div className="p-5">
              {!customer.followUps || customer.followUps.length === 0 ? (
                <p className="text-sm text-slate-500 italic text-center py-4">No follow-up tasks registered.</p>
              ) : (
                <div className="space-y-4">
                  {customer.followUps.map((f: any) => {
                    const isCompleted = f.status === "Completed";
                    const isOverdue = f.status === "Overdue";
                    
                    const priorityStyles =
                      f.priority === "High"
                        ? "bg-red-50 text-red-707 border-red-200"
                        : f.priority === "Low"
                        ? "bg-slate-50 text-slate-600 border-slate-200"
                        : "bg-blue-50 text-blue-700 border-blue-200";

                    const sourceStyles =
                      f.sourceType === "LEAD_INGESTION"
                        ? "bg-purple-50 text-purple-700 border-purple-200"
                        : f.sourceType === "VISIT_CHECKOUT"
                        ? "bg-indigo-50 text-indigo-705 border-indigo-200"
                        : "bg-amber-50 text-amber-700 border-amber-200";

                    return (
                      <div key={f.id} className={`flex gap-4 p-4 rounded-xl border bg-slate-50/30 ${isOverdue ? "border-red-200 bg-red-50/[0.05]" : "border-slate-100"}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                          isCompleted ? "bg-emerald-100 text-emerald-600" : isOverdue ? "bg-red-100 text-red-600 animate-pulse" : "bg-red-100 text-[var(--primary)]"
                        }`}>
                          <Ico d={icons.clock} size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-bold text-slate-800">
                              Due: {new Date(f.nextMeetingDate).toLocaleString()}
                            </span>
                            {f.status === "Cancelled" && <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold border bg-red-100/60 text-red-800 border-red-200 leading-none">Cancelled</span>}
                            {isCompleted && <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold border bg-emerald-50 text-emerald-700 border-emerald-200 leading-none">Completed</span>}
                            {isOverdue && <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold border bg-red-100/60 text-red-800 border-red-200 leading-none animate-pulse">Overdue</span>}
                            {f.escalationLevel > 0 && <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold border bg-red-600 text-white border-red-700 leading-none">Escalated</span>}

                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border leading-none ${priorityStyles}`}>
                              {f.priority || "Medium"}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border leading-none ${sourceStyles}`}>
                              {f.sourceType || "Manual"}
                            </span>
                          </div>
                          
                          <p className="text-xs font-semibold text-slate-505 mt-0.5">
                            Assigned to: {f.assignedUser?.name || "System"}
                            {f.autoCreated && <span className="text-purple-600 font-bold ml-1.5">• Auto-Created</span>}
                          </p>

                          {f.remarks && (
                            <p className="text-xs text-slate-600 mt-2 bg-white p-3 rounded-lg border border-slate-150 leading-relaxed font-semibold">
                              {f.remarks}
                            </p>
                          )}

                          {isCompleted && (
                            <div className="mt-2.5 p-3 rounded-xl border border-slate-200 bg-emerald-50/10">
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Completion Details:</p>
                              <p className="text-xs text-slate-600 font-semibold mt-0.5 leading-relaxed">{f.completionNotes || "No outcome notes."}</p>
                              <p className="text-[9px] text-slate-400 font-bold mt-1">
                                Completed by {f.completedBy?.name || "Unknown"} on {f.completedAt ? new Date(f.completedAt).toLocaleString() : ""}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "subscriptions" && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h4 className="text-sm font-bold text-slate-800">Subscription History</h4>
            </div>
            <div className="overflow-x-auto">
              {!customer.subscriptions || customer.subscriptions.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center py-6">No subscriptions record found.</p>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="p-4">Plan Name</th>
                      <th className="p-4">Start Date</th>
                      <th className="p-4">End Date</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {customer.subscriptions.map((sub: any) => (
                      <tr key={sub.id}>
                        <td className="p-4 font-bold text-slate-800">{sub.planName}</td>
                        <td className="p-4">{new Date(sub.startDate).toLocaleDateString()}</td>
                        <td className="p-4">{new Date(sub.endDate).toLocaleDateString()}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sub.status === "Active" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-slate-100 text-slate-500"
                          }`}>{sub.status}</span>
                        </td>
                        <td className="p-4 text-slate-500">{sub.notes || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Follow Up Modal */}
      {showFollowUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-red-50 to-slate-50 shrink-0">
              <h2 className="text-base font-bold text-slate-800">Schedule Follow-up</h2>
              <button onClick={() => setShowFollowUpModal(false)} className="w-8 h-8 rounded-xl bg-white/80 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all cursor-pointer">
                <Ico d={icons.plus} size={16} className="rotate-45" />
              </button>
            </div>
            <form onSubmit={handleAddFollowUp} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date & Time</label>
                <input 
                  type="datetime-local" 
                  required
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all" 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Priority</label>
                <select
                  value={followUpPriority}
                  onChange={(e) => setFollowUpPriority(e.target.value as any)}
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all text-slate-800 font-semibold cursor-pointer"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
              {currentUser?.role !== "SalesExecutive" && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Assign To</label>
                  <select
                    value={followUpAssigneeId}
                    onChange={(e) => setFollowUpAssigneeId(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all text-slate-800 font-semibold cursor-pointer"
                  >
                    <option value="">Default (Self)</option>
                    {executives.map((exec) => (
                      <option key={exec.id} value={exec.id}>{exec.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes (Optional)</label>
                <textarea 
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none" 
                  placeholder="What is this follow up regarding?"
                />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowFollowUpModal(false)} 
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-650 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={savingFollowUp}
                  className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors shadow-sm disabled:opacity-75 cursor-pointer"
                >
                  {savingFollowUp ? "Saving..." : "Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deal Create / Edit Modal */}
      {showDealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-red-50 to-slate-50 shrink-0">
              <h2 className="text-base font-bold text-slate-800">
                {dealModalMode === "create" ? "Add Sales Deal" : "Edit Sales Deal"}
              </h2>
              <button onClick={() => setShowDealModal(false)} className="w-8 h-8 rounded-xl bg-white/80 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all cursor-pointer">
                <Ico d={icons.plus} size={16} className="rotate-45" />
              </button>
            </div>
            <form onSubmit={handleDealSubmit} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-750 uppercase mb-1">Deal Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Q3 Software Renewal"
                  value={dealName}
                  onChange={(e) => setDealName(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)] transition-all" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-750 uppercase mb-1">Deal Value ($)</label>
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    placeholder="e.g. 5000"
                    value={dealValue}
                    onChange={(e) => setDealValue(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)] transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-750 uppercase mb-1">Expected Close</label>
                  <input 
                    type="date" 
                    required
                    value={expectedCloseDate}
                    onChange={(e) => setExpectedCloseDate(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)] transition-all" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-750 uppercase mb-1">Status</label>
                  <select
                    value={dealStatus}
                    onChange={(e) => setDealStatus(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)] transition-all cursor-pointer"
                  >
                    {DEAL_STATUSES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-750 uppercase mb-1">Assigned Executive</label>
                  <select
                    value={assignedUserId}
                    onChange={(e) => setAssignedUserId(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)] transition-all cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {executives.map((exec) => (
                      <option key={exec.id} value={exec.id}>{exec.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-750 uppercase mb-1">Deal Notes</label>
                <textarea 
                  value={dealNotes}
                  onChange={(e) => setDealNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)] transition-all resize-none" 
                  placeholder="Key details of the deal..."
                />
              </div>
              <div className="pt-2 flex justify-end gap-3 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setShowDealModal(false)} 
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-650 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={savingDeal}
                  className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors shadow-sm disabled:opacity-75 cursor-pointer"
                >
                  {savingDeal ? "Saving..." : "Save Deal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
