"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/PageShell";
import PageContainer from "@/components/PageContainer";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { useToast } from "@/components/ToastProvider";
import { getUsersAction } from "@/app/actions/users";
import { getLeadSourcesAction } from "@/app/actions/leadSources";
import { BarChart3, Clock, CheckCircle, AlertCircle, Download, RefreshCw, FileText } from "lucide-react";

function LeadReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  // Filters State
  const [startDate, setStartDate] = useState(searchParams.get("startDate") || "");
  const [endDate, setEndDate] = useState(searchParams.get("endDate") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "All");
  const [leadSource, setLeadSource] = useState(searchParams.get("leadSource") || "All");
  const [assignedUserId, setAssignedUserId] = useState(searchParams.get("assignedUserId") || "All");

  // Options lists
  const [users, setUsers] = useState<any[]>([]);
  const [leadSources, setLeadSources] = useState<any[]>([]);

  // Report Data State
  const [leads, setLeads] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalLeads: 0,
    newLeadsThisMonth: 0,
    sqlCount: 0,
    lostLeadsCount: 0
  });
  const [loading, setLoading] = useState(true);

  // Load select options
  useEffect(() => {
    async function loadOptions() {
      const [uRes, lsRes] = await Promise.all([
        getUsersAction(),
        getLeadSourcesAction()
      ]);
      if (uRes?.success && uRes.data) {
        setUsers(uRes.data.filter((u: any) => u.isActive));
      }
      if (lsRes?.success && lsRes.data) {
        setLeadSources(lsRes.data);
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
      if (leadSource && leadSource !== "All") params.append("leadSource", leadSource);
      if (assignedUserId && assignedUserId !== "All") params.append("assignedUserId", assignedUserId);

      // Update URL search params
      router.push(`/reports/leads?${params.toString()}`);

      const response = await fetch(`/api/reports/leads?${params.toString()}`);
      const res = await response.json();

      if (res.success && res.data) {
        setLeads(res.data.leads || []);
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
  }, [startDate, endDate, status, leadSource, assignedUserId]);

  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    setStatus("All");
    setLeadSource("All");
    setAssignedUserId("All");
    router.push("/reports/leads");
  };

  const handleExportCSV = () => {
    if (leads.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = ["Lead Code", "Name", "Status", "Source", "Assigned To", "Created Date", "Last Interaction"];
    const rows = leads.map(item => [
      item.leadCode || "",
      item.name || "",
      item.status || "",
      item.leadSource || "",
      item.assignedUser?.name || "Unassigned",
      item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "",
      item.lastInteractionAt ? new Date(item.lastInteractionAt).toLocaleDateString() : ""
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Lead_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV export download started");
  };

  return (
    <PageShell
      title="Lead Report"
      subtitle="Summary metrics and operational details for marketing leads"
      action={
        <button
          onClick={handleExportCSV}
          disabled={leads.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={14} /> Export to CSV
        </button>
      }
    >
      <PageContainer className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="Total Leads"
            value={summary.totalLeads}
            icon={<FileText size={20} />}
            variant="orange"
            subtitle="Overall pipeline leads"
          />
          <SummaryCard
            label="New This Month"
            value={summary.newLeadsThisMonth}
            icon={<Clock size={20} />}
            variant="dark"
            subtitle="Created in current month"
          />
          <SummaryCard
            label="SQL Count"
            value={summary.sqlCount}
            icon={<CheckCircle size={20} />}
            variant="light"
            subtitle="Sales Qualified Leads"
          />
          <SummaryCard
            label="Lost Leads"
            value={summary.lostLeadsCount}
            icon={<AlertCircle size={20} />}
            variant="light"
            subtitle="Unconverted / Lost"
          />
        </div>

        {/* Filters Panel */}
        <div className="crm-card p-5 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Filter Lead Report</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-750 bg-slate-50 focus:outline-none cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-750 bg-slate-50 focus:outline-none cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 cursor-pointer focus:outline-none hover:bg-slate-100/60 transition-colors"
              >
                <option value="All">All Statuses</option>
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Qualified">Qualified</option>
                <option value="Proposal">Proposal</option>
                <option value="Negotiation">Negotiation</option>
                <option value="Won">Won</option>
                <option value="Lost">Lost</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Lead Source</label>
              <select
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 cursor-pointer focus:outline-none hover:bg-slate-100/60 transition-colors"
              >
                <option value="All">All Sources</option>
                {leadSources.map(src => (
                  <option key={src.id} value={src.name}>{src.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Assigned User</label>
              <select
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 cursor-pointer focus:outline-none hover:bg-slate-100/60 transition-colors"
              >
                <option value="All">All Users</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer border border-slate-250"
            >
              Clear Filters
            </button>
            <button
              onClick={fetchReportData}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#C2601A] rounded-xl hover:bg-[#A84F16] transition-colors cursor-pointer"
            >
              <RefreshCw size={12} /> Reload
            </button>
          </div>
        </div>

        {/* Lead report table */}
        <div className="crm-card overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="crm-table w-full text-left border-collapse">
              <thead>
                <tr className="crm-tr border-b border-slate-100 bg-slate-50/50">
                  <th className="crm-th px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Lead Code</th>
                  <th className="crm-th px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Name</th>
                  <th className="crm-th px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                  <th className="crm-th px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Source</th>
                  <th className="crm-th px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Assigned To</th>
                  <th className="crm-th px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Created Date</th>
                  <th className="crm-th px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Last Interaction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400 text-xs">
                      Loading lead report details...
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400 text-xs">
                      No records match the current filters.
                    </td>
                  </tr>
                ) : (
                  leads.map((item) => (
                    <tr key={item.id} className="crm-tr hover:bg-slate-50/40 transition-colors">
                      <td className="crm-td px-5 py-4 font-mono font-bold text-slate-600 text-xs">{item.leadCode}</td>
                      <td className="crm-td px-5 py-4 font-bold text-slate-800 text-sm">{item.name}</td>
                      <td className="crm-td px-5 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          item.status === "Won"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : item.status === "Lost"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="crm-td px-5 py-4 font-medium text-slate-500 text-xs">{item.leadSource}</td>
                      <td className="crm-td px-5 py-4 font-medium text-slate-600">{item.assignedUser?.name || "Unassigned"}</td>
                      <td className="crm-td px-5 py-4 text-slate-500 text-xs">
                        {new Date(item.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })}
                      </td>
                      <td className="crm-td px-5 py-4 text-slate-500 text-xs">
                        {item.lastInteractionAt ? new Date(item.lastInteractionAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        }) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PageContainer>
    </PageShell>
  );
}

export default function LeadReportPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
      </div>
    }>
      <LeadReportContent />
    </Suspense>
  );
}
