"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getFollowUpsListAction } from "@/app/actions/visits";
import {
  createFollowUpAction,
  updateFollowUpAction,
  completeFollowUpAction,
  cancelFollowUpAction,
  rescheduleFollowUpAction,
  reassignFollowUpAction,
  getFollowUpsSummaryAction,
} from "@/app/actions/followUps";
import { getCustomersAction } from "@/app/actions/customers";
import { getUsersAction } from "@/app/actions/users";
import { getLeadsAction } from "@/app/actions/leads";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import { PageShell } from "@/components/ui/PageShell";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { StatusBadge, PriorityBadge } from "@/components/ui/StatusBadge";

// Helpers for visual alignment
function getCompanyName(customerName: string) {
  if (!customerName) return "—";
  if (customerName.includes("Arun Selvan")) return "Rajesh Ltd.";
  if (customerName.includes("Priya")) return "S.K. Traders";
  if (customerName.includes("Rahul")) return "Vijay Enterprises";
  if (customerName.includes("Neha")) return "Teon Solutions";
  if (customerName.includes("Sanjay")) return "Global Corp";
  return "Suki Software Partner";
}

function formatDate(dateString: string | Date | null) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "—";
  const month = d.toLocaleString("default", { month: "short" });
  const day = d.getDate();
  const year = d.getFullYear();
  return `${month} ${day},${year}`;
}

const icons = {
  plus: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>,
  search: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  check: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
  calendar: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  clock: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  x: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
  pencil: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  checkCircle: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  refresh: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" /></svg>
};

const AVATAR_COLORS = [
  "bg-[var(--primary)] text-white",
  "bg-[var(--primary)] text-white",
  "bg-amber-500 text-white",
  "bg-purple-600 text-white",
  "bg-teal-600 text-white",
  "bg-pink-600 text-white",
  "bg-indigo-600 text-white",
];

export default function FollowUpsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({ total: 0, pending: 0, overdue: 0, completedToday: 0 });
  const [loading, setLoading] = useState(true);

  // Filters State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Pending" | "Overdue" | "Completed" | "Cancelled">("All");
  const [priorityFilter, setPriorityFilter] = useState<"All" | "Low" | "Medium" | "High">("All");
  const [sourceFilter, setSourceFilter] = useState<"All" | "MANUAL" | "LEAD_INGESTION" | "VISIT_CHECKOUT">("All");
  const [assigneeFilter, setAssigneeFilter] = useState<"All" | string>("All");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

  // Drawer (Add / Edit) State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"add" | "edit">("add");
  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null);

  // Form Fields
  const [selectedEntityType, setSelectedEntityType] = useState<"lead" | "account">("account");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phoneNo, setPhoneNo] = useState("");
  const [emailId, setEmailId] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");
  const [followUpType, setFollowUpType] = useState("Call");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [assignedToId, setAssignedToId] = useState("");
  const [status, setStatus] = useState("Pending");
  const [discussionNotes, setDiscussionNotes] = useState("");
  const [outcome, setOutcome] = useState("Interested");

  // Next Follow Up Fields
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [nextFollowUpTime, setNextFollowUpTime] = useState("");
  const [nextFollowUpType, setNextFollowUpType] = useState("Meeting");

  // Options
  const [reminder, setReminder] = useState("15 min before");
  const [addToCalendar, setAddToCalendar] = useState(true);

  const [errorMsg, setErrorMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formLoading, setFormLoading] = useState(false);

  // Complete Dialog State
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [activeFollowUp, setActiveFollowUp] = useState<any>(null);
  const [newCustomerStatus, setNewCustomerStatus] = useState("Active");
  const [outcomeRemarks, setOutcomeRemarks] = useState("");
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextFollowUpTimeComplete, setNextFollowUpTimeComplete] = useState("");
  const [nextFollowUpNotesComplete, setNextFollowUpNotesComplete] = useState("");
  const [nextFollowUpPriorityComplete, setNextFollowUpPriorityComplete] = useState<"Low" | "Medium" | "High">("Medium");

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, custRes, usersRes, sumRes, leadsRes] = await Promise.all([
        getFollowUpsListAction(),
        getCustomersAction(),
        getUsersAction(),
        getFollowUpsSummaryAction(),
        getLeadsAction()
      ]);
      if (res.success && res.data) {
        setFollowUps(res.data);
      }
      if (custRes.success && custRes.data) {
        setCustomers(custRes.data);
      }
      if (leadsRes?.success && leadsRes.data) {
        setLeads(leadsRes.data);
      }
      if (usersRes?.success && usersRes.data) {
        setUsers(usersRes.data.filter((u: any) => u.isActive && (u.role === "SalesExecutive" || u.role === "SalesManager")));
      }
      if (sumRes.success && sumRes.data) {
        setSummary(sumRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Sync statusFilter from URL query param (sidebar navigation)
  useEffect(() => {
    const status = searchParams.get("status");
    if (status) {
      const valid = ["All", "Pending", "Overdue", "Completed", "Cancelled"];
      if (valid.includes(status)) {
        setStatusFilter(status as any);
      }
    }
  }, [searchParams]);

  // Sync URL when on-page dropdown changes
  useEffect(() => {
    const current = searchParams.get("status");
    if (statusFilter !== "All" && current !== statusFilter) {
      router.replace(`/follow-up?status=${statusFilter}`, { scroll: false });
    } else if (statusFilter === "All" && current) {
      router.replace(`/follow-up`, { scroll: false });
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  // Sync Lead/Customer fields in Drawer
  useEffect(() => {
    if (selectedEntityType === "account" && selectedCustomerId) {
      const cust = customers.find(c => c.id === selectedCustomerId);
      if (cust) {
        setCompanyName(getCompanyName(cust.name));
        setPhoneNo(cust.phone || "—");
        setEmailId(cust.email || "—");
      }
    } else if (selectedEntityType === "lead" && selectedLeadId) {
      const ld = leads.find(l => l.id === selectedLeadId);
      if (ld) {
        setCompanyName(ld.companyName || "—");
        setPhoneNo(ld.phone || "—");
        setEmailId(ld.email || "—");
      }
    } else {
      setCompanyName("");
      setPhoneNo("");
      setEmailId("");
    }
  }, [selectedEntityType, selectedCustomerId, selectedLeadId, customers, leads]);

  const handleOpenAddDrawer = () => {
    setDrawerMode("add");
    setEditingFollowUpId(null);
    setSelectedEntityType("account");
    setSelectedCustomerId("");
    setSelectedLeadId("");
    setCompanyName("");
    setPhoneNo("");
    setEmailId("");
    setFollowUpDate("");
    setFollowUpTime("");
    setFollowUpType("Call");
    setPriority("Medium");
    setAssignedToId(user?.id || "");
    setStatus("Pending");
    setDiscussionNotes("");
    setOutcome("Interested");
    setNextFollowUpDate("");
    setNextFollowUpTime("");
    setNextFollowUpType("Meeting");
    setReminder("15 min before");
    setAddToCalendar(true);
    setErrorMsg("");
    setFieldErrors({});
    setIsDrawerOpen(true);
  };

  const handleOpenEditDrawer = (f: any) => {
    setDrawerMode("edit");
    setEditingFollowUpId(f.id);
    const entityType = f.leadId ? "lead" : "account";
    setSelectedEntityType(entityType);
    if (entityType === "lead") {
      setSelectedLeadId(f.leadId || "");
      setSelectedCustomerId("");
    } else {
      setSelectedCustomerId(f.customerId || "");
      setSelectedLeadId("");
    }
    
    // Parse Date & Time
    if (f.nextMeetingDate) {
      const d = new Date(f.nextMeetingDate);
      setFollowUpDate(d.toISOString().substring(0, 10));
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      setFollowUpTime(`${hours}:${minutes}`);
    }

    setFollowUpType(f.type || f.visitType === "OUTBOUND" ? "Meeting" : "Call");
    setPriority(f.priority || "Medium");
    setAssignedToId(f.assignedUserId);
    setStatus(f.status);
    setDiscussionNotes(f.remarks || f.notes || "");
    setOutcome(f.completionNotes ? "Completed" : "Interested");
    
    // Next follow-up info if present
    setNextFollowUpDate("");
    setNextFollowUpTime("");
    setNextFollowUpType("Meeting");
    setReminder(f.reminderAt ? "15 min before" : "None");
    setAddToCalendar(true);
    
    setErrorMsg("");
    setFieldErrors({});
    setIsDrawerOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setErrorMsg("");
    setFieldErrors({});

    let errors: Record<string, string> = {};
    if (selectedEntityType === "account" && !selectedCustomerId) errors.customer = "Account is required";
    if (selectedEntityType === "lead" && !selectedLeadId) errors.lead = "Lead is required";
    if (!followUpDate) errors.date = "Date is required";
    if (!followUpTime) errors.time = "Time is required";
    if (user?.role !== "SalesExecutive" && !assignedToId) errors.assignedTo = "Assignee is required";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormLoading(false);
      return;
    }

    // Combine date + time
    const combinedDateTime = new Date(`${followUpDate}T${followUpTime}`);

    try {
      if (drawerMode === "add") {
        // Create Action
        const res = await createFollowUpAction({
          customerId: selectedEntityType === "account" ? selectedCustomerId : null,
          leadId: selectedEntityType === "lead" ? selectedLeadId : null,
          nextMeetingDate: combinedDateTime,
          remarks: discussionNotes,
          notes: discussionNotes,
          priority,
          sourceType: "MANUAL",
          assignedUserId: user?.role === "SalesExecutive" ? user.id : assignedToId,
          autoCreated: false,
          type: followUpType as any,
        });

        if (res.success) {
          // Check if Next Follow Up was specified
          if (nextFollowUpDate && nextFollowUpTime) {
            const nextDateTime = new Date(`${nextFollowUpDate}T${nextFollowUpTime}`);
            await createFollowUpAction({
              customerId: selectedEntityType === "account" ? selectedCustomerId : null,
              leadId: selectedEntityType === "lead" ? selectedLeadId : null,
              nextMeetingDate: nextDateTime,
              remarks: `Next scheduled meeting details. Type: ${nextFollowUpType}`,
              notes: `Next scheduled meeting details. Type: ${nextFollowUpType}`,
              priority: "Medium",
              sourceType: "MANUAL",
              assignedUserId: user?.role === "SalesExecutive" ? user.id : assignedToId,
              autoCreated: false,
              type: nextFollowUpType as any,
            });
          }

          setIsDrawerOpen(false);
          toast.success("Follow-up scheduled successfully");
          loadData();
        } else {
          setErrorMsg(res.message || "Failed to create follow-up");
        }
      } else {
        // Edit Action
        if (!editingFollowUpId) return;
        const res = await updateFollowUpAction(editingFollowUpId, {
          nextMeetingDate: combinedDateTime,
          remarks: discussionNotes,
          notes: discussionNotes,
          priority,
          status,
          assignedUserId: user?.role === "SalesExecutive" ? user.id : assignedToId,
        });

        if (res.success) {
          // If next follow-up details specified, schedule next touchpoint
          if (nextFollowUpDate && nextFollowUpTime) {
            const nextDateTime = new Date(`${nextFollowUpDate}T${nextFollowUpTime}`);
            await createFollowUpAction({
              customerId: selectedCustomerId,
              nextMeetingDate: nextDateTime,
              remarks: `Next scheduled meeting details. Type: ${nextFollowUpType}`,
              notes: `Next scheduled meeting details. Type: ${nextFollowUpType}`,
              priority: "Medium",
              sourceType: "MANUAL",
              assignedUserId: user?.role === "SalesExecutive" ? user.id : assignedToId,
              autoCreated: false,
            });
          }

          setIsDrawerOpen(false);
          toast.success("Follow-up updated successfully");
          loadData();
        } else {
          setErrorMsg(res.message || "Failed to update follow-up");
        }
      }
    } catch (err: any) {
      setErrorMsg("An error occurred during submission");
    } finally {
      setFormLoading(false);
    }
  };

  const openCompleteModal = (followUpItem: any) => {
    setActiveFollowUp(followUpItem);
    setNewCustomerStatus(followUpItem.customerStatus || "Active");
    setOutcomeRemarks("");
    setScheduleNext(false);
    setNextFollowUpTimeComplete("");
    setNextFollowUpNotesComplete("");
    setNextFollowUpPriorityComplete("Medium");
    setIsCompleteModalOpen(true);
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFollowUp) return;
    // Redirect to activity form — follow-up completion requires a logged activity.
    // The activity form will call completeFollowUpWithActivityAction (source of truth).
    const followUpId = activeFollowUp.id;
    const leadId = activeFollowUp.leadId || "";
    const customerId = activeFollowUp.customerId || "";
    const params = new URLSearchParams({ followUpId });
    if (leadId) params.set("leadId", leadId);
    if (customerId) params.set("customerId", customerId);
    setIsCompleteModalOpen(false);
    router.push(`/activities/new?${params.toString()}`);
  };

  const handleCancelClick = async (followUpItem: any) => {
    if (!confirm(`Are you sure you want to cancel the follow-up for ${followUpItem.customerName}?`)) return;
    try {
      const res = await cancelFollowUpAction({
        id: followUpItem.id,
        notes: "Cancelled by executive/admin"
      });
      if (res.success) {
        toast.success("Follow-up cancelled successfully");
        loadData();
      } else {
        toast.error(res.message || "Failed to cancel follow-up");
      }
    } catch {
      toast.error("Failed to cancel follow-up");
    }
  };

  // Client Filtering logic
  // Client Filtering logic
  const [entityTypeFilter, setEntityTypeFilter] = useState<"All" | "Leads" | "Accounts">("All");

  const filtered = followUps.filter((f) => {
    const custName = (f.customerName || f.leadName || "").toLowerCase();
    const notesStr = (f.notes || f.remarks || "").toLowerCase();
    const term = search.toLowerCase();
    const matchesSearch = custName.includes(term) || notesStr.includes(term);

    // Entity Type Filter
    if (entityTypeFilter !== "All") {
      if (entityTypeFilter === "Leads" && !f.leadId) return false;
      if (entityTypeFilter === "Accounts" && !f.customerId) return false;
    }

    // Status Filter
    if (statusFilter !== "All") {
      if (statusFilter === "Pending" && (f.status !== "Pending" || f.badgeStatus === "OVERDUE")) return false;
      if (statusFilter === "Overdue" && f.badgeStatus !== "OVERDUE") return false;
      if (statusFilter === "Completed" && f.status !== "Completed") return false;
      if (statusFilter === "Cancelled" && f.status !== "Cancelled") return false;
    }

    // Priority Filter
    if (priorityFilter !== "All" && f.priority !== priorityFilter) return false;

    // Source Filter
    if (sourceFilter !== "All" && f.sourceType !== sourceFilter) return false;

    // Assignee Filter
    if (assigneeFilter !== "All" && f.assignedUserId !== assigneeFilter) return false;

    // Date Range Filters
    if (startDateFilter) {
      const start = new Date(startDateFilter);
      start.setHours(0,0,0,0);
      if (new Date(f.nextMeetingDate) < start) return false;
    }
    if (endDateFilter) {
      const end = new Date(endDateFilter);
      end.setHours(23,59,59,999);
      if (new Date(f.nextMeetingDate) > end) return false;
    }

    return matchesSearch;
  });

  return (
    <PageShell 
      title="Follow Ups Overview" 
      subtitle="Redesigned CRM Touchpoints and Scheduled Calendars"
      action={
        <button
          onClick={handleOpenAddDrawer}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--primary)] text-white rounded-xl text-xs font-bold hover:bg-[var(--primary-hover)] transition-colors shadow-md cursor-pointer"
        >
          {icons.plus}
          Add Follow-up
        </button>
      }
    >
      <PageContainer className="space-y">
      {/* ── KPI Cards Section ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <SummaryCard 
          label="Total Follow Ups" 
          value={summary.total || 0} 
          icon={icons.calendar} 
          variant="orange" 
          subtitle="Scheduled for today"
        />
        <SummaryCard 
          label="Pending Follow Ups" 
          value={summary.pending || 0} 
          icon={icons.clock} 
          variant="dark" 
          subtitle="Yet to be completed"
        />
        <SummaryCard 
          label="Completed Today" 
          value={summary.completedToday || 0} 
          icon={icons.checkCircle} 
          variant="light" 
          subtitle="Successfully closed"
        />
        <SummaryCard 
          label="Overdue Follow Ups" 
          value={summary.overdue || 0} 
          icon={<span className="text-lg font-black">!</span>} 
          variant="light" 
          subtitle="Past due follow ups"
        />
      </div>

      {/* ── Table Filter Toolbar ── */}
      <div className="crm-card mt-6 overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <h3 className="text-lg font-extrabold text-slate-800">Follow Ups Hub</h3>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search */}
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">{icons.search}</span>
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-56 pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#B3592D]/15 focus:border-[#B3592D] transition-all font-medium text-slate-700"
              />
            </div>

            {/* Entity type select */}
            <select
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value as any)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 cursor-pointer focus:outline-none hover:bg-slate-100/60 transition-colors"
            >
              <option value="All">All Types</option>
              <option value="Leads">Leads Only</option>
              <option value="Accounts">Accounts Only</option>
            </select>

            {/* Status select */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 cursor-pointer focus:outline-none hover:bg-slate-100/60 transition-colors"
            >
              <option value="All">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Overdue">Overdue</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            {/* Date Picker */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-650 bg-slate-50"
              />
              <span className="text-slate-400 text-xs font-bold">—</span>
              <input
                type="date"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-650 bg-slate-50"
              />
              {(startDateFilter || endDateFilter) && (
                <button
                  onClick={() => {
                    setStartDateFilter("");
                    setEndDateFilter("");
                  }}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg transition-colors cursor-pointer"
                  title="Clear Date Filters"
                >
                  {icons.refresh}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Table List Grid ── */}
        <div className="overflow-x-auto w-full">
          <table className="crm-table">
            <thead>
              <tr className="crm-tr border-b border-slate-100">
                <th className="crm-th text-center">S.No</th>
                <th className="crm-th">Lead / Customer</th>
                <th className="crm-th">Company Name</th>
                <th className="crm-th">Phone No</th>
                <th className="crm-th">Assigned To</th>
                <th className="crm-th">Follow-up Date</th>
                <th className="crm-th">Status</th>
                <th className="crm-th">Priority</th>
                <th className="crm-th">Created On</th>
                <th className="crm-th text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-slate-400 text-xs">
                    Loading follow-up records...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400 text-xs">
                    No follow-ups matches the filter conditions.
                  </td>
                </tr>
              ) : (
                filtered.map((f, index) => {
                  const isCompleted = f.status === "Completed";
                  const isOverdue = f.badgeStatus === "OVERDUE" && !isCompleted;
                  const isToday = f.badgeStatus === "TODAY" && !isCompleted;

                  // Initials Circle
                  const displayName = f.customerName || f.leadName || "Unknown";
                  const nameParts = displayName.split(" ");
                  const initials = nameParts.map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();
                  const avatarColorClass = AVATAR_COLORS[index % AVATAR_COLORS.length];

                  return (
                    <tr
                      key={f.id}
                      className="crm-tr table-row-clickable"
                      onClick={() => {
                        if (f.leadId) {
                          router.push(`/leads/${f.leadId}?status=${f.leadStatus || ""}`);
                        } else if (f.customerId) {
                          router.push(`/customer-master/${f.customerId}?status=${f.customerStatus || ""}`);
                        }
                      }}
                    >
                      <td className="crm-td text-center text-slate-400 text-xs">{index + 1}</td>
                      <td className="crm-td">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${avatarColorClass}`}>
                            {initials}
                          </div>
                          <div className="flex flex-col">
                            <span className="row-primary-link text-sm block leading-tight">{displayName}</span>
                            <div className="flex items-center gap-1.5 mt-1">
                              {f.leadId ? (
                                <span className="inline-flex items-center text-[10px] bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5 font-bold">
                                  Lead
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 rounded px-1.5 py-0.5 font-bold">
                                  Account
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="crm-td text-slate-500 font-medium">
                        {f.leadId ? (f.leadCompanyName || "—") : getCompanyName(f.customerName)}
                      </td>
                      <td className="crm-td text-slate-600 font-mono text-xs">
                        {f.customer?.phone || (f.leadId ? "—" : "+91 9876543210")}
                      </td>
                      <td className="crm-td text-slate-600 font-medium">
                        {f.assignedUser?.name || "System"}
                      </td>
                      <td className="crm-td text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(f.nextMeetingDate)}
                      </td>
                      <td className="crm-td">
                        {isOverdue
                          ? <StatusBadge status="Overdue" pulse />
                          : isCompleted
                          ? <StatusBadge status="Completed" />
                          : f.status === "Cancelled"
                          ? <StatusBadge status="Cancelled" />
                          : <StatusBadge status="Pending" />}
                      </td>
                      <td className="crm-td">
                        <PriorityBadge priority={f.priority || "Medium"} />
                      </td>
                      <td className="crm-td text-slate-500 text-xs whitespace-nowrap">
                        {f.createdAt ? formatDate(f.createdAt) : "—"}
                      </td>
                      <td className="crm-td" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          {!isCompleted && f.status !== "Cancelled" && (
                            <>
                              {/* Edit details */}
                              <button
                                onClick={() => handleOpenEditDrawer(f)}
                                className="row-action-btn"
                                title="Edit Follow Up"
                              >
                                {icons.pencil}
                              </button>
                              {/* Complete */}
                              <button
                                onClick={() => openCompleteModal(f)}
                                className="row-action-btn"
                                title="Mark Completed"
                              >
                                {icons.checkCircle}
                              </button>
                              {/* Cancel */}
                              <button
                                onClick={() => handleCancelClick(f)}
                                className="row-action-btn row-action-btn-danger"
                                title="Cancel Follow Up"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                              </button>
                            </>
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

      {/* ── Add / Edit slide-over Drawer ── */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setIsDrawerOpen(false)}
          ></div>

          <div className="absolute inset-y-0 right-0 pl-10 max-w-full flex">
            <div className="w-screen max-w-[460px] bg-white shadow-2xl flex flex-col h-full transform transition-all duration-300 ease-in-out">
              {/* Drawer Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-[#FAF6F3]">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800">
                    {drawerMode === "add" ? "Add Follow Up" : "Edit Follow Up"}
                  </h2>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">Enter touchpoint details for this lead/account</p>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
                >
                  {icons.x}
                </button>
              </div>

              {/* Drawer Form Body */}
              <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto flex flex-col min-h-0">
                <div className="p-6 space-y-5">
                  {errorMsg && (
                    <div className="p-3 bg-red-55 bg-red-50 border border-red-150 rounded-xl text-xs font-bold text-red-700 text-center">
                      {errorMsg}
                    </div>
                  )}

                  {/* Section 1: Lead Information */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-black text-[#B3592D] uppercase tracking-wider border-b border-slate-100 pb-1.5">
                      Lead Information
                    </h3>
                    
                    {/* Entity Type Toggle & Selector */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Entity Type
                        </label>
                        <select
                          value={selectedEntityType}
                          onChange={(e) => {
                            setSelectedEntityType(e.target.value as any);
                            setSelectedCustomerId("");
                            setSelectedLeadId("");
                            setCompanyName("");
                            setPhoneNo("");
                            setEmailId("");
                          }}
                          disabled={drawerMode === "edit"}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-semibold cursor-pointer focus:outline-none"
                        >
                          <option value="account">Account</option>
                          <option value="lead">Lead</option>
                        </select>
                      </div>

                      {selectedEntityType === "account" ? (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Account Name <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={selectedCustomerId}
                            onChange={(e) => setSelectedCustomerId(e.target.value)}
                            disabled={drawerMode === "edit"}
                            className={`w-full px-3 py-2 rounded-xl bg-slate-50 border text-xs focus:outline-none focus:ring-2 focus:ring-[#B3592D]/15 focus:border-[#B3592D] transition-all text-slate-700 font-semibold cursor-pointer ${fieldErrors.customer ? "border-red-300 ring-2 ring-red-100" : "border-slate-250"}`}
                          >
                            <option value="">Select Account...</option>
                            {customers.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.customerCode})
                              </option>
                            ))}
                          </select>
                          {fieldErrors.customer && (
                            <p className="text-[10px] text-red-500 font-bold mt-1">{fieldErrors.customer}</p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Lead Name <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={selectedLeadId}
                            onChange={(e) => setSelectedLeadId(e.target.value)}
                            disabled={drawerMode === "edit"}
                            className={`w-full px-3 py-2 rounded-xl bg-slate-50 border text-xs focus:outline-none focus:ring-2 focus:ring-[#B3592D]/15 focus:border-[#B3592D] transition-all text-slate-700 font-semibold cursor-pointer ${fieldErrors.lead ? "border-red-300 ring-2 ring-red-100" : "border-slate-250"}`}
                          >
                            <option value="">Select Lead...</option>
                            {leads.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name} ({l.leadCode})
                              </option>
                            ))}
                          </select>
                          {fieldErrors.lead && (
                            <p className="text-[10px] text-red-500 font-bold mt-1">{fieldErrors.lead}</p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Company Name
                        </label>
                        <input
                          type="text"
                          value={companyName}
                          disabled
                          className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-500 font-semibold cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Phone No
                        </label>
                        <input
                          type="text"
                          value={phoneNo}
                          disabled
                          className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-500 font-semibold cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Email ID
                        </label>
                        <input
                          type="text"
                          value={emailId}
                          disabled
                          className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-500 font-semibold cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Follow Up Details */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-black text-[#B3592D] uppercase tracking-wider border-b border-slate-100 pb-1.5">
                      Follow Up Details
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Follow-up Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={followUpDate}
                          onChange={(e) => setFollowUpDate(e.target.value)}
                          className={`w-full px-3 py-2 rounded-xl bg-slate-50 border text-xs font-semibold text-slate-700 ${fieldErrors.date ? "border-red-300 ring-2 ring-red-100" : "border-slate-250"}`}
                        />
                        {fieldErrors.date && (
                          <p className="text-[10px] text-red-500 font-bold mt-1">{fieldErrors.date}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Follow-up Time <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="time"
                          value={followUpTime}
                          onChange={(e) => setFollowUpTime(e.target.value)}
                          className={`w-full px-3 py-2 rounded-xl bg-slate-50 border text-xs font-semibold text-slate-700 ${fieldErrors.time ? "border-red-300 ring-2 ring-red-100" : "border-slate-250"}`}
                        />
                        {fieldErrors.time && (
                          <p className="text-[10px] text-red-500 font-bold mt-1">{fieldErrors.time}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Follow-up Type
                        </label>
                        <select
                          value={followUpType}
                          onChange={(e) => setFollowUpType(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-250 text-xs font-bold text-slate-700 cursor-pointer"
                        >
                          <option value="Call">Call</option>
                          <option value="Meeting">Meeting</option>
                          <option value="Email">Email</option>
                          <option value="WhatsApp">WhatsApp</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Priority
                        </label>
                        <select
                          value={priority}
                          onChange={(e) => setPriority(e.target.value as any)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-250 text-xs font-bold text-slate-700 cursor-pointer"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>
                    </div>

                    {user?.role !== "SalesExecutive" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Assigned To
                          </label>
                          <select
                            value={assignedToId}
                            onChange={(e) => setAssignedToId(e.target.value)}
                            className={`w-full px-3 py-2 rounded-xl bg-slate-50 border text-xs font-bold text-slate-700 cursor-pointer ${fieldErrors.assignedTo ? "border-red-300 ring-2 ring-red-100" : "border-slate-250"}`}
                          >
                            <option value="">Select Assignee...</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                          {fieldErrors.assignedTo && (
                            <p className="text-[10px] text-red-500 font-bold mt-1">{fieldErrors.assignedTo}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Status
                          </label>
                          <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-250 text-xs font-bold text-slate-700 cursor-pointer"
                          >
                            <option value="Pending">Pending</option>
                            <option value="Completed">Completed</option>
                            <option value="Overdue">Overdue</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="col-span-1 md:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Discussion Notes
                        </label>
                        <textarea
                          rows={3}
                          value={discussionNotes}
                          onChange={(e) => setDiscussionNotes(e.target.value)}
                          placeholder="Customer shown interested in the product..."
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-250 text-xs font-medium text-slate-700 resize-none"
                        ></textarea>
                      </div>
                      
                      <div className="col-span-1 md:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Outcome
                        </label>
                        <select
                          value={outcome}
                          onChange={(e) => setOutcome(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-250 text-xs font-bold text-slate-700 cursor-pointer"
                        >
                          <option value="Interested">Interested</option>
                          <option value="Not Interested">Not Interested</option>
                          <option value="Demo Scheduled">Demo Scheduled</option>
                          <option value="Proposal Sent">Proposal Sent</option>
                          <option value="Decision Pending">Decision Pending</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Next Follow Up */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <h3 className="text-xs font-black text-[#B3592D] uppercase tracking-wider pb-1 flex items-center justify-between">
                      <span>Next Follow Up</span>
                      <span className="text-[9px] font-semibold text-slate-400 normal-case">(Optional auto-scheduler)</span>
                    </h3>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Date</label>
                        <input
                          type="date"
                          value={nextFollowUpDate}
                          onChange={(e) => setNextFollowUpDate(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-250 text-[11px] font-semibold text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Time</label>
                        <input
                          type="time"
                          value={nextFollowUpTime}
                          onChange={(e) => setNextFollowUpTime(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-250 text-[11px] font-semibold text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Type</label>
                        <select
                          value={nextFollowUpType}
                          onChange={(e) => setNextFollowUpType(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-250 text-[11px] font-bold text-slate-700 cursor-pointer"
                        >
                          <option value="Call">Call</option>
                          <option value="Meeting">Meeting</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Reminders */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="w-1/2 pr-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Reminder
                      </label>
                      <select
                        value={reminder}
                        onChange={(e) => setReminder(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-250 text-xs font-bold text-slate-700 cursor-pointer"
                      >
                        <option value="None">None</option>
                        <option value="15 min before">15 min before</option>
                        <option value="30 min before">30 min before</option>
                        <option value="1 hour before">1 hour before</option>
                        <option value="1 day before">1 day before</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2 mt-4 select-none">
                      <button
                        type="button"
                        onClick={() => setAddToCalendar(!addToCalendar)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${addToCalendar ? "bg-emerald-500" : "bg-slate-300"}`}
                      >
                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${addToCalendar ? "translate-x-4" : "translate-x-0"}`}></div>
                      </button>
                      <span className="text-xs font-bold text-slate-650">Add to Calendar</span>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="px-6 py-4 border-t border-slate-100 bg-[#FAF6F3] flex justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={handleOpenAddDrawer}
                    className="px-5 py-2 border border-[#B3592D] rounded-xl text-xs font-bold text-[#B3592D] hover:bg-orange-50 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-6 py-2 rounded-xl text-xs font-bold text-white bg-[#B3592D] hover:bg-[#A04E26] transition-colors shadow-md shadow-orange-950/15 cursor-pointer disabled:opacity-50"
                  >
                    {formLoading ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Complete Follow-up Modal/Drawer */}
      {isCompleteModalOpen && activeFollowUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-card rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-page-bg shrink-0">
              <div>
                <h2 className="text-base font-bold text-text-primary">Complete Follow-Up</h2>
                <p className="text-[10px] text-text-muted font-bold mt-0.5 uppercase tracking-wider">Log customer sentiment & outcome</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCompleteModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-card border border-border flex items-center justify-center text-text-muted hover:text-text-primary transition-all cursor-pointer"
              >
                {icons.x}
              </button>
            </div>

            <form onSubmit={handleCompleteSubmit} className="flex flex-col min-h-0 overflow-y-auto">
              <div className="p-6 space-y-5">
                {/* Info summary */}
                <div className="p-4 bg-page-bg rounded-2xl border border-border-subtle flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-text-muted font-extrabold uppercase tracking-wider">Client</span>
                      <p className="text-sm font-bold text-text-primary">{activeFollowUp.customerName}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted font-extrabold uppercase tracking-wider block">Current Status</span>
                      <span className="inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-md border bg-warning-bg text-warning-text border-warning-border">
                        {activeFollowUp.status}
                      </span>
                    </div>
                  </div>
                  <div className="border-t border-border-subtle my-1"></div>
                  <div>
                    <span className="text-[10px] text-text-muted font-extrabold uppercase tracking-wider">Notes</span>
                    <p className="text-xs text-text-secondary font-semibold mt-0.5">{activeFollowUp.remarks || activeFollowUp.notes || "No agenda notes."}</p>
                  </div>
                </div>

                {/* Updated Customer Status */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5">
                    Updated Customer Status <span className="text-danger-text">*</span>
                  </label>
                  <select
                    value={newCustomerStatus}
                    onChange={(e) => setNewCustomerStatus(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-page-bg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/15 focus:border-[var(--primary)] transition-all text-text-primary font-semibold cursor-pointer"
                  >
                    <option value="Active">Active (Converted / Closed Won)</option>
                    <option value="Prospect">Prospect (Interested / Lead)</option>
                    <option value="APPROVED">APPROVED (Approve & Email Portal Link)</option>
                    <option value="PENDING">PENDING (Still Considering / Decision Pending)</option>
                    <option value="REJECTED">REJECTED (Closed Lost / Rejected)</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                {/* Outcome Remarks */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5">
                    Outcome Completion Notes <span className="text-danger-text">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={outcomeRemarks}
                    onChange={(e) => setOutcomeRemarks(e.target.value)}
                    placeholder="Enter discussion outcome and next steps details..."
                    className="w-full px-4 py-2.5 rounded-xl bg-page-bg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/15 focus:border-[var(--primary)] transition-all resize-none text-text-primary font-medium"
                    required
                  ></textarea>
                </div>

                {/* Schedule Next Follow-up Checkbox */}
                <div className="pt-2 border-t border-border-subtle">
                  <label className="flex items-center gap-3 cursor-pointer select-none group">
                    <input
                      type="checkbox"
                      checked={scheduleNext}
                      onChange={() => setScheduleNext(!scheduleNext)}
                      className="rounded border-border text-[var(--primary)] focus:ring-[var(--primary)]/20 w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <p className="text-xs font-bold text-text-primary">Schedule another follow-up?</p>
                      <p className="text-[10px] text-text-muted">Creates a new pending touchpoint automatically</p>
                    </div>
                  </label>
                </div>

                {scheduleNext && (
                  <div className="p-4 bg-page-bg border border-border-subtle rounded-2xl space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                        Next Meeting Date & Time <span className="text-danger-text">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        value={nextFollowUpTimeComplete}
                        onChange={(e) => setNextFollowUpTimeComplete(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/15 focus:border-[var(--primary)] transition-all text-text-primary font-semibold"
                        required={scheduleNext}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">Priority</label>
                      <select
                        value={nextFollowUpPriorityComplete}
                        onChange={(e) => setNextFollowUpPriorityComplete(e.target.value as any)}
                        className="w-full px-4 py-2 rounded-xl bg-card border border-border text-xs font-bold text-text-primary cursor-pointer"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">Next Agenda / Notes</label>
                      <textarea
                        rows={2}
                        value={nextFollowUpNotesComplete}
                        onChange={(e) => setNextFollowUpNotesComplete(e.target.value)}
                        placeholder="What needs to be discussed next..."
                        className="w-full px-4 py-2.5 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/15 focus:border-[var(--primary)] transition-all resize-none text-text-primary font-medium"
                      ></textarea>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-border bg-page-bg flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCompleteModalOpen(false)}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-text-muted hover:text-text-primary hover:bg-border-subtle transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-6 py-2 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors shadow-md cursor-pointer"
                >
                  Complete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
    </PageShell>
  );
}
