"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSyncUrlParam } from "@/lib/use-sync-url-param";
import { getCustomerByIdAction, updateCustomerAction } from "@/app/actions/customers";
import { createFollowUpAction } from "@/app/actions/followUps";
import { createCallAction } from "@/app/actions/activities";
import { createDealAction, updateDealAction, updateDealStatusAction, deleteDealAction } from "@/app/actions/deals";
import { getUsersAction } from "@/app/actions/users";
import { useAuth } from "@/components/AuthProvider";
import EntityDocumentTab from "@/components/documents/EntityDocumentTab";
import { useToast } from "@/components/ToastProvider";
import { FieldGrid } from "@/components/shared/FieldGrid";
import { CompactUserAvatar } from "@/components/shared/UserAvatar";
import { StatusPill } from "@/components/shared/StatusPill";

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
  "Prospect",
  "ActiveCustomer",
  "Renewed",
  "Churned",
  "Inactive"
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
  useSyncUrlParam(customer?.status, "status");
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
      loadCustomer();
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
      loadCustomer();
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 py-1">
        <button
          onClick={() => router.push("/customer-master")}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[var(--primary)] font-medium transition-colors shrink-0"
        >
          <Ico d={icons.back} size={15} /> Back to Accounts
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {currentUser?.role !== "Customer" && (
            <button
              onClick={openCreateDealModal}
              className="h-8 px-3 text-xs font-semibold rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Ico d={icons.plus} size={13} /> New Opportunity
            </button>
          )}
        </div>
      </div>

      {/* Account Summary Card */}
      <div className="crm-card p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-black shrink-0 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600">
            {(customer.name || "A").charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">{customer.name}</h1>
              <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded">{customer.customerCode}</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                customer.status === "Active" || customer.status === "ActiveCustomer"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : customer.status === "Prospect"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : customer.status === "Lost" || customer.status === "Churned"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : "bg-slate-100 text-slate-700 border-slate-200"
              }`}>
                {customer.status}
              </span>
              {customer.isKeyAccountV2 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border-amber-200">
                  <span>⭐</span> Key Account
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-6 gap-y-2 mt-3 text-sm text-slate-600">
              <div>
                <span className="text-slate-400 text-xs">Email:</span>
                <span className="font-medium truncate">{customer.email || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs">Phone:</span>
                <span className="font-medium">{customer.phone || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs">City:</span>
                <span className="font-medium">{customer.city || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs">Type:</span>
                <span className="font-medium">{customer.accountType || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs">Industry:</span>
                <span className="font-medium">{customer.industryType || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs">GSTIN:</span>
                <span className="font-mono text-xs">{customer.gstNumber || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs">Assigned:</span>
                <span className="font-medium">{customer.assignedUser?.name || "Unassigned"}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs">Created:</span>
                <span className="font-medium">{new Date(customer.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="flex border-b border-slate-200 gap-6 overflow-x-auto pb-px">
        {[
          { id: "overview", label: "Overview" },
          { id: "contacts", label: `Contacts (${customer.contacts?.length || 0})` },
          { id: "opportunities", label: `Opportunities (${customer.deals?.filter((d: any) => d.status !== "Won" && d.status !== "Lost").length || 0})` },
          { id: "quotations", label: `Quotations (${customer.quotations?.length || 0})` },
          { id: "rfqs", label: `RFQs (${customer.rfqs?.length || 0})` },
          { id: "visits", label: `Visits (${(customer.customerVisits?.length || 0)})` },
          { id: "documents", label: "Documents" },
          { id: "timeline", label: "Activity Timeline" },
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

      {/* Tab Content */}
      <div className="flex-1 min-w-0">
        {activeTab === "overview" && (
          <div className="space-y-5">
            {/* Account Details */}
            <div className="crm-card p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-4">Account Information</h3>
              <FieldGrid
                fields={[
                  { label: "Account Name", value: customer.name, truncate: true },
                  { label: "Account Code", value: customer.customerCode },
                  { label: "Status", value: <StatusPill status={customer.status} /> },
                  { label: "Email", value: customer.email || "-", truncate: true },
                  { label: "Phone", value: customer.phone || "-" },
                  { label: "City", value: customer.city || "-" },
                  { label: "Account Type", value: customer.accountType || "-" },
                  { label: "Industry", value: customer.industryType || "-" },
                  { label: "GSTIN", value: customer.gstNumber || "-" },
                  { label: "Lead Source", value: customer.leadSource || "-" },
                  { label: "Assigned Executive", value: customer.assignedUserId ? (
                    <CompactUserAvatar 
                      name={executives.find(e => e.id === customer.assignedUserId)?.name || "Assigned"} 
                      role="Executive"
                    />
                  ) : "Unassigned" },
                  { label: "Next Follow Up", value: nextFollowUpDateText },
                ]}
              />
            </div>

            {/* Addresses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="crm-card p-5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Billing Address</h4>
                <p className="text-sm text-slate-600">{customer.billingAddress || "Not provided"}</p>
              </div>
              <div className="crm-card p-5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Shipping Address</h4>
                <p className="text-sm text-slate-600">{customer.shippingAddress || "Not provided"}</p>
              </div>
            </div>

            {/* Quick Log Call */}
            <div className="crm-card p-5">
              <div className="flex items-center gap-2 text-slate-700 font-bold border-b border-slate-100 pb-3 mb-4">
                <Ico d={icons.phone} size={16} className="text-[var(--primary)]" />
                <h4 className="text-sm">Quick Log Call</h4>
              </div>
              <form onSubmit={handleLogCall} className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Call Duration (seconds)</label>
                  <input
                    type="number"
                    placeholder="e.g. 120"
                    value={callDuration}
                    onChange={(e) => setCallDuration(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] rounded-lg"
                  />
                </div>
                <div className="flex-[2]">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Conversation Notes</label>
                  <input
                    type="text"
                    placeholder="What was discussed?"
                    value={callNotes}
                    required
                    onChange={(e) => setCallNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingCall}
                  className="h-9 px-4 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {savingCall ? "Saving..." : "Log Call"}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === "contacts" && (
          <div className="crm-card p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-4">Contacts ({customer.contacts?.length || 0})</h3>
            {customer.contacts && customer.contacts.length > 0 ? (
              <div className="space-y-3">
                {customer.contacts.map((contact: any) => (
                  <div key={contact.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{contact.name}</p>
                      <p className="text-xs text-slate-500">{contact.email || contact.phone || "No contact info"}</p>
                    </div>
                    {contact.isPrimary && (
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Primary</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">No contacts added yet.</p>
            )}
          </div>
        )}

        {activeTab === "opportunities" && (
          <div className="crm-card p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-4">Opportunities ({customer.deals?.filter((d: any) => d.status !== "Won" && d.status !== "Lost").length || 0})</h3>
            {customer.deals && customer.deals.filter((d: any) => d.status !== "Won" && d.status !== "Lost").length > 0 ? (
              <div className="space-y-3">
                {customer.deals.filter((d: any) => d.status !== "Won" && d.status !== "Lost").map((deal: any) => (
                  <div key={deal.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{deal.dealName}</p>
                      <p className="text-xs text-slate-500">${deal.dealValue?.toLocaleString()} • {new Date(deal.expectedCloseDate).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={deal.status}
                        onChange={(e) => handleFastDealStatusChange(deal.id, e.target.value)}
                        className="text-[10px] font-bold px-2 py-0.5 rounded border bg-white cursor-pointer"
                      >
                        {DEAL_STATUSES.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => openEditDealModal(deal)}
                        className="text-[10px] font-bold text-slate-600 hover:text-[var(--primary)] px-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteDeal(deal.id)}
                        className="text-[10px] font-bold text-red-600 hover:text-red-700 px-2"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">No active opportunities.</p>
            )}
          </div>
        )}

        {activeTab === "documents" && (
          <div className="crm-card p-5">
            <EntityDocumentTab entityType="Customer" entityId={customer.id} />
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
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Deal Modal */}
      {showDealModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              {dealModalMode === "create" ? "Create Opportunity" : "Edit Opportunity"}
            </h3>
            <form onSubmit={handleDealSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Deal Name *</label>
                <input
                  type="text"
                  value={dealName}
                  onChange={(e) => setDealName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Deal Value ($) *</label>
                <input
                  type="number"
                  value={dealValue}
                  onChange={(e) => setDealValue(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Expected Close Date *</label>
                <input
                  type="date"
                  value={expectedCloseDate}
                  onChange={(e) => setExpectedCloseDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                <select
                  value={dealStatus}
                  onChange={(e) => setDealStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] rounded-lg"
                >
                  {DEAL_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                <textarea
                  value={dealNotes}
                  onChange={(e) => setDealNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] rounded-lg"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDealModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDeal}
                  className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-lg transition-colors disabled:opacity-50"
                >
                  {savingDeal ? "Saving..." : dealModalMode === "create" ? "Create" : "Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
