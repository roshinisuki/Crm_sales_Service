"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { 
  FileSpreadsheet, Filter, Search, Download, RefreshCw, 
  BarChart, PieChart, Users, Settings, Wrench, HardDrive 
} from "lucide-react";
import { cn } from "@/lib/ui-utils";

type ReportType = 
  | "requests" 
  | "complaints" 
  | "defects" 
  | "installations" 
  | "warranty" 
  | "engineer";

import { mockRequests, mockComplaints, mockDefects, mockInstallations } from "@/lib/config/serviceSeedMockData";

const mockReportsData: Record<ReportType, any[]> = {
  requests: mockRequests.map(r => ({
    code: r.requestCode,
    subject: r.title,
    customer: r.customer.name,
    status: r.status,
    date: r.createdAt.substring(0, 10),
    priority: r.priority
  })),
  complaints: mockComplaints.map(c => ({
    code: c.complaintCode,
    type: c.complaintType.name,
    customer: c.customer.name,
    status: c.status,
    date: c.createdAt.substring(0, 10),
    severity: c.severity
  })),
  defects: mockDefects.map(d => ({
    code: d.defectCode,
    defect: d.description,
    asset: d.asset.productName,
    status: d.status,
    date: d.createdAt.substring(0, 10)
  })),
  installations: mockInstallations.map(i => ({
    code: i.installationCode,
    customer: i.customer.name,
    asset: i.asset.productName,
    status: i.status,
    date: i.createdAt.substring(0, 10)
  })),
  warranty: [
    { serial: "SN-2026001", product: "Air Compressor AC-400", customer: "Apex Engineering Solutions", status: "Active", warrantyEnd: "2027-01-15", amcEnd: "2028-01-15" },
    { serial: "SN-2026002", product: "Hydraulic Press Pump H-200", customer: "Vertex Manufacturing Corp", status: "Active", warrantyEnd: "2027-02-18", amcEnd: "N/A" },
    { serial: "SN-2026003", product: "Electronic Control Panel CP-80", customer: "Tata Motors Ltd.", status: "Expired", warrantyEnd: "2025-06-10", amcEnd: "2026-06-10" }
  ],
  engineer: [
    { name: "System Admin", team: "Field Service Team North", assigned: 5, resolved: 4, slaMet: "100%" },
    { name: "Vikram Iyer", team: "Field Service Team South", assigned: 3, resolved: 2, slaMet: "95%" },
    { name: "Arjun Mehta", team: "Installation Team", assigned: 6, resolved: 5, slaMet: "98%" },
    { name: "Priya Nair", team: "AMC Support Team", assigned: 4, resolved: 4, slaMet: "100%" }
  ]
};

export default function ServiceReportsPage() {
  const searchParams = useSearchParams();
  const reportParam = searchParams?.get("report");
  const [reportType, setReportType] = useState<ReportType>("requests");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");

  useEffect(() => {
    if (reportParam && ["requests", "complaints", "defects", "installations", "warranty", "engineer"].includes(reportParam)) {
      setReportType(reportParam as ReportType);
    }
  }, [reportParam]);

  const handleExport = () => {
    alert(`Exporting ${reportType} report data to Excel/CSV format...`);
  };

  const getColumns = (): ColumnDef<any>[] => {
    switch (reportType) {
      case "requests":
        return [
          { header: "Request Code", accessorKey: "code" },
          { header: "Subject", accessorKey: "subject" },
          { header: "Customer", accessorKey: "customer" },
          { header: "Date", accessorKey: "date" },
          { header: "Priority", accessorKey: "priority" },
          { header: "Status", accessorKey: "status" }
        ];
      case "complaints":
        return [
          { header: "Complaint Code", accessorKey: "code" },
          { header: "Type", accessorKey: "type" },
          { header: "Customer", accessorKey: "customer" },
          { header: "Severity", accessorKey: "severity" },
          { header: "Date", accessorKey: "date" },
          { header: "Status", accessorKey: "status" }
        ];
      case "defects":
        return [
          { header: "Defect Code", accessorKey: "code" },
          { header: "Defect details", accessorKey: "defect" },
          { header: "Asset Context", accessorKey: "asset" },
          { header: "Reported Date", accessorKey: "date" },
          { header: "Status", accessorKey: "status" }
        ];
      case "installations":
        return [
          { header: "Commission Code", accessorKey: "code" },
          { header: "Customer", accessorKey: "customer" },
          { header: "Equipment", accessorKey: "asset" },
          { header: "Scheduled Date", accessorKey: "date" },
          { header: "Status", accessorKey: "status" }
        ];
      case "warranty":
        return [
          { header: "Serial Number", accessorKey: "serial" },
          { header: "Equipment Model", accessorKey: "product" },
          { header: "Customer Name", accessorKey: "customer" },
          { header: "Coverage Status", accessorKey: "status" },
          { header: "Warranty Expiry", accessorKey: "warrantyEnd" },
          { header: "AMC Expiry", accessorKey: "amcEnd" }
        ];
      case "engineer":
        return [
          { header: "Field Engineer", accessorKey: "name" },
          { header: "Assigned Team", accessorKey: "team" },
          { header: "Total Tasks Assigned", accessorKey: "assigned" },
          { header: "Completed/Resolved", accessorKey: "resolved" },
          { header: "SLA Met Rate", accessorKey: "slaMet" }
        ];
    }
  };

  const reportOptions: { value: ReportType; label: string }[] = [
    { value: "requests", label: "Service Request Report" },
    { value: "complaints", label: "Customer Complaint Report" },
    { value: "defects", label: "Product Defect Report" },
    { value: "installations", label: "Installation & Commissioning Report" },
    { value: "warranty", label: "Warranty & AMC Coverage Report" },
    { value: "engineer", label: "Engineer Performance Report" }
  ];

  const currentData = mockReportsData[reportType] || [];
  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-[var(--text-primary)]">Service Workspace Analytics & Reports</h1>
          <p className="text-xs text-[var(--text-muted)]">Analyze operational workloads, response compliance, and equipment failure metrics.</p>
        </div>

        <button 
          onClick={handleExport}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-hover text-white font-bold rounded-lg text-xs transition-colors"
        >
          <Download size={14} /> Export Report
        </button>
      </div>

      {/* Filter / Query Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl backdrop-blur-md">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-1">Select Report Type</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors"
          >
            {reportOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-1 font-semibold">Status Filter</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active / Open</option>
            <option value="Closed">Closed / Completed</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-1 font-semibold">Refine Search</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input 
              type="text" 
              placeholder="Search reports by customer, code, product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors placeholder-[var(--text-muted)]"
            />
          </div>
        </div>
      </div>

      {/* Report Data Table */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden backdrop-blur-md">
        <DataTable data={currentData} columns={getColumns()} />
      </div>
    </div>
  );
}
