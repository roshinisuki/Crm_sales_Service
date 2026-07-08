"use client";

import React, { useState } from "react";
import { ServiceKpiCard, ServiceQueueCard } from "@/components/shared/ServiceComponents";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { 
  Users, BarChart2, CheckCircle2, ShieldAlert, 
  HelpCircle, Sparkles, AlertTriangle, Hammer, Inbox 
} from "lucide-react";
import { cn } from "@/lib/ui-utils";
import { mockRequests, mockComplaints, mockInstallations } from "@/lib/config/serviceSeedMockData";

// Derived engineer workload status from seed data
const mockWorkloads = [
  { id: "e-1", name: "System Admin", team: "Field Service Team North", openCount: 1, status: "Available" },
  { id: "e-2", name: "Vikram Iyer", team: "Field Service Team South", openCount: 1, status: "Available" },
  { id: "e-3", name: "Arjun Mehta", team: "Installation Team", openCount: 2, status: "High Load" },
  { id: "e-4", name: "Priya Nair", team: "AMC Support Team", openCount: 2, status: "High Load" },
  { id: "e-5", name: "Karthik Reddy", team: "Warranty Resolution Team", openCount: 1, status: "Available" },
  { id: "e-6", name: "Deepa Krishnan", team: "Escalation Desk", openCount: 1, status: "Available" }
];

export default function ManagerServiceDashboardPage() {
  const [workloads] = useState<any[]>(mockWorkloads);

  const workloadColumns: ColumnDef<any>[] = [
    { header: "Engineer", accessorKey: "name" },
    { header: "Specialized Team", accessorKey: "team" },
    { header: "Open Assignments", accessorKey: "openCount" },
    { 
      header: "Status", 
      cell: (row) => (
        <span className={cn(
          "px-2 py-0.5 rounded-full text-[10px] font-bold border",
          row.status === "High Load" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-green-500/10 text-green-500 border-green-500/20"
        )}>
          {row.status}
        </span>
      )
    }
  ];

  const openBacklog = mockRequests.filter(r => r.status !== "Closed").length;
  const criticalBacklog = mockRequests.filter(r => r.priority === "Critical" && r.status !== "Closed").length;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-black text-[var(--text-primary)]">Service Operations Manager Dashboard</h1>
        <p className="text-xs text-[var(--text-muted)]">Oversee team workloads, service contracts, and SLA compliance metrics.</p>
      </div>

      {/* KPI summaries */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ServiceKpiCard 
          title="Team Open Backlog" 
          value={`${openBacklog} Requests`} 
          change="3 new today" 
          isPositive={false} 
          icon={<Inbox size={18} />} 
        />
        <ServiceKpiCard 
          title="SLA Compliance Rate" 
          value="98.2%" 
          change="+1.5%" 
          isPositive={true} 
          icon={<CheckCircle2 size={18} />} 
        />
        <ServiceKpiCard 
          title="Escalated Tickets" 
          value={`${criticalBacklog}`} 
          change="0 unresolved" 
          isPositive={criticalBacklog === 0} 
          icon={<ShieldAlert size={18} />} 
        />
        <ServiceKpiCard 
          title="Active Field Engineers" 
          value="18 Registered" 
          change="6 Allocated" 
          isPositive={true} 
          icon={<Users size={18} />} 
        />
      </div>

      {/* Operations Queue Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">Operational Queue Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ServiceQueueCard 
            title="Service Requests" 
            count={mockRequests.length} 
            icon={<Inbox size={20} className="text-blue-400" />} 
          />
          <ServiceQueueCard 
            title="Pneumatic Complaints" 
            count={mockComplaints.length} 
            icon={<AlertTriangle size={20} className="text-amber-400" />} 
          />
          <ServiceQueueCard 
            title="Pending Installations" 
            count={mockInstallations.length} 
            icon={<Hammer size={20} className="text-green-400" />} 
          />
        </div>
      </div>

      {/* Detailed Workload panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Workloads */}
        <div className="lg:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4.5 space-y-3.5 backdrop-blur-md">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
            Engineer Workload & Allocation
          </h3>
          <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)]">
            <DataTable data={workloads} columns={workloadColumns} />
          </div>
        </div>

        {/* Right Side: Escalations Alerts */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4.5 space-y-3.5 backdrop-blur-md">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
            Escalation Monitor
          </h3>
          <div className="space-y-3">
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs space-y-1 text-red-500 animate-pulse">
              <span className="font-bold uppercase tracking-wide block">Level 1 Escalation: Deepa Krishnan</span>
              <p className="opacity-90 text-[var(--text-secondary)]">SLA warning warning detected on Critical Request REQ-2026-005 (Ashok Leyland).</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
