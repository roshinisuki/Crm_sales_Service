"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getLeadsAction, createLeadAction, updateLeadAction, deleteLeadAction } from "@/app/actions/leads";
import { getLeadSourcesAction } from "@/app/actions/leadSources";
import { getUsersAction } from "@/app/actions/users";
import { Lead, User } from "@/types";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Select, Textarea } from "@/components/ui/FormField";
import { Pagination, usePagination } from "@/components/ui/Pagination";
import LeadCreatedWorkflowModal from "@/components/leads/LeadCreatedWorkflowModal";
import { CRMSpinner } from "@/components/CRMSpinner";
import { getInitials, getAvatarColor, formatDate, cn } from "@/lib/ui-utils";
import { INDUSTRY_TYPES } from "@/lib/industryOptions";
import { StatusPill } from "@/components/shared/StatusPill";
import { computeWorkflowState, getLeadWorkflowActions } from "@/lib/workflow-actions";
import {
  Plus, Search, Download, Pencil, Trash2,
  Users, Phone, CheckCircle, XCircle, PhoneCall, CalendarClock,
  TrendingUp, AlertTriangle, Copy, Upload, Zap, ChevronRight,
} from "lucide-react";
import { useGlobalLoading } from "@/components/GlobalLoadingProvider";
import LeadImportModal from "@/components/leads/LeadImportModal";

const LEAD_STATUSES = ["New", "Contacted", "FollowUpDue", "SQL", "Qualified", "Converted", "Lost", "Overdue", "Duplicate"];
const LEAD_SOURCES  = ["Website", "Facebook", "Instagram", "LinkedIn", "Referral", "WalkIn", "ColdCall", "Partner", "Trade Show", "Tender Portal"];
const V2_TABS = [
  { key: "", label: "Leads Overview" },
  { key: "New", label: "New" },
  { key: "TodayFollowUp", label: "Follow-Up Due" },
  { key: "TodaysFollowUp", label: "Today's Follow-up" },
  { key: "UpcomingFollowUp", label: "Upcoming Follow-ups" },
  { key: "SQL", label: "SQL" },
  { key: "Overdue", label: "Overdue" },
  { key: "Unassigned", label: "Unassigned" },
  { key: "Lost", label: "Lost" },
  { key: "Duplicate", label: "Duplicate" },
] as const;

function isSlaBreached(l: Lead, now: Date) {
  if (l.slaStatus === "Breached") return true;
  if (l.slaStatus === "Pending" && l.slaResponseDeadline) {
    return new Date(l.slaResponseDeadline).getTime() <= now.getTime();
  }
  return false;
}

const COUNTRY_CODES = [
  { code: "+91", label: "+91 🇮🇳 India" },
  { code: "+1",  label: "+1 🇺🇸 USA" },
  { code: "+44", label: "+44 🇬🇧 UK" },
  { code: "+971", label: "+971 🇦🇪 UAE" },
  { code: "+966", label: "+966 🇸🇦 Saudi Arabia" },
  { code: "+65", label: "+65 🇸🇬 Singapore" },
  { code: "+60", label: "+60 🇲🇾 Malaysia" },
  { code: "+27", label: "+27 🇿🇦 South Africa" },
  { code: "+234", label: "+234 🇳🇬 Nigeria" },
  { code: "+20", label: "+20 🇪🇬 Egypt" },
  { code: "+880", label: "+880 🇧🇩 Bangladesh" },
  { code: "+94", label: "+94 🇱🇰 Sri Lanka" },
  { code: "+977", label: "+977 🇳🇵 Nepal" },
  { code: "+92", label: "+92 🇵🇰 Pakistan" },
  { code: "+968", label: "+968 🇴🇲 Oman" },
  { code: "+974", label: "+974 🇶🇦 Qatar" },
  { code: "+965", label: "+965 🇰🇼 Kuwait" },
  { code: "+973", label: "+973 🇧🇭 Bahrain" },
  { code: "+62", label: "+62 🇮🇩 Indonesia" },
  { code: "+66", label: "+66 🇹🇭 Thailand" },
  { code: "+49", label: "+49 🇩🇪 Germany" },
  { code: "+33", label: "+33 🇫🇷 France" },
  { code: "+81", label: "+81 🇯🇵 Japan" },
  { code: "+86", label: "+86 🇨🇳 China" },
  { code: "+61", label: "+61 🇦🇺 Australia" },
];

const emptyForm = {
  id: "", leadCode: "", name: "", email: "",
  phone: "", phoneCountryCode: "+91", city: "", status: "New" as any,
  assignedUserId: "", leadSource: "", notes: "",
  // V2 fields
  companyName: "", designation: "", industryType: "", estimatedValue: "",
};

export default function LeadsPage() {
  const { user } = useAuth();
  const router   = useRouter();
  const toast    = useToast();
  const { startLoading, stopLoading } = useGlobalLoading();
  const searchParams = useSearchParams();

  const [leads,      setLeads]      = useState<Lead[]>([]);
  const [executives, setExecutives] = useState<User[]>([]);
  const [dbLeadSources, setDbLeadSources] = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);

  const [search,         setSearch]         = useState("");
  const [statusFilter,   setStatusFilter]   = useState("");
  const [fuStatusFilter, setFuStatusFilter] = useState("");
  const [dateFrom,       setDateFrom]       = useState("");
  const [dateTo,         setDateTo]         = useState("");
  const [activeTab,      setActiveTab]      = useState<string>("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData,    setFormData]    = useState(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [formError,   setFormError]   = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({
    isOpen: false, title: "", message: "", action: () => {},
  });

  // Workflow modal — fires after new lead is created (Plan Visit → Log Activity)
  const [workflowModal, setWorkflowModal] = useState<{ open: boolean; leadId: string; leadCode: string; leadName: string }>({
    open: false, leadId: "", leadCode: "", leadName: "",
  });

  const [isImportOpen, setIsImportOpen] = useState(false);

  // Unified handler for both "Log First Call" (post lead creation) and
  // "Mark Contacted" (lead details). Both UI entry points navigate to the
  // lead detail page with ?action=contact, which auto-opens the Call Log
  // modal. The lead status is NOT updated until the user fills call details
  // and saves (see contactLeadAction in the details page).
  const handleLeadContact = (leadId: string) => {
    if (!leadId) return;
    router.push(`/leads/${leadId}?action=contact`);
  };

  const statusParam  = searchParams ? searchParams.get("status") : null;
  const followUpParam = searchParams ? searchParams.get("followUp") : null;
  const queryString = searchParams ? searchParams.toString() : "";

  // Sync activeTab with URL status param (from sidebar links)
  useEffect(() => {
    if (statusParam === "TodayFollowUp") {
      setActiveTab("TodayFollowUp");
      setStatusFilter("");
    } else if (statusParam === "TodaysFollowUp") {
      setActiveTab("TodaysFollowUp");
      setStatusFilter("");
    } else if (statusParam === "UpcomingFollowUp") {
      setActiveTab("UpcomingFollowUp");
      setStatusFilter("");
    } else if (statusParam === "unassigned") {
      setActiveTab("Unassigned");
      setStatusFilter("");
    } else if (statusParam) {
      setActiveTab(statusParam);
      setStatusFilter(statusParam);
    } else if (followUpParam === "due") {
      setActiveTab("TodayFollowUp");
      setStatusFilter("");
    } else {
      setActiveTab("");
      setStatusFilter("");
    }
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  // ── Load data ─────────────────────────────────────────────────────────────

  const loadLeads = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      if (statusFilter && statusFilter !== "Overdue") params.status = statusFilter;
      const res = await getLeadsAction(params);
      if (res.success && res.data) setLeads(res.data as any);
    } finally {
      setLoading(false);
    }
  };

  const loadExecutives = async () => {
    if (!user || (user.role !== "Admin" && user.role !== "SalesManager")) return;
    const res = await getUsersAction();
    if (res.success && res.data) {
      setExecutives((res.data as any[]).filter(u => u.role === "SalesExecutive"));
    }
  };

  const loadLeadSources = async () => {
    const res = await getLeadSourcesAction(true);
    if (res.success && res.data) {
      setDbLeadSources(res.data);
    }
  };

  useEffect(() => { loadLeads(); }, [search, statusFilter]);
  useEffect(() => { loadExecutives(); loadLeadSources(); }, [user]);



  // ── Filtered data ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return leads.filter(l => {
      // V2 Tab filter
      if (activeTab === "TodayFollowUp" || activeTab === "TodaysFollowUp") {
        // Follow-Up Due / Today's Follow-up: leads with a pending follow-up scheduled for today,
        // excluding terminal statuses (Converted/Lost) and only counting Lead-stage follow-ups
        if (l.status === "Lost" || l.status === "Converted") return false;
        const hasTodayFU = (l as any).followUps?.some((f: any) =>
          f.status === "Pending" && f.stageAtCreation === "Lead" &&
          new Date(f.nextMeetingDate) >= startOfToday &&
          new Date(f.nextMeetingDate) < new Date(startOfToday.getTime() + 86400000)
        );
        if (!hasTodayFU) return false;
      } else if (activeTab === "UpcomingFollowUp") {
        if (l.status === "Lost" || l.status === "Converted") return false;
        const hasUpcomingFU = (l as any).followUps?.some((f: any) =>
          (f.status === "Pending" || f.status === "Scheduled") && f.stageAtCreation === "Lead" &&
          new Date(f.nextMeetingDate) >= startOfToday
        );
        if (!hasUpcomingFU) return false;
      } else if (activeTab === "Overdue") {
        // Overdue is a computed filter — not a stored status value.
        // A lead is overdue if it has a pending follow-up with a date in the past
        // OR its first-response SLA has breached, and it is not in a terminal status.
        if (l.status === "Lost" || l.status === "Converted" || l.status === "Duplicate") return false;
        const hasOverdueFU = (l as any).followUps?.some((f: any) =>
          f.status === "Pending" && f.stageAtCreation === "Lead" && new Date(f.nextMeetingDate) <= now
        );
        if (!hasOverdueFU && !isSlaBreached(l, now)) return false;
      } else if (activeTab === "Duplicate") {
        if (l.status !== "Duplicate") return false;
      } else if (activeTab === "Unassigned") {
        if (l.status === "Lost" || l.status === "Converted" || l.status === "Duplicate") return false;
        if (l.assignedUserId) return false;
      } else if (activeTab && activeTab !== "") {
        if (l.status !== activeTab) return false;
      }



      if (dateFrom && l.createdAt && new Date(l.createdAt) < new Date(dateFrom)) return false;
      if (dateTo   && l.createdAt && new Date(l.createdAt) > new Date(dateTo + "T23:59:59")) return false;

      if (followUpParam === "due") {
        // Terminal statuses have no follow-up queue
        if (l.status === "Lost" || l.status === "Converted") return false;
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const hasDueFollowUp = (l as any).followUps?.some((f: any) =>
          f.status === "Pending" && f.stageAtCreation === "Lead" && new Date(f.nextMeetingDate) >= startOfToday
        );
        if (!hasDueFollowUp) return false;
      }

      if (fuStatusFilter === "pending") {
        const hasPending = (l as any).followUps?.some((f: any) =>
          f.status === "Pending" && new Date(f.nextMeetingDate) > now
        );
        if (!hasPending) return false;
      } else if (fuStatusFilter === "overdue") {
        const hasOverdue = (l as any).followUps?.some((f: any) =>
          f.status === "Pending" && new Date(f.nextMeetingDate) <= now
        );
        if (!hasOverdue) return false;
      } else if (fuStatusFilter === "completed") {
        const allDone = (l as any).followUps?.every((f: any) => f.status !== "Pending");
        if (!allDone) return false;
      }

      return true;
    });
  }, [leads, dateFrom, dateTo, followUpParam, fuStatusFilter, activeTab]);

  const sortedAndFiltered = useMemo(() => {
    let result = filtered;
    if (activeTab === "UpcomingFollowUp" || activeTab === "TodayFollowUp" || activeTab === "TodaysFollowUp") {
      result = [...filtered].sort((a: any, b: any) => {
        const aPending = a.followUps?.filter((f: any) => f.status === "Pending" || f.status === "Scheduled");
        const bPending = b.followUps?.filter((f: any) => f.status === "Pending" || f.status === "Scheduled");
        const aFU = aPending && aPending.length > 0 ? [...aPending].sort((x: any, y: any) => new Date(x.nextMeetingDate).getTime() - new Date(y.nextMeetingDate).getTime())[0] : null;
        const bFU = bPending && bPending.length > 0 ? [...bPending].sort((x: any, y: any) => new Date(x.nextMeetingDate).getTime() - new Date(y.nextMeetingDate).getTime())[0] : null;
        if (!aFU) return 1;
        if (!bFU) return -1;
        return new Date(aFU.nextMeetingDate).getTime() - new Date(bFU.nextMeetingDate).getTime();
      });
    }
    return result;
  }, [filtered, activeTab]);

  const { page, setPage, totalPages, paged, total } = usePagination(sortedAndFiltered, 10);

  // ── KPI counts ────────────────────────────────────────────────────────────

  // V2 KPI counts - aligned with tab sections
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const kpiTotal       = leads.length;
  const kpiNew          = leads.filter(l => l.status === "New").length;
  const kpiTodayFU      = leads.filter(l =>
    (l as any).followUps?.some((f: any) =>
      f.status === "Pending" && f.stageAtCreation === "Lead" &&
      new Date(f.nextMeetingDate) >= startOfToday &&
      new Date(f.nextMeetingDate) < new Date(startOfToday.getTime() + 86400000)
    )
  ).length;
  const kpiSQL          = leads.filter(l => l.status === "SQL").length;
  const kpiOverdue       = leads.filter(l => {
    if (l.status === "Lost" || l.status === "Converted" || l.status === "Duplicate") return false;
    const hasOverdueFU = (l as any).followUps?.some((f: any) =>
      f.status === "Pending" && f.stageAtCreation === "Lead" && new Date(f.nextMeetingDate) <= now
    );
    return hasOverdueFU || isSlaBreached(l, now);
  }).length;
  const kpiLost          = leads.filter(l => l.status === "Lost").length;
  const kpiDuplicate     = leads.filter(l => l.status === "Duplicate").length;

  // ── Form handlers ─────────────────────────────────────────────────────────

  const openCreate = () => {
    setFormData(emptyForm);
    setFormError("");
    setFieldErrors({});
    setIsModalOpen(true);
  };

  const openEdit = (l: any) => {
    // Parse country code from existing phone (e.g. "+91 98765 43210")
    let parsedCode = "+91";
    let parsedPhone = l.phone || "";
    if (l.phone) {
      const match = l.phone.match(/^(\+\d{1,4})\s?(.*)$/);
      if (match) {
        parsedCode = match[1];
        parsedPhone = match[2];
      }
    }
    setFormData({
      id: l.id, leadCode: l.leadCode, name: l.name,
      email: l.email || "", phone: parsedPhone, phoneCountryCode: parsedCode, city: l.city || "",
      status: l.status, assignedUserId: l.assignedUserId || "", leadSource: l.leadSource || "",
      notes: l.notes || "",
      companyName: l.companyName || "", designation: l.designation || "",
      industryType: l.industryType || "", estimatedValue: l.estimatedValue ? String(l.estimatedValue) : "",
    });
    setFormError("");
    setFieldErrors({});
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validation — Name, Phone, Email, City all mandatory
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = "Lead name is required";
    if (!formData.phone.trim()) errors.phone = "Phone number is required";
    else if (formData.phone.replace(/\D/g, "").length < 10) errors.phone = "Enter a valid 10-digit phone number";
    if (!formData.email.trim()) errors.email = "Email address is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = "Enter a valid email address";
    if (!formData.city.trim()) errors.city = "Place / City is required";
    if (!formData.companyName.trim()) errors.companyName = "Company name is required";
    if (!formData.leadSource) errors.leadSource = "Lead Source is required";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError(Object.values(errors).join(", "));
      return;
    }
    setFieldErrors({});
    setFormLoading(true);
    setFormError("");

    let res;
    if (formData.id) {
      res = await updateLeadAction(formData.id, {
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone ? `${formData.phoneCountryCode} ${formData.phone}`.trim() : undefined,
        city: formData.city || undefined,
        status: formData.status,
        assignedUserId: formData.assignedUserId || undefined,
        leadSource: formData.leadSource as any,
        notes: formData.notes || undefined,
        companyName: formData.companyName || undefined,
        designation: formData.designation || undefined,
        industryType: formData.industryType || undefined,
        estimatedValue: formData.estimatedValue ? parseFloat(formData.estimatedValue) : undefined,
      });
    } else {
      res = await createLeadAction({
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone ? `${formData.phoneCountryCode} ${formData.phone}`.trim() : undefined,
        city: formData.city || undefined,
        assignedUserId: formData.assignedUserId || undefined,
        leadSource: formData.leadSource as any,
        notes: formData.notes || undefined,
        companyName: formData.companyName.trim(),
        designation: formData.designation || undefined,
        industryType: formData.industryType || undefined,
        estimatedValue: formData.estimatedValue ? parseFloat(formData.estimatedValue) : undefined,
      });
    }

    if (res.success) {
      setIsModalOpen(false);
      toast.success(formData.id ? "Lead updated successfully." : "Lead created successfully.");
      loadLeads();
      // Open guided workflow modal for new leads — only when self-assigned
      // (creator is the assignee). If Admin assigns to an executive, the
      // executive gets a notification instead; no popup for the Admin.
      if (!formData.id) {
        const newLead = res.data as any;
        const isSelfAssigned = !formData.assignedUserId || formData.assignedUserId === user?.id;
        if (isSelfAssigned) {
          setWorkflowModal({
            open: true,
            leadId: newLead?.id || "",
            leadCode: newLead?.leadCode || "",
            leadName: formData.name,
          });
        }
      }
    } else {
      setFormError(res.message || "Operation failed");
    }
    setFormLoading(false);
  };

  const handleDelete = (l: any) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Lead",
      message: `Delete "${l.name}"? This will erase all their visits, followups, and communications. This cannot be undone.`,
      action: async () => {
        setIsDeleting(true);
        const res = await deleteLeadAction(l.id);
        setIsDeleting(false);
        if (res.success) { toast.success("Lead deleted."); loadLeads(); }
        else toast.error(res.message || "Delete failed.");
      },
    });
  };

  // ── CSV export ────────────────────────────────────────────────────────────

  const exportCSV = () => {
    if (filtered.length === 0) { toast.error("No data to export."); return; }
    const headers = ["S.No", "Lead Code", "Lead Name", "Company", "Phone", "Email", "Industry", "Source", "Score", "Status", "Est. Value", "Created On"];
    const rows = filtered.map((l, i) => [
      i + 1, (l as any).leadCode || "", l.name, (l as any).companyName || "", l.phone || "", l.email || "",
      (l as any).industryType || "", (l as any).leadSource || "", (l as any).leadScore ?? 0,
      l.status, (l as any).estimatedValue || "", formatDate(l.createdAt),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `Leads_${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("CSV exported.");
  };

  const handleTabClick = (tabKey: string) => {
    if (activeTab === tabKey) {
      router.push("/leads");
    } else {
      if (tabKey === "") {
        router.push("/leads");
      } else {
        router.push(`/leads?status=${tabKey}`);
      }
    }
  };

  const clearAllFilters = () => {
    router.push("/leads");
  };

  return (
    <PageShell
      title="Leads Overview"
      subtitle="Manage and track your sales pipeline"
      action={
        <div className="flex items-center gap-2.5">
          <button onClick={exportCSV} className="btn-secondary text-xs flex items-center gap-2">
            <Download size={14} /> Export CSV
          </button>
          {(user?.role === "Admin" || user?.role === "SalesManager") && (
            <button onClick={() => setIsImportOpen(true)} className="btn-secondary text-xs flex items-center gap-2">
              <Upload size={14} /> Import Leads
            </button>
          )}
          {user?.role !== "Customer" && (
            <button onClick={openCreate} className="btn-primary text-xs flex items-center gap-2">
              <Plus size={14} /> Add Lead
            </button>
          )}
        </div>
      }
    >
      {/* ── V2 KPI Cards (aligned with tab sections) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
        <SummaryCard
          label="Total Leads"
          value={kpiTotal}
          subtitle="All pipeline leads"
          icon={<Users size={20} />}
          variant="light"
          isActive={activeTab === ""}
          onClick={() => handleTabClick("")}
        />
        <SummaryCard
          label="New Leads"
          value={kpiNew}
          subtitle="Awaiting first contact"
          icon={<PhoneCall size={20} />}
          variant="light"
          isActive={activeTab === "New"}
          onClick={() => handleTabClick("New")}
        />
        <SummaryCard
          label="Today's Follow-Up"
          value={kpiTodayFU}
          subtitle="Scheduled for today"
          icon={<CalendarClock size={20} />}
          variant="light"
          isActive={activeTab === "TodayFollowUp" || activeTab === "TodaysFollowUp"}
          onClick={() => handleTabClick("TodayFollowUp")}
        />
        <SummaryCard
          label="SQL"
          value={kpiSQL}
          subtitle="Sales Qualified Leads"
          icon={<TrendingUp size={20} />}
          variant="light"
          isActive={activeTab === "SQL"}
          onClick={() => handleTabClick("SQL")}
        />
        <SummaryCard
          label="Overdue"
          value={kpiOverdue}
          subtitle="SLA breached / overdue FU"
          icon={<AlertTriangle size={20} />}
          variant="light"
          isActive={activeTab === "Overdue"}
          onClick={() => handleTabClick("Overdue")}
        />
      </div>

      {/* ── Table Card ── */}
      <div className="crm-card overflow-hidden">

        {/* Toolbar */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-theme flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 shrink-0">
            <h2 className="text-base font-bold text-theme-primary whitespace-nowrap">
              {V2_TABS.find(t => t.key === activeTab)?.label || "Leads Overview"}
            </h2>
            <span className="text-xs font-medium text-theme-muted bg-surface-2 px-2 py-0.5 rounded-full whitespace-nowrap">
              {filtered.length} {filtered.length === 1 ? "lead" : "leads"}
            </span>
            {(activeTab || search || statusFilter || fuStatusFilter || dateFrom || dateTo) ? (
              <button
                onClick={clearAllFilters}
                className="text-xs font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)] flex items-center gap-1 transition-colors bg-blue-50 px-2 py-1 rounded-md ml-2"
              >
                Clear Filters <XCircle size={12} />
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {/* Search */}
            <div className="relative shrink-0">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-7 pr-3 h-8 text-xs rounded-lg bg-surface-2 border border-theme text-theme-primary focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all w-40"
              />
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="h-8 px-2.5 text-xs rounded-lg bg-surface-2 border border-theme text-theme-secondary focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer shrink-0"
            >
              <option value="">All Status</option>
              {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* Follow-Up Status filter */}
            <select
              value={fuStatusFilter}
              onChange={e => { setFuStatusFilter(e.target.value); setPage(1); }}
              className="h-8 px-2.5 text-xs rounded-lg bg-surface-2 border border-theme text-theme-secondary focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer shrink-0"
            >
              <option value="">All Follow-Up</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
              <option value="completed">Completed</option>
            </select>

            {/* Date from */}
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="h-8 px-2 text-xs rounded-lg bg-surface-2 border border-theme text-theme-secondary focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] dark:[color-scheme:dark] shrink-0"
            />
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="h-8 px-2 text-xs rounded-lg bg-surface-2 border border-theme text-theme-secondary focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] dark:[color-scheme:dark] shrink-0"
            />

            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="h-8 px-2.5 text-xs font-medium text-theme-secondary hover:text-theme-primary bg-surface-2 border border-theme hover:bg-surface-offset rounded-lg transition-colors cursor-pointer shrink-0"
              >
                Clear
              </button>
            )}



          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="crm-table" style={{ minWidth: "1340px" }}>
            <colgroup>
              <col style={{ width: "45px" }} />
              <col style={{ width: "90px" }} />
              <col style={{ width: "150px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "90px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "90px" }} />
              <col style={{ width: "55px" }} />
              <col style={{ width: "90px" }} />
              <col style={{ width: "70px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "85px" }} />
              <col style={{ width: "120px" }} /> {/* Actions */}
              <col style={{ width: "65px" }} />  {/* Edit */}
              <col style={{ width: "65px" }} />  {/* Delete */}
            </colgroup>
            <thead>
              <tr>
                <th className="crm-th">#</th>
                <th className="crm-th">Lead Code</th>
                <th className="crm-th">Lead Name</th>
                <th className="crm-th">Company</th>
                <th className="crm-th">Industry</th>
                <th className="crm-th">Phone</th>
                <th className="crm-th">Next Follow-up</th>
                <th className="crm-th">Source</th>
                <th className="crm-th">Score</th>
                <th className="crm-th">Status</th>
                <th className="crm-th">SLA</th>
                <th className="crm-th">Assigned To</th>
                <th className="crm-th">Created</th>
                <th className="crm-th">Actions</th>
                <th className="crm-th">Edit</th>
                <th className="crm-th">Delete</th>
              </tr>
            </thead>
            <tbody>
              {loading ? null : paged.length === 0 ? (
                <tr>
                  <td colSpan={16} className="crm-td text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        {activeTab === "Lost" ? <XCircle size={28} className="text-slate-300 dark:text-slate-600" /> :
                         activeTab === "Duplicate" ? <Copy size={28} className="text-slate-300 dark:text-slate-600" /> :
                         activeTab === "Overdue" ? <AlertTriangle size={28} className="text-slate-300 dark:text-slate-600" /> :
                         activeTab === "SQL" ? <CheckCircle size={28} className="text-slate-300 dark:text-slate-600" /> :
                         activeTab === "TodayFollowUp" || activeTab === "TodaysFollowUp" || activeTab === "UpcomingFollowUp" ? <CalendarClock size={28} className="text-slate-300 dark:text-slate-600" /> :
                         <Users size={28} className="text-slate-300 dark:text-slate-600" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                          {activeTab === "New" ? "No new leads awaiting contact" :
                           activeTab === "TodayFollowUp" || activeTab === "TodaysFollowUp" ? "No follow-ups due today" :
                           activeTab === "UpcomingFollowUp" ? "No upcoming follow-ups scheduled" :
                           activeTab === "SQL" ? "No Sales Qualified Leads yet" :
                           activeTab === "Overdue" ? "No overdue leads — all caught up!" :
                           activeTab === "Lost" ? "No lost leads in this period" :
                           activeTab === "Duplicate" ? "No duplicate leads detected" :
                           "No leads found"}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                          {activeTab === "TodayFollowUp" || activeTab === "TodaysFollowUp" || activeTab === "UpcomingFollowUp" ? "Check back tomorrow or view All Leads" :
                           activeTab === "SQL" ? "Qualify leads via BANT checklist to promote" :
                           activeTab === "Duplicate" ? "Duplicates are auto-detected on phone match" :
                           "Try adjusting your filters or add a new lead"}
                        </p>
                      </div>
                      {user?.role !== "Customer" && (
                        <button onClick={openCreate} className="btn-primary text-xs mt-1">
                          <Plus size={13} /> Add First Lead
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paged.map((l: any, idx) => (
                  <tr
                    key={l.id}
                    className="crm-tr table-row-clickable"
                    onClick={() => router.push(`/leads/${l.id}?status=${l.status}`)}
                  >
                    <td className="crm-td text-theme-muted text-xs font-medium">
                      {(page - 1) * 10 + idx + 1}
                    </td>
                    <td className="crm-td">
                      <span className="text-[11px] font-mono font-bold text-theme-secondary bg-surface-2 px-1.5 py-0.5 rounded">{l.leadCode || "—"}</span>
                    </td>
                    <td className="crm-td">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 text-white shadow-sm", getAvatarColor(l.name))}>
                          {getInitials(l.name)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="row-primary-link text-xs font-bold truncate leading-snug">{l.name}</span>
                          <span className="text-[10px] text-theme-muted truncate">{(l as any).companyName || "—"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="crm-td text-theme-secondary text-xs truncate">{(l as any).companyName || l.city || "—"}</td>
                    <td className="crm-td text-theme-muted text-xs truncate">{(l as any).industryType || "—"}</td>
                    <td className="crm-td text-theme-secondary text-[11px] font-mono">{l.phone || "—"}</td>
                    <td className="crm-td">
                      {(() => {
                        const fups = (l as any).followUps || [];
                        const pendingFu = fups.find((f: any) => f.status === "Pending" || f.status === "Scheduled" || f.status === "Overdue");
                        if (!pendingFu) return <span className="text-xs text-theme-muted font-medium">—</span>;
                        const date = new Date(pendingFu.nextMeetingDate);
                        const isOverdue = date < new Date();
                        if (isOverdue) {
                          return (
                            <span className="inline-flex items-center text-[10px] bg-red-50 text-red-700 border border-red-150 rounded-lg px-2 py-0.5 font-bold animate-pulse">
                              Overdue &middot; {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </span>
                          );
                        }
                        return (
                          <span className="text-xs text-theme-secondary font-medium">
                            {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
                            {date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="crm-td text-theme-muted text-xs truncate">{(l as any).leadSource || "—"}</td>
                    <td className="crm-td">
                      {(() => {
                        const score = (l as any).leadScore ?? 0;
                        const cls = score <= 40
                          ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50"
                          : score <= 70
                          ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50";
                        return <span className={cn("inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded-full text-[10px] font-bold border", cls)}>{score}</span>;
                      })()}
                    </td>
                    <td className="crm-td">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="crm-td">
                      {(() => {
                        const sla = (l as any).slaStatus;
                        if (l.status !== "New" && sla === "Met") return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50">Met</span>;
                        if (sla === "Breached") return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/50 animate-pulse">Breach</span>;
                        if (sla === "Pending" && (l as any).slaResponseDeadline) {
                          const deadline = new Date((l as any).slaResponseDeadline);
                          const minsLeft = Math.floor((deadline.getTime() - Date.now()) / 60000);
                          if (minsLeft <= 0) return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/50 animate-pulse">Breach</span>;
                          if (minsLeft <= 5) return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50">{minsLeft}m</span>;
                          return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/50">{minsLeft}m</span>;
                        }
                        return <span className="text-xs text-slate-400">—</span>;
                      })()}
                    </td>
                    <td className="crm-td text-theme-secondary text-xs truncate">{l.assignedUser?.name || "Unassigned"}</td>
                    <td className="crm-td text-theme-muted text-[11px]">{formatDate(l.createdAt)}</td>
                    <td className="crm-td" onClick={e => e.stopPropagation()}>
                      <div className="relative">
                        {(() => {
                          const wfState = computeWorkflowState(l, (l as any).followUps || []);
                          const wfActions = getLeadWorkflowActions(wfState);
                          if (wfActions.primary) {
                            const handleActionClick = (e: React.MouseEvent) => {
                              e.stopPropagation();
                              if (wfActions.primary?.id === "log-first-call") {
                                router.push(`/activities/new?type=call&leadId=${l.id}&returnTo=/leads`);
                              } else if (wfActions.primary?.id === "log-followup-activity") {
                                const pendingFu = (l as any).followUps?.find((f: any) => f.status === "Pending" || f.status === "Overdue");
                                router.push(`/activities/new?type=call&leadId=${l.id}${pendingFu ? `&followUpId=${pendingFu.id}` : ""}&returnTo=/leads`);
                              } else if (wfActions.primary?.id === "create-followup" || wfActions.primary?.id === "add-followup") {
                                router.push(`/leads/${l.id}?tab=followups&action=add`);
                              } else if (wfActions.primary?.id === "reschedule-followup") {
                                router.push(`/leads/${l.id}?tab=followups`);
                              } else if (wfActions.primary?.id === "mark-sql" || wfActions.primary?.id === "start-qualification") {
                                router.push(`/leads/${l.id}?tab=bant`);
                              } else if (wfActions.primary?.id === "convert-lead") {
                                router.push(`/leads/${l.id}?action=convert`);
                              } else {
                                router.push(`/leads/${l.id}`);
                              }
                            };
                            return (
                              <button
                                onClick={handleActionClick}
                                className="text-[10px] font-bold btn-primary px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                                title={wfActions.stageDescription}
                              >
                                {wfActions.primary.label}
                              </button>
                            );
                          }
                          return <span className="text-slate-400 text-xs">—</span>;
                        })()}
                      </div>
                    </td>
                    <td className="crm-td" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => openEdit(l)}
                        className="row-action-btn"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                    </td>
                    <td className="crm-td" onClick={e => e.stopPropagation()}>
                      {(user?.role === "Admin" || user?.role === "SalesManager") ? (
                        <button
                          onClick={() => handleDelete(l)}
                          disabled={isDeleting}
                          className="row-action-btn row-action-btn-danger"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {total > 0 && (
          <div className="px-5 py-3 border-t border-theme flex items-center justify-between">
            <p className="text-xs text-slate-400 font-medium">
              Showing {Math.min((page - 1) * 10 + 1, total)}–{Math.min(page * 10, total)} of {total} leads
            </p>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={formData.id ? "Edit Lead" : "Add New Lead"}
        subtitle="Fill in the lead details below"
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => { setFormData(emptyForm); setFormError(""); }} className="btn-ghost text-sm">
              Clear
            </button>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary text-sm">
              Cancel
            </button>
            <button
              type="submit"
              form="lead-form"
              disabled={formLoading}
              className="btn-primary text-sm"
            >
              {formLoading ? (
                <><span className="spinner-brand" /> Saving...</>
              ) : (
                formData.id ? "Update Lead" : "Save Lead"
              )}
            </button>
          </>
        }
      >
        <form id="lead-form" onSubmit={handleSubmit} className="p-6 space-y-5">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 text-center">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Lead Name" required error={fieldErrors.name}>
              <Input
                value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                placeholder="Enter lead name"
                required
              />
            </FormField>

            <FormField label="Phone No" required error={fieldErrors.phone}>
              <div className="flex gap-2">
                <Select
                  value={formData.phoneCountryCode}
                  onChange={e => setFormData(p => ({ ...p, phoneCountryCode: e.target.value }))}
                  className="w-40 shrink-0"
                >
                  {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                </Select>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                  placeholder="98765 43210"
                  className="flex-1"
                />
              </div>
            </FormField>

            <FormField label="Email ID" required error={fieldErrors.email}>
              <Input
                type="email"
                value={formData.email}
                onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                placeholder="email@example.com"
              />
            </FormField>

            <FormField label="Company Name" required>
              <Input
                value={formData.companyName}
                onChange={e => setFormData(p => ({ ...p, companyName: e.target.value }))}
                placeholder="ABC Industries Pvt Ltd"
              />
            </FormField>

            <FormField label="Designation">
              <Input
                value={formData.designation}
                onChange={e => setFormData(p => ({ ...p, designation: e.target.value }))}
                placeholder="Purchase Manager"
              />
            </FormField>

            <FormField label="Industry Type">
              <Select
                value={formData.industryType}
                onChange={e => setFormData(p => ({ ...p, industryType: e.target.value }))}
              >
                <option value="">Select industry...</option>
                {INDUSTRY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            </FormField>

            <FormField label="Estimated Value (₹)">
              <Input
                type="number"
                value={formData.estimatedValue}
                onChange={e => setFormData(p => ({ ...p, estimatedValue: e.target.value }))}
                placeholder="500000"
                min="0"
              />
            </FormField>

            <FormField label="City" required error={fieldErrors.city}>
              <Input
                value={formData.city}
                onChange={e => setFormData(p => ({ ...p, city: e.target.value }))}
                placeholder="Mumbai"
              />
            </FormField>

            <FormField label="Lead Source" required>
              <Select
                value={formData.leadSource}
                onChange={e => setFormData(p => ({ ...p, leadSource: e.target.value }))}
              >
                <option value="">Select source...</option>
                {dbLeadSources.length > 0 
                  ? dbLeadSources.map(s => <option key={s.id} value={s.name}>{s.name}</option>)
                  : LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)
                }
              </Select>
            </FormField>

            <FormField label="Status">
              <Select
                value={formData.status}
                onChange={e => setFormData(p => ({ ...p, status: e.target.value as any }))}
              >
                {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </FormField>

            {(user?.role === "Admin" || user?.role === "SalesManager") && (
              <FormField label="Assigned To">
                <Select
                  value={formData.assignedUserId}
                  onChange={e => setFormData(p => ({ ...p, assignedUserId: e.target.value }))}
                >
                  <option value="">Unassigned</option>
                  {executives.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                </Select>
              </FormField>
            )}
          </div>

          <FormField label="Remarks">
            <Textarea
              value={formData.notes}
              onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
              placeholder="Any additional notes..."
              rows={3}
            />
          </FormField>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.action}
        onCancel={() => setConfirmState(p => ({ ...p, isOpen: false }))}
        isDestructive
      />

      {/* Guided post-creation workflow: Lead Created → Plan Visit → Log Activity */}
      <LeadCreatedWorkflowModal
        open={workflowModal.open}
        leadId={workflowModal.leadId}
        leadCode={workflowModal.leadCode}
        leadName={workflowModal.leadName}
        onClose={() => setWorkflowModal(o => ({ ...o, open: false }))}
      />

      <LeadImportModal
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportDone={async () => {
          const result = await getLeadsAction();
          if (result.success && result.data) setLeads(result.data as any);
        }}
      />
    </PageShell>
  );
}
