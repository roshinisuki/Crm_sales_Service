"use client";

import React, { useState, useEffect } from "react";
import { ServiceKpiCard, ServiceQueueCard, SLACountdownBadge } from "@/components/shared/ServiceComponents";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { 
  Inbox, FileText, CheckCircle, Clock, AlertTriangle, 
  TrendingUp, Calendar, ClipboardList, Activity 
} from "lucide-react";
import { cn } from "@/lib/ui-utils";

export default function MyServiceDashboardPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [reqsRes, visitsRes, compRes] = await Promise.all([
          fetch("/api/service/requests"),
          fetch("/api/service/visits"),
          fetch("/api/service/complaints")
        ]);

        if (reqsRes.ok) setRequests(await reqsRes.json());
        if (visitsRes.ok) setVisits(await visitsRes.json());
        if (compRes.ok) setComplaints(await compRes.json());
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const requestColumns: ColumnDef<any>[] = [
    { header: "Code", accessorKey: "id", cell: (row) => <span className="font-mono text-[10px]">{row.id.split("-")[0]}</span> },
    { header: "Subject", accessorKey: "title" },
    { header: "Customer", cell: (row) => <span>{row.customer?.name || "Unknown"}</span> },
    { 
      header: "SLA", 
      cell: (row) => <SLACountdownBadge dueDate={row.createdAt} status={row.status?.name || "New"} /> 
    },
    { 
      header: "Status", 
      cell: (row) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-blue-500/10 text-blue-500 border-blue-500/20">
          {row.status?.name || "Unknown"}
        </span>
      )
    }
  ];

  const visitColumns: ColumnDef<any>[] = [
    { header: "Time", cell: (row) => <span>{row.scheduledDate ? new Date(row.scheduledDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "-"}</span> },
    { header: "Status", cell: (row) => <span>{row.status?.name || "Planned"}</span> },
    { header: "Notes", accessorKey: "notes", cell: (row) => <span>{row.notes || "-"}</span> },
  ];
  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-black text-[var(--text-primary)]">My Service Workspace Dashboard</h1>
        <p className="text-xs text-[var(--text-muted)]">Manage your daily field schedules, open tickets, and SLA responses.</p>
      </div>

      {/* KPI Indicators */}
      {loading ? (
        <div className="p-4 text-center text-sm text-[var(--text-muted)] animate-pulse">Loading KPIs...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <ServiceKpiCard 
            title="Assigned Requests" 
            value={requests.length} 
            change="" 
            isPositive={true} 
            icon={<Inbox size={18} />} 
          />
          <ServiceKpiCard 
            title="Today's Visits" 
            value={visits.length} 
            change="" 
            isPositive={true} 
            icon={<Calendar size={18} />} 
          />
          <ServiceKpiCard 
            title="Open Complaints" 
            value={complaints.length} 
            change="" 
            isPositive={true} 
            icon={<AlertTriangle size={18} />} 
          />
          <ServiceKpiCard 
            title="SLA Met Rate" 
            value="N/A" 
            change="Computed" 
            isPositive={true} 
            icon={<TrendingUp size={18} />} 
          />
        </div>
      )}

      {/* Dashboard Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left lists */}
        <div className="lg:col-span-2 space-y-6">
          {/* Assigned Requests list */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4.5 space-y-3.5 backdrop-blur-md">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
              <ClipboardList size={16} className="text-blue-400" /> My Assigned Requests
            </h3>
            <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)]">
              {loading ? (
                <div className="p-4 text-center text-xs text-[var(--text-muted)] animate-pulse">Loading...</div>
              ) : (
                <DataTable data={requests.slice(0, 5)} columns={requestColumns} />
              )}
            </div>
          </div>

          {/* Scheduled Visits for Today */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4.5 space-y-3.5 backdrop-blur-md">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
              <Calendar size={16} className="text-green-400" /> Recent Field Visits
            </h3>
            <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)]">
              {loading ? (
                <div className="p-4 text-center text-xs text-[var(--text-muted)] animate-pulse">Loading...</div>
              ) : (
                <DataTable data={visits.slice(0, 5)} columns={visitColumns} />
              )}
            </div>
          </div>
        </div>

        {/* Right side: Activity / Queue */}
        <div className="space-y-6">
          <ServiceQueueCard 
            title="Urgent Complaints Queue"
            count={complaints.filter(c => c.priority?.name === "High").length}
            icon={<AlertTriangle size={18} />}
          />
          <ServiceQueueCard 
            title="Pending Escalations"
            count={0}
            icon={<Activity size={18} />}
          />
        </div>
      </div>
    </div>
  );
}
