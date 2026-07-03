"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Textarea, Select } from "@/components/ui/FormField";
import { StatusFilterBar, useStatusFromUrl } from "@/components/shared/StatusFilterBar";
import { ACTIVITY_STATUS } from "@/lib/module-status-config";
import { formatDate, formatDateTime, cn, getCheckInWindow } from "@/lib/ui-utils";
import {
  Plus, Eye, MapPin, CheckCircle, Clock, CalendarClock,
  AlertTriangle, Briefcase, TrendingUp, X, ChevronRight,
} from "lucide-react";

const STATUS_TABS = [
  { key: "PLANNED", label: "Planned" },
  { key: "CHECKED_IN", label: "Checked In" },
  { key: "CHECKED_OUT", label: "Checked Out" },
  { key: "COMPLETED", label: "Completed" },
  { key: "MISSED", label: "Missed" },
  { key: "CUSTOMER_UNAVAILABLE", label: "Unavailable" },
  { key: "AUTO_CHECKED_OUT", label: "Auto Checked Out" },
  { key: "", label: "All Visits" },
];

const STATUS_PILLS: Record<string, string> = {
  PLANNED: "bg-blue-50 text-blue-700 border-blue-200",
  CHECKED_IN: "bg-amber-50 text-amber-700 border-amber-200",
  CHECKED_OUT: "bg-teal-50 text-teal-700 border-teal-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MISSED: "bg-rose-50 text-rose-700 border-rose-200",
  CUSTOMER_UNAVAILABLE: "bg-slate-100 text-slate-700 border-slate-300",
};

const STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planned",
  CHECKED_IN: "Checked In",
  CHECKED_OUT: "Checked Out",
  COMPLETED: "Completed",
  MISSED: "Missed",
  CUSTOMER_UNAVAILABLE: "Unavailable",
};

const PURPOSE_OPTIONS = [
  "Demo", "Technical Discussion", "Commercial Meeting",
  "Relationship Visit", "Complaint Resolution",
];

function VisitsListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const activeTab = useStatusFromUrl("status");
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompliance, setShowCompliance] = useState(false);
  const [complianceData, setComplianceData] = useState<any[]>([]);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [tooLateVisitIds, setTooLateVisitIds] = useState<Set<string>>(new Set());

  const fetchVisits = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeTab) {
      params.set("status", activeTab);
    }
    const res = await fetch(`/api/visits?${params.toString()}`);
    if (res.ok) {
      const json = await res.json();
      setVisits(json.data || []);
    } else {
      toast.error("Failed to load visits");
    }
    setLoading(false);
  }, [activeTab]);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  const handleCheckIn = async (id: string) => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by this browser");
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
      (err) => {
        toast.error(`Failed to get location: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
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

  const kpiPlanned = visits.filter((v) => v.status === "PLANNED").length;
  const kpiCompleted = visits.filter((v) => v.status === "COMPLETED").length;
  const kpiMissed = visits.filter((v) => v.status === "MISSED").length;
  const kpiCheckedIn = visits.filter((v) => v.status === "CHECKED_IN").length;
  const kpiUnavailable = visits.filter((v) => v.status === "CUSTOMER_UNAVAILABLE").length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getComplianceColor = (days: number | null) => {
    if (days == null) return "bg-rose-50";
    if (days > 90) return "bg-rose-50";
    if (days > 60) return "bg-orange-50";
    if (days > 30) return "bg-amber-50";
    return "bg-emerald-50";
  };

  const activeTabLabel = activeTab ? STATUS_TABS.find((t) => t.key === activeTab)?.label : undefined;
  const breadcrumb = activeTabLabel
    ? [{ label: "Customer Visits", href: "/visits" }, { label: activeTabLabel }]
    : [{ label: "Customer Visits" }];

  return (
    <PageShell
      title="Customer Visits"
      subtitle="Field sales tracking with GPS check-in and visit compliance."
      breadcrumb={breadcrumb}
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenCompliance}
            className="px-3 py-2 text-sm font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5"
          >
            <AlertTriangle size={15} /> Key Account Compliance
          </button>
          <button
            onClick={() => router.push("/visits/new")}
            className="px-4 py-2 bg-[var(--primary)] text-white font-bold text-sm rounded-lg hover:bg-[var(--primary-hover)] flex items-center gap-1.5"
          >
            <Plus size={15} /> Plan Visit
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <SummaryCard label="Planned" value={kpiPlanned.toString()} icon={<CalendarClock size={20} />} variant="indigo" />
          <SummaryCard label="Checked In" value={kpiCheckedIn.toString()} icon={<MapPin size={20} />} variant="light" />
          <SummaryCard label="Completed" value={kpiCompleted.toString()} icon={<CheckCircle size={20} />} variant="dark" />
          <SummaryCard label="Missed" value={kpiMissed.toString()} icon={<AlertTriangle size={20} />} variant="orange" />
          <SummaryCard label="Unavailable" value={kpiUnavailable.toString()} icon={<Clock size={20} />} variant="light" />
        </div>

        {/* Status Filter Bar */}
        <StatusFilterBar
          statuses={ACTIVITY_STATUS}
          paramKey="status"
          basePath="/visits"
        />

        {/* Visits Table */}
        <div className="crm-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="crm-table">
              <thead>
                <tr className="crm-tr border-b border-slate-200/60">
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
                    <td colSpan={8} className="px-5 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[var(--primary)] animate-spin" />
                        <p className="text-sm text-slate-400">Loading visits...</p>
                      </div>
                    </td>
                  </tr>
                ) : visits.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center">
                      <p className="text-sm font-semibold text-slate-500">No visits found</p>
                    </td>
                  </tr>
                ) : (
                  visits.map((v) => {
                    const isPlannedToday =
                      v.status === "PLANNED" &&
                      v.plannedDate &&
                      new Date(v.plannedDate).toDateString() === today.toDateString();
                    const checkInWindow = isPlannedToday ? getCheckInWindow(v.plannedDate, v.plannedTime) : null;
                    const isCheckInTooLate = checkInWindow?.status === "TOO_LATE" || tooLateVisitIds.has(v.id);
                    return (
                      <tr key={v.id} className="crm-tr hover:bg-slate-50/80 transition-colors">
                        <td className="crm-td">
                          <p className="font-bold text-slate-800 text-sm">{v.customer?.name || "—"}</p>
                          <p className="text-[11px] text-slate-400">{v.customer?.customerCode}</p>
                        </td>
                        <td className="crm-td">
                          <p className="text-sm text-slate-600">{v.plantLocation?.locationName || "—"}</p>
                          <p className="text-[11px] text-slate-400">{v.plantLocation?.city}</p>
                        </td>
                        <td className="crm-td">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-md border border-indigo-100">
                            {v.purpose}
                          </span>
                        </td>
                        <td className="crm-td">
                          {v.plannedDate ? (
                            <div>
                              <p className="text-sm font-medium text-slate-700">{formatDate(v.plannedDate)}</p>
                              <p className="text-[11px] text-slate-400">{v.plannedTime}</p>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-sm">—</span>
                          )}
                        </td>
                        <td className="crm-td">
                          <span className="text-sm text-slate-600">{v.host?.name || "—"}</span>
                        </td>
                        <td className="crm-td">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={cn("px-2.5 py-1 text-xs font-bold rounded-lg border", STATUS_PILLS[v.status] || "bg-slate-50 text-slate-600 border-slate-200")}>
                              {STATUS_LABELS[v.status] || v.status}
                            </span>
                            {v.status === "CHECKED_IN" && v.checkInTime && (
                              (new Date().getTime() - new Date(v.checkInTime).getTime()) / (1000 * 60 * 60) > 2
                            ) && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-orange-100 text-orange-700 border border-orange-200">
                                Long Check-in
                              </span>
                            )}
                            {v.autoCheckedOut && (
                              <span title="This visit was automatically checked out by the system after 9 hours of check-in with no manual checkout." className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-red-100 text-red-700 border border-red-200 cursor-help">
                                Auto Checked Out
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="crm-td">
                          {v.gpsLat != null ? (
                            <MapPin size={15} className={v.gpsAnomaly ? "text-amber-500" : "text-emerald-500"} />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="crm-td text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isPlannedToday && (
                              <div className="relative group">
                                <button
                                  onClick={() => !isCheckInTooLate && handleCheckIn(v.id)}
                                  disabled={isCheckInTooLate}
                                  className={cn(
                                    "px-2.5 py-1 text-white font-bold text-xs rounded-lg flex items-center gap-1",
                                    isCheckInTooLate
                                      ? "bg-amber-300 cursor-not-allowed"
                                      : "bg-amber-600 hover:bg-amber-700"
                                  )}
                                >
                                  <MapPin size={12} /> Check In
                                </button>
                                {checkInWindow && (
                                  <span className="absolute bottom-full right-0 mb-1 hidden group-hover:block w-56 px-2 py-1 text-xs text-white bg-slate-800 rounded-lg text-left">
                                    Check-in available from {formatDateTime(checkInWindow.start)} to {formatDateTime(checkInWindow.end)}
                                  </span>
                                )}
                              </div>
                            )}
                            {v.status === "CHECKED_IN" && (
                              <button
                                onClick={() => router.push(`/visits/${v.id}`)}
                                className="px-2.5 py-1 bg-teal-600 text-white font-bold text-xs rounded-lg hover:bg-teal-700"
                              >
                                Check Out
                              </button>
                            )}
                            {v.status === "CHECKED_OUT" && (
                              <button
                                onClick={() => router.push(`/visits/${v.id}`)}
                                className="px-2.5 py-1 bg-[var(--primary)] text-white font-bold text-xs rounded-lg hover:bg-[var(--primary-hover)]"
                              >
                                Complete
                              </button>
                            )}
                            {(v.status === "PLANNED" || v.status === "MISSED") && (
                              <button
                                onClick={() => router.push(`/visits/${v.id}`)}
                                className="px-2.5 py-1 bg-slate-50 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-100 border border-slate-200"
                              >
                                Reschedule
                              </button>
                            )}
                            <button
                              onClick={() => router.push(`/visits/${v.id}`)}
                              className="p-1.5 text-slate-400 hover:text-[var(--primary)] hover:bg-slate-50 rounded-lg transition-all"
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

      {/* Key Account Compliance Modal */}
      <Modal
        open={showCompliance}
        onClose={() => setShowCompliance(false)}
        title="Key Account Visit Compliance"
        subtitle="Key accounts not visited in 30+ days"
        size="lg"
        footer={
          <button onClick={() => setShowCompliance(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700">Close</button>
        }
      >
        <div className="p-4">
          {complianceLoading ? (
            <div className="text-center py-8 text-slate-400">Loading compliance data...</div>
          ) : complianceData.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No key accounts found.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left px-3 py-2 text-xs font-bold text-slate-600 uppercase">Account</th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-slate-600 uppercase">City</th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-slate-600 uppercase">Sales Owner</th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-slate-600 uppercase">Last Visit</th>
                  <th className="text-right px-3 py-2 text-xs font-bold text-slate-600 uppercase">Days Since</th>
                </tr>
              </thead>
              <tbody>
                {complianceData.map((c) => (
                  <tr key={c.accountId} className={cn("border-b border-slate-100", getComplianceColor(c.daysSinceVisit))}>
                    <td className="px-3 py-2.5 text-sm font-bold text-slate-800">{c.accountName}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-600">{c.city || "—"}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-600">{c.salesOwner}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-600">{c.lastVisitDate ? formatDate(c.lastVisitDate) : "Never"}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>
    </PageShell>
  );
}

export default function VisitsListPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[var(--primary)] animate-spin" /></div>}>
      <VisitsListContent />
    </Suspense>
  );
}
