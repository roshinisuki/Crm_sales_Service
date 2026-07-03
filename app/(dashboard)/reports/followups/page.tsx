"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/PageShell";
import PageContainer from "@/components/PageContainer";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { useToast } from "@/components/ToastProvider";
import { getUsersAction } from "@/app/actions/users";
import { Calendar, Clock, CheckCircle, AlertCircle, Download } from "lucide-react";
import { ReportFilterLayout, FilterField, filterInputClass } from "@/components/reports/ReportFilterLayout";
import ReportActions from "@/components/reports/ReportActions";
import { StatusBadge } from "@/components/ui/StatusBadge";

function FollowUpReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  // Filters State
  const [startDate, setStartDate] = useState(searchParams.get("startDate") || "");
  const [endDate, setEndDate] = useState(searchParams.get("endDate") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "All");
  const [assignedUserId, setAssignedUserId] = useState(searchParams.get("assignedUserId") || "All");

  // Options lists
  const [users, setUsers] = useState<any[]>([]);

  // Report Data State
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalFollowUps: 0,
    pendingCount: 0,
    completedCount: 0,
    overdueCount: 0
  });
  const [loading, setLoading] = useState(true);

  // Load users options
  useEffect(() => {
    async function loadOptions() {
      const uRes = await getUsersAction();
      if (uRes?.success && uRes.data) {
        setUsers(uRes.data.filter((u: any) => u.isActive));
      }
    }
    loadOptions();
  }, []);

  // Fetch report data
  const fetchReportData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (status && status !== "All") params.append("status", status);
      if (assignedUserId && assignedUserId !== "All") params.append("assignedUserId", assignedUserId);

      // Update URL search params
      router.push(`/reports/followups?${params.toString()}`);

      const response = await fetch(`/api/reports/followups?${params.toString()}`);
      const res = await response.json();

      if (res.success && res.data) {
        setFollowUps(res.data.followUps || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      } else {
        toast.error(res.message || "Failed to fetch report data");
      }
    } catch (err: any) {
      toast.error("Error loading report details");
    } finally {
      setLoading(false);
    }
  };

  // Run query on load/filter changes
  useEffect(() => {
    fetchReportData();
  }, [startDate, endDate, status, assignedUserId]);

  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    setStatus("All");
    setAssignedUserId("All");
    router.push("/reports/followups");
  };

  const handleExportCSV = () => {
    if (followUps.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = ["Customer/Lead Name", "Assigned To", "Due Date", "Status", "Priority", "Completed Date"];
    const rows = followUps.map(item => {
      const name = item.customer?.name || item.lead?.name || "—";
      const code = item.customer?.customerCode ? `(${item.customer.customerCode})` : item.lead?.leadCode ? `(${item.lead.leadCode})` : "";
      return [
        `${name} ${code}`.trim(),
        item.assignedUser?.name || "—",
        item.nextMeetingDate ? new Date(item.nextMeetingDate).toLocaleDateString() : "",
        item.status || "",
        item.priority || "Medium",
        item.completedAt ? new Date(item.completedAt).toLocaleDateString() : "—"
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `FollowUp_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV export download started");
  };

  return (
    <PageShell
      title="Follow-Up Report"
      subtitle="Summary metrics and operational details for customer and lead follow-ups"
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={followUps.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--primary)] text-white rounded-xl text-xs font-bold hover:bg-[var(--primary-hover)] transition-colors shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} /> Export to CSV
          </button>
          <ReportActions reportId="follow-ups" filters={{ startDate, endDate, status, assignedUserId }} />
        </div>
      }
    >
      <PageContainer className="space-y-6 pt-2">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="Total Follow-Ups"
            value={summary.totalFollowUps}
            icon={<Calendar size={20} />}
            variant="orange"
            subtitle="Overall scheduled tasks"
          />
          <SummaryCard
            label="Pending Count"
            value={summary.pendingCount}
            icon={<Clock size={20} />}
            variant="dark"
            subtitle="Upcoming touchpoints"
          />
          <SummaryCard
            label="Completed Count"
            value={summary.completedCount}
            icon={<CheckCircle size={20} />}
            variant="light"
            subtitle="Successfully closed"
          />
          <SummaryCard
            label="Overdue Count"
            value={summary.overdueCount}
            icon={<AlertCircle size={20} />}
            variant="light"
            subtitle="Action required"
          />
        </div>

        {/* Filters Panel */}
        <ReportFilterLayout
          title="Filter Follow-Up Report"
          onApply={fetchReportData}
          onReset={handleClearFilters}
          onRefresh={fetchReportData}
          applyLabel="Reload"
          resetLabel="Clear Filters"
          filters={[
            <FilterField label="Start Date" key="start">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={filterInputClass} />
            </FilterField>,
            <FilterField label="End Date" key="end">
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={filterInputClass} />
            </FilterField>,
            <FilterField label="Status" key="status">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={filterInputClass}>
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
                <option value="Overdue">Overdue</option>
              </select>
            </FilterField>,
            <FilterField label="Assigned User" key="assigned">
              <select value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)} className={filterInputClass}>
                <option value="All">All Users</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </FilterField>,
          ]}
        />

        {/* Report table */}
        <div className="crm-card overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="crm-table w-full text-left border-collapse">
              <thead>
                <tr className="crm-tr border-b border-slate-100 bg-slate-50/50">
                  <th className="crm-th px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Customer / Lead</th>
                  <th className="crm-th px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Assigned To</th>
                  <th className="crm-th px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Due Date</th>
                  <th className="crm-th px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                  <th className="crm-th px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Priority</th>
                  <th className="crm-th px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Completed Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400 text-xs">
                      Loading follow-up report details...
                    </td>
                  </tr>
                ) : followUps.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 text-xs">
                      No records match the current filters.
                    </td>
                  </tr>
                ) : (
                  followUps.map((item) => {
                    const name = item.customer?.name || item.lead?.name || "—";
                    const subtitle = item.customer?.customerCode ? `Cust: ${item.customer.customerCode}` : item.lead?.leadCode ? `Lead: ${item.lead.leadCode}` : "";
                    const isCompleted = item.status === "Completed";

                    return (
                      <tr key={item.id} className="crm-tr hover:bg-slate-50/40 transition-colors">
                        <td className="crm-td px-5 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 dark:text-[var(--text-primary)] text-sm block leading-tight">{name}</span>
                            {subtitle && <span className="text-[10px] text-slate-400 dark:text-[var(--text-muted)] font-bold mt-0.5">{subtitle}</span>}
                          </div>
                        </td>
                        <td className="crm-td px-5 py-4 font-medium text-slate-600 dark:text-[var(--text-secondary)]">{item.assignedUser?.name || "—"}</td>
                        <td className="crm-td px-5 py-4 text-slate-600 dark:text-[var(--text-secondary)] text-xs">
                          {item.nextMeetingDate ? new Date(item.nextMeetingDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric"
                          }) : "No due date"}
                        </td>
                        <td className="crm-td px-5 py-4">
                          <StatusBadge status={item.status || "Pending"} />
                        </td>
                        <td className="crm-td px-5 py-4">
                          <StatusBadge status={item.priority || "Medium"} />
                        </td>
                        <td className="crm-td px-5 py-4 text-slate-600 dark:text-[var(--text-secondary)] text-xs">
                          {isCompleted && item.completedAt ? new Date(item.completedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric"
                          }) : "—"}
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
    </PageShell>
  );
}

export default function FollowUpReportPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
      </div>
    }>
      <FollowUpReportContent />
    </Suspense>
  );
}
