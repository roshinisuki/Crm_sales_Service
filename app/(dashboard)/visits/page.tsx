"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Textarea } from "@/components/ui/FormField";
import { StatusFilterBar, useStatusFromUrl } from "@/components/shared/StatusFilterBar";
import { ACTIVITY_STATUS } from "@/lib/module-status-config";
import { formatDate, formatDateTime, cn, getCheckInWindow } from "@/lib/ui-utils";
import {
  Plus, Eye, MapPin, CheckCircle, Clock, CalendarClock,
  AlertTriangle, X, Users, MapPinOff, ShieldAlert, ChevronRight,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: "", label: "Visits Overview" },
  { key: "PLANNED", label: "Planned" },
  { key: "CHECKED_IN", label: "Checked In" },
  { key: "CHECKED_OUT", label: "Checked Out" },
  { key: "COMPLETED", label: "Completed" },
  { key: "MISSED", label: "Missed" },
  { key: "NEEDS_REVIEW", label: "Needs Review" },
  { key: "NO_SHOW", label: "No Show" },
  { key: "CUSTOMER_UNAVAILABLE", label: "Unavailable" },
  { key: "AUTO_CHECKED_OUT", label: "Auto Checked Out" },
];

const STATUS_PILLS: Record<string, string> = {
  PLANNED: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  CHECKED_IN: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
  CHECKED_OUT: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-800/40",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  MISSED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/40",
  NEEDS_REVIEW: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800/40",
  NO_SHOW: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
  CUSTOMER_UNAVAILABLE: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-600/40",
  AUTO_CHECKED_OUT: "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-600/40",
};

const STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planned",
  CHECKED_IN: "Checked In",
  CHECKED_OUT: "Checked Out",
  COMPLETED: "Completed",
  MISSED: "Missed",
  NEEDS_REVIEW: "Needs Review",
  NO_SHOW: "No Show",
  CUSTOMER_UNAVAILABLE: "Unavailable",
  AUTO_CHECKED_OUT: "Auto Checked Out",
};

const PURPOSE_OPTIONS = [
  "Demo", "Technical Discussion", "Commercial Meeting",
  "Relationship Visit", "Complaint Resolution",
];

// ─── KPI definitions ──────────────────────────────────────────────────────────

type KpiKey = "PLANNED" | "CHECKED_IN" | "COMPLETED" | "MISSED" | "NEEDS_REVIEW" | "NO_SHOW";

const KPI_DEFS: Array<{
  key: KpiKey;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  variant: "blue" | "amber" | "green" | "red" | "orange" | "slate";
}> = [
  {
    key: "PLANNED",
    label: "Planned",
    subtitle: "Upcoming visits",
    icon: <CalendarClock size={18} />,
    variant: "blue",
  },
  {
    key: "CHECKED_IN",
    label: "Checked In",
    subtitle: "Currently active",
    icon: <MapPin size={18} />,
    variant: "amber",
  },
  {
    key: "COMPLETED",
    label: "Completed",
    subtitle: "Visits finished",
    icon: <CheckCircle size={18} />,
    variant: "green",
  },
  {
    key: "MISSED",
    label: "Missed",
    subtitle: "Not conducted",
    icon: <AlertTriangle size={18} />,
    variant: "red",
  },
  {
    key: "NEEDS_REVIEW",
    label: "Needs Review",
    subtitle: "Pending review",
    icon: <Clock size={18} />,
    variant: "orange",
  },
  {
    key: "NO_SHOW",
    label: "No Show",
    subtitle: "Customer absent",
    icon: <X size={18} />,
    variant: "slate",
  },
];

// ─── Main content ─────────────────────────────────────────────────────────────

function VisitsListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const activeTab = useStatusFromUrl("status");
  const visitTypeFilter = searchParams.get("visitType") || "";

  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeKpi, setActiveKpi] = useState<KpiKey | null>(null);

  // Modals
  const [showCompliance, setShowCompliance] = useState(false);
  const [complianceData, setComplianceData] = useState<any[]>([]);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [tooLateVisitIds, setTooLateVisitIds] = useState<Set<string>>(new Set());
  const [gpsDeniedVisitId, setGpsDeniedVisitId] = useState<string | null>(null);
  const [manualLocationNote, setManualLocationNote] = useState("");
  const [checkInModal, setCheckInModal] = useState<{ visitId: string; visitType: string } | null>(null);
  const [checkInForm, setCheckInForm] = useState({ checkedInBy: "" });

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchVisits = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeTab) params.set("status", activeTab);
    if (visitTypeFilter) params.set("visitType", visitTypeFilter);
    const res = await fetch(`/api/visits?${params.toString()}`);
    if (res.ok) {
      const json = await res.json();
      setVisits(json.data || []);
    } else {
      toast.error("Failed to load visits");
    }
    setLoading(false);
  }, [activeTab, visitTypeFilter]);

  useEffect(() => { fetchVisits(); }, [fetchVisits]);

  // Reset KPI filter when the status tab (URL) changes
  useEffect(() => { setActiveKpi(null); }, [activeTab, visitTypeFilter]);

  // ── Check-in handlers ─────────────────────────────────────────────────────

  const handleCheckIn = async (id: string, visitType: string = "field_visit") => {
    if (visitType === "office_visit") {
      setCheckInModal({ visitId: id, visitType });
      return;
    }
    if (!navigator.geolocation) {
      setGpsDeniedVisitId(id);
      setManualLocationNote("");
      return;
    }
    toast.info("Capturing your location...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const res = await fetch(`/api/visits/${id}/checkin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gps_lat: latitude, gps_lng: longitude }),
        });
        const json = await res.json();
        if (json.success) {
          toast.success("Checked in successfully");
          if (json.warning) toast.warning(json.warning);
          fetchVisits();
        } else if (json.error === "TOO_EARLY") {
          toast.warning(json.message || "Too early to check in");
        } else if (json.error === "TOO_LATE") {
          setTooLateVisitIds((prev) => new Set(prev).add(id));
          toast.error(json.message || "Check-in window has passed for this visit.");
        } else {
          toast.error(json.message || "Check-in failed");
        }
      },
      () => {
        setGpsDeniedVisitId(id);
        setManualLocationNote("");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleManualCheckIn = async () => {
    if (!gpsDeniedVisitId || !manualLocationNote.trim()) {
      toast.error("Please enter a location note to check in without GPS");
      return;
    }
    const res = await fetch(`/api/visits/${gpsDeniedVisitId}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationVerified: false, manualLocationNote }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Checked in (location unverified)");
      if (json.warning) toast.warning(json.warning);
      setGpsDeniedVisitId(null);
      setManualLocationNote("");
      fetchVisits();
    } else {
      toast.error(json.message || "Check-in failed");
    }
  };

  const handleOfficeCheckIn = async () => {
    if (!checkInModal || !checkInForm.checkedInBy) {
      toast.error("Please enter the receptionist/host name");
      return;
    }
    const res = await fetch(`/api/visits/${checkInModal.visitId}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkedInBy: checkInForm.checkedInBy }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Checked in successfully");
      setCheckInModal(null);
      setCheckInForm({ checkedInBy: "" });
      fetchVisits();
    } else {
      toast.error(json.message || "Check-in failed");
    }
  };

  const fetchCompliance = useCallback(async () => {
    setComplianceLoading(true);
    const res = await fetch(`/api/visits/key-account-compliance`);
    if (res.ok) {
      const json = await res.json();
      setComplianceData(json.data || []);
    } else {
      toast.error("Failed to load compliance data");
    }
    setComplianceLoading(false);
  }, []);

  const handleOpenCompliance = () => {
    setShowCompliance(true);
    fetchCompliance();
  };

  // ── KPI counts ────────────────────────────────────────────────────────────

  const kpiCounts: Record<KpiKey, number> = {
    PLANNED: visits.filter((v) => v.status === "PLANNED").length,
    CHECKED_IN: visits.filter((v) => v.status === "CHECKED_IN").length,
    COMPLETED: visits.filter((v) => v.status === "COMPLETED").length,
    MISSED: visits.filter((v) => v.status === "MISSED").length,
    NEEDS_REVIEW: visits.filter((v) => v.status === "NEEDS_REVIEW").length,
    NO_SHOW: visits.filter((v) => v.status === "NO_SHOW").length,
  };

  // ── Filtered table rows based on active KPI ────────────────────────────────

  const displayedVisits = activeKpi
    ? visits.filter((v) => v.status === activeKpi)
    : visits;

  // ── Misc helpers ──────────────────────────────────────────────────────────

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getComplianceColor = (days: number | null) => {
    if (days == null) return "bg-rose-50 dark:bg-rose-950/20";
    if (days > 90) return "bg-rose-50 dark:bg-rose-950/20";
    if (days > 60) return "bg-orange-50 dark:bg-orange-950/20";
    if (days > 30) return "bg-amber-50 dark:bg-amber-950/20";
    return "bg-emerald-50 dark:bg-emerald-950/20";
  };

  const activeTabLabel = activeTab
    ? STATUS_TABS.find((t) => t.key === activeTab)?.label
    : visitTypeFilter === "field_visit"
    ? "Field Visits"
    : visitTypeFilter === "office_visit"
    ? "Office Visits"
    : undefined;

  const breadcrumb = activeTabLabel
    ? [{ label: "Customer Visits", href: "/visits" }, { label: activeTabLabel }]
    : [{ label: "Customer Visits" }];

  const tableTitle = activeKpi
    ? `${STATUS_LABELS[activeKpi] ?? activeKpi} Visits`
    : activeTabLabel ?? "All Visits";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PageShell
      title="Customer Visits Overview"
      subtitle="Field sales tracking with GPS check-in and visit compliance."
      breadcrumb={breadcrumb}
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/visits/new")}
            className="px-4 py-2 bg-[var(--primary)] text-white font-semibold text-sm rounded-xl hover:bg-[var(--primary-hover)] transition-all flex items-center gap-1.5 shadow-sm hover:shadow-md"
          >
            <Plus size={15} /> Plan Visit
          </button>
        </div>
      }
    >
      <div className="space-y-5">

        {/* ── KPI Cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {KPI_DEFS.map((kpi) => (
            <SummaryCard
              key={kpi.key}
              label={kpi.label}
              value={kpiCounts[kpi.key]}
              subtitle={kpi.subtitle}
              icon={kpi.icon}
              variant={kpi.variant}
              isActive={activeKpi === kpi.key}
              onClick={() =>
                setActiveKpi((prev) => (prev === kpi.key ? null : kpi.key))
              }
            />
          ))}
        </div>

        {/* Active KPI filter badge */}
        {activeKpi && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-secondary)]">Filtering by:</span>
            <button
              onClick={() => setActiveKpi(null)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 text-blue-700 dark:text-blue-400 text-[11px] font-bold hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors"
            >
              {STATUS_LABELS[activeKpi]}
              <X size={11} />
            </button>
            <span className="text-xs text-[var(--text-muted)]">
              — {displayedVisits.length} visit{displayedVisits.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* ── Status Filter Bar ────────────────────────────────────────────── */}
        <StatusFilterBar
          statuses={ACTIVITY_STATUS}
          paramKey="status"
          basePath="/visits"
        />

        {/* ── Visits Table ─────────────────────────────────────────────────── */}
        <div className="crm-card overflow-hidden">
          {/* Card header */}
          <div className="px-5 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--surface-2)] text-[var(--text-secondary)]">
                <Users size={15} />
              </span>
              <div>
                <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">
                  {tableTitle}
                </h3>
                <p className="text-[11.5px] text-[var(--text-tertiary)]">
                  {displayedVisits.length} visit{displayedVisits.length !== 1 ? "s" : ""} in current view
                </p>
              </div>
            </div>
            {activeKpi && (
              <button
                onClick={() => setActiveKpi(null)}
                className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-secondary)] flex items-center gap-1 transition-colors"
              >
                Clear filter <X size={12} />
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="crm-table">
              <thead>
                <tr className="crm-tr border-b border-[var(--border-subtle)]">
                  <th className="crm-th">Account</th>
                  <th className="crm-th">Plant Location</th>
                  <th className="crm-th">Purpose</th>
                  <th className="crm-th">Date &amp; Time</th>
                  <th className="crm-th">Assigned To</th>
                  <th className="crm-th">Status</th>
                  <th className="crm-th">GPS</th>
                  <th className="crm-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 rounded-full border-2 border-[var(--border-subtle)] border-t-[var(--primary)] animate-spin" />
                        <p className="text-sm text-[var(--text-muted)]">Loading visits…</p>
                      </div>
                    </td>
                  </tr>
                ) : displayedVisits.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--surface-2)] flex items-center justify-center">
                          <MapPinOff size={22} className="text-[var(--text-muted)]" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-secondary)]">
                            No visits found
                          </p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            {activeKpi
                              ? `No ${STATUS_LABELS[activeKpi]?.toLowerCase()} visits in the current filter.`
                              : "Plan a new visit to get started."}
                          </p>
                        </div>
                        {!activeKpi && (
                          <button
                            onClick={() => router.push("/visits/new")}
                            className="mt-1 px-4 py-2 bg-[var(--primary)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--primary-hover)] transition-all flex items-center gap-1.5 shadow-sm"
                          >
                            <Plus size={14} /> Plan Visit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedVisits.map((v) => {
                    const isPlannedToday =
                      v.status === "PLANNED" &&
                      v.plannedDate &&
                      new Date(v.plannedDate).toDateString() === today.toDateString();
                    const checkInWindow = isPlannedToday ? getCheckInWindow(v.plannedDate, v.plannedTime) : null;
                    const isCheckInTooLate = checkInWindow?.status === "TOO_LATE" || tooLateVisitIds.has(v.id);

                    return (
                      <tr
                        key={v.id}
                        className="crm-tr hover:bg-[var(--surface-2)]/60 transition-colors cursor-pointer"
                        onClick={() => router.push(`/visits/${v.id}?status=${v.status}`)}
                      >
                        {/* Account */}
                        <td className="crm-td">
                          <p className="font-bold text-[var(--text-primary)] text-sm">{v.customer?.name || "—"}</p>
                          <p className="text-[11px] text-[var(--text-muted)]">{v.customer?.customerCode}</p>
                        </td>

                        {/* Plant Location */}
                        <td className="crm-td">
                          <p className="text-sm text-[var(--text-secondary)]">{v.plantLocation?.locationName || "—"}</p>
                          <p className="text-[11px] text-[var(--text-muted)]">{v.plantLocation?.city}</p>
                        </td>

                        {/* Purpose */}
                        <td className="crm-td">
                          <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800/50">
                            {v.purpose}
                          </span>
                        </td>

                        {/* Date & Time */}
                        <td className="crm-td">
                          {v.plannedDate ? (
                            <div>
                              <p className="text-sm font-medium text-[var(--text-primary)]">{formatDate(v.plannedDate)}</p>
                              <p className="text-[11px] text-[var(--text-muted)]">{v.plannedTime}</p>
                            </div>
                          ) : (
                            <span className="text-[var(--text-muted)] text-sm">—</span>
                          )}
                        </td>

                        {/* Assigned To */}
                        <td className="crm-td">
                          <span className="text-sm text-[var(--text-secondary)]">{v.host?.name || "—"}</span>
                        </td>

                        {/* Status */}
                        <td className="crm-td">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={cn(
                              "px-2 py-0.5 text-[10px] font-bold rounded-md border",
                              v.visitType === "field_visit"
                                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40"
                                : "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800/40"
                            )}>
                              {v.visitType === "field_visit" ? "Field" : "Office"}
                            </span>
                            <span className={cn(
                              "px-2.5 py-1 text-xs font-bold rounded-lg border",
                              STATUS_PILLS[v.status] || "bg-slate-50 text-slate-600 border-slate-200"
                            )}>
                              {STATUS_LABELS[v.status] || v.status}
                            </span>
                            {v.status === "CHECKED_IN" && v.checkInTime &&
                              (new Date().getTime() - new Date(v.checkInTime).getTime()) / (1000 * 60 * 60) > 2 && (
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800/40">
                                  Long Check-in
                                </span>
                              )}
                            {v.autoCheckedOut && (
                              <span title="Auto checked out by system after 9 hours." className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40 cursor-help">
                                Auto C/O
                              </span>
                            )}
                          </div>
                        </td>

                        {/* GPS */}
                        <td className="crm-td">
                          {v.gpsLat != null ? (
                            <MapPin size={15} className={v.gpsAnomaly ? "text-amber-500" : "text-emerald-500"} />
                          ) : v.locationVerified === false ? (
                            <span title="Location unverified — checked in without GPS" className="text-amber-500">
                              <AlertTriangle size={14} className="inline" />
                            </span>
                          ) : (
                            <span className="text-[var(--border-subtle)]">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="crm-td text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {isPlannedToday && (
                              <div className="relative group">
                                <button
                                  onClick={() => !isCheckInTooLate && handleCheckIn(v.id, v.visitType)}
                                  disabled={isCheckInTooLate}
                                  className={cn(
                                    "px-2.5 py-1 text-white font-semibold text-xs rounded-lg flex items-center gap-1 transition-all",
                                    isCheckInTooLate
                                      ? "bg-amber-300 cursor-not-allowed"
                                      : "bg-amber-600 hover:bg-amber-700 shadow-sm hover:shadow"
                                  )}
                                >
                                  <MapPin size={12} /> Check In
                                </button>
                                {checkInWindow && (
                                  <span className="absolute bottom-full right-0 mb-1 hidden group-hover:block w-56 px-2 py-1 text-xs text-white bg-slate-800 rounded-lg text-left z-10">
                                    Check-in available from {formatDateTime(checkInWindow.start)} to {formatDateTime(checkInWindow.end)}
                                  </span>
                                )}
                              </div>
                            )}
                            {v.status === "CHECKED_IN" && (
                              <button
                                onClick={() => router.push(`/visits/${v.id}?status=${v.status}`)}
                                className="px-2.5 py-1 bg-teal-600 text-white font-semibold text-xs rounded-lg hover:bg-teal-700 transition-all shadow-sm"
                              >
                                Check Out
                              </button>
                            )}
                            {v.status === "CHECKED_OUT" && (
                              <button
                                onClick={() => router.push(`/visits/${v.id}?status=${v.status}`)}
                                className="px-2.5 py-1 bg-[var(--primary)] text-white font-semibold text-xs rounded-lg hover:bg-[var(--primary-hover)] transition-all shadow-sm"
                              >
                                Complete
                              </button>
                            )}
                            {v.status === "NEEDS_REVIEW" && (
                              <button
                                onClick={() => router.push(`/visits/${v.id}?status=${v.status}`)}
                                className="px-2.5 py-1 bg-orange-600 text-white font-semibold text-xs rounded-lg hover:bg-orange-700 transition-all shadow-sm"
                              >
                                Review
                              </button>
                            )}
                            {(v.status === "PLANNED" || v.status === "MISSED") && (
                              <button
                                onClick={() => router.push(`/visits/${v.id}?status=${v.status}`)}
                                className="px-2.5 py-1 bg-[var(--surface-2)] text-[var(--text-secondary)] font-semibold text-xs rounded-lg hover:bg-[var(--surface-3)] border border-[var(--border-subtle)] transition-all"
                              >
                                Reschedule
                              </button>
                            )}
                            <button
                              onClick={() => router.push(`/visits/${v.id}?status=${v.status}`)}
                              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--surface-2)] rounded-lg transition-all"
                              title="View"
                            >
                              <Eye size={15} />
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
      </div>

      {/* ── Compliance Modal ─────────────────────────────────────────────────── */}
      <Modal
        open={showCompliance}
        onClose={() => setShowCompliance(false)}
        title="Key Account Visit Compliance"
        subtitle="Key accounts not visited in 30+ days"
        size="lg"
        footer={
          <button onClick={() => setShowCompliance(false)} className="px-4 py-2 text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text-secondary)]">Close</button>
        }
      >
        <div className="p-4">
          {complianceLoading ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="w-7 h-7 rounded-full border-2 border-[var(--border-subtle)] border-t-[var(--primary)] animate-spin" />
              <p className="text-sm text-[var(--text-muted)]">Loading compliance data…</p>
            </div>
          ) : complianceData.length === 0 ? (
            <div className="text-center py-10 text-[var(--text-muted)] text-sm">No key accounts found.</div>
          ) : (
              <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="text-left px-3 py-2 text-xs font-bold text-[var(--text-secondary)] uppercase">Account</th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-[var(--text-secondary)] uppercase">City</th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-[var(--text-secondary)] uppercase">Sales Owner</th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-[var(--text-secondary)] uppercase">Last Visit</th>
                  <th className="text-right px-3 py-2 text-xs font-bold text-[var(--text-secondary)] uppercase">Days Since</th>
                  <th className="text-right px-3 py-2 text-xs font-bold text-[var(--text-secondary)] uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {complianceData.map((c) => (
                  <tr key={c.accountId} className={cn("border-b border-[var(--border-subtle)]", getComplianceColor(c.daysSinceVisit))}>
                    <td className="px-3 py-2.5 text-sm font-bold text-[var(--text-primary)]">{c.accountName}</td>
                    <td className="px-3 py-2.5 text-sm text-[var(--text-secondary)]">{c.city || "—"}</td>
                    <td className="px-3 py-2.5 text-sm text-[var(--text-secondary)]">{c.salesOwner}</td>
                    <td className="px-3 py-2.5 text-sm text-[var(--text-secondary)]">{c.lastVisitDate ? formatDate(c.lastVisitDate) : "Never"}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={cn(
                        "text-sm font-bold",
                        c.daysSinceVisit == null ? "text-rose-600" :
                        c.daysSinceVisit > 90 ? "text-rose-600" :
                        c.daysSinceVisit > 60 ? "text-orange-600" :
                        c.daysSinceVisit > 30 ? "text-amber-600" :
                        "text-emerald-600"
                      )}>
                        {c.daysSinceVisit == null ? "Never" : `${c.daysSinceVisit}d`}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => router.push(`/visits/new?accountId=${c.accountId}`)}
                        className="px-3 py-1 bg-[var(--primary)] text-white text-xs font-semibold rounded-lg hover:bg-[var(--primary-hover)] transition-all shadow-sm"
                      >
                        Schedule Visit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>

      {/* ── Office Check-in Modal ─────────────────────────────────────────────── */}
      {checkInModal && (
        <Modal
          open={!!checkInModal}
          onClose={() => setCheckInModal(null)}
          title="Office Visit Check-In"
          subtitle="Enter receptionist/host confirmation"
          footer={
            <>
              <button onClick={() => setCheckInModal(null)} className="px-4 py-2 text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text-secondary)]">Cancel</button>
              <button onClick={handleOfficeCheckIn} className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-bold rounded-lg hover:bg-[var(--primary-hover)]">Check In</button>
            </>
          }
        >
          <div className="p-6 space-y-4">
            <FormField label="Receptionist/Host Name" required>
              <Input
                value={checkInForm.checkedInBy}
                onChange={(e) => setCheckInForm({ ...checkInForm, checkedInBy: e.target.value })}
                placeholder="Enter the name of the person who checked in the visitor"
              />
            </FormField>
          </div>
        </Modal>
      )}

      {/* ── GPS Denied Modal ──────────────────────────────────────────────────── */}
      {gpsDeniedVisitId && (
        <Modal
          open={!!gpsDeniedVisitId}
          onClose={() => { setGpsDeniedVisitId(null); setManualLocationNote(""); }}
          title="Check In Without GPS"
          subtitle="GPS location could not be captured. Enter a manual location note to proceed."
          footer={
            <>
              <button
                onClick={() => { setGpsDeniedVisitId(null); setManualLocationNote(""); }}
                className="px-4 py-2 text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleManualCheckIn}
                className="px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded-lg hover:bg-amber-700"
              >
                Check In (Unverified)
              </button>
            </>
          }
        >
          <div className="p-6 space-y-4">
            <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg text-sm text-amber-800 dark:text-amber-400">
              <AlertTriangle size={14} className="inline mr-1.5" />
              Location will be marked as unverified and flagged in the visit record.
            </div>
            <FormField label="Manual Location Note" required>
              <Textarea
                value={manualLocationNote}
                onChange={(e) => setManualLocationNote(e.target.value)}
                placeholder="Describe your current location (e.g., 'At customer factory gate, GPS not available')"
                rows={3}
              />
            </FormField>
          </div>
        </Modal>
      )}
    </PageShell>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function VisitsListPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[var(--primary)] animate-spin" />
        </div>
      }
    >
      <VisitsListContent />
    </Suspense>
  );
}
