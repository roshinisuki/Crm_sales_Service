"use client";

import React, { useState } from "react";
import { ServiceKpiCard, ServiceQueueCard, SLACountdownBadge } from "@/components/shared/ServiceComponents";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { 
  Inbox, FileText, CheckCircle, Clock, AlertTriangle, 
  TrendingUp, Calendar, ClipboardList, Activity 
} from "lucide-react";
import { cn } from "@/lib/ui-utils";

import { mockRequests, mockVisits, mockComplaints } from "@/lib/config/serviceSeedMockData";

export default function MyServiceDashboardPage() {
  const [requests] = useState<any[]>(mockRequests);
  const [visits] = useState<any[]>(mockVisits);
  const [complaints] = useState<any[]>(mockComplaints);

  const requestColumns: ColumnDef<any>[] = [
    { header: "Code", accessorKey: "requestCode" },
    { header: "Subject", accessorKey: "title" },
    { header: "Customer", cell: (row) => <span>{row.customer.name}</span> },
    { 
      header: "SLA", 
      cell: (row) => <SLACountdownBadge dueDate={row.dueDate} status={row.status} /> 
    },
    { 
      header: "Status", 
      cell: (row) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-blue-500/10 text-blue-500 border-blue-500/20">
          {row.status}
        </span>
      )
    }
  ];

  const visitColumns: ColumnDef<any>[] = [
    { header: "Time", cell: (row) => <span>{new Date(row.visitDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span> },
    { header: "Customer", cell: (row) => <span>{row.customer.name}</span> },
    { header: "Notes", accessorKey: "notes" },
  ];
  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-black text-[var(--text-primary)]">My Service Workspace Dashboard</h1>
        <p className="text-xs text-[var(--text-muted)]">Manage your daily field schedules, open tickets, and SLA responses.</p>
      </div>

      {/* KPI Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ServiceKpiCard 
          title="Assigned Requests" 
          value={requests.length} 
          change="2 new" 
          isPositive={false} 
          icon={<Inbox size={18} />} 
        />
        <ServiceKpiCard 
          title="Today's Visits" 
          value={visits.length} 
          change="1 scheduled" 
          isPositive={true} 
          icon={<Calendar size={18} />} 
        />
        <ServiceKpiCard 
          title="Open Complaints" 
          value={complaints.length} 
          change="0 new" 
          isPositive={true} 
          icon={<AlertTriangle size={18} />} 
        />
        <ServiceKpiCard 
          title="SLA Met Rate" 
          value="98.2%" 
          change="+1.5%" 
          isPositive={true} 
          icon={<TrendingUp size={18} />} 
        />
      </div>

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
              <DataTable data={requests} columns={requestColumns} />
            </div>
          </div>

          {/* Scheduled Visits for Today */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4.5 space-y-3.5 backdrop-blur-md">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
              <Calendar size={16} className="text-green-400" /> Today's Field Visits
            </h3>
            <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)]">
              <DataTable data={visits} columns={visitColumns} />
            </div>
          </div>
        </div>

        {/* Right timeline / alerts */}
        <div className="space-y-6">
          {/* Urgent Alerts panel */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4.5 space-y-3.5 backdrop-blur-md">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
              <Activity size={16} className="text-red-400" /> Urgent Alerts
            </h3>
            <div className="space-y-3">
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs space-y-1 text-red-500">
                <span className="font-bold uppercase tracking-wide block">SLA Warning</span>
                <p className="opacity-90 text-[var(--text-secondary)]">Request REQ-2026-001 is within 2 hours of SLA resolution limit.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
