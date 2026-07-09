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

export default function ServiceReportsPage() {
  const searchParams = useSearchParams();
  const reportParam = searchParams?.get("report");
  
  const [reportType, setReportType] = useState<ReportType>("requests");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");

  const [data, setData] = useState<Record<ReportType, any[]>>({
    requests: [],
    complaints: [],
    defects: [],
    installations: [],
    warranty: [],
    engineer: [] // Keep empty or mock if backend isn't ready for engineer aggregation
  });
  const [loading, setLoading] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [reqs, comps, defs, insts, wars, amcs] = await Promise.all([
        fetch("/api/service/requests").then(r => r.ok ? r.json() : []),
        fetch("/api/service/complaints").then(r => r.ok ? r.json() : []),
        fetch("/api/service/defects").then(r => r.ok ? r.json() : []),
        fetch("/api/service/installations").then(r => r.ok ? r.json() : []),
        fetch("/api/service/warranty-claims").then(r => r.ok ? r.json() : []),
        fetch("/api/service/amc-contracts").then(r => r.ok ? r.json() : []),
      ]);

      const mappedWarranty = [
        ...wars.map((w: any) => ({
          type: "Warranty",
          serial: w.customerAsset?.serialNumber || "-",
          product: w.customerAsset?.productName || "-",
          customer: w.customer?.name || "-",
          status: w.status?.name || "-",
          endDate: w.customerAsset?.warrantyExpiryDate
        })),
        ...amcs.map((a: any) => ({
          type: "AMC",
          serial: a.customerAsset?.serialNumber || "-",
          product: a.customerAsset?.productName || "-",
          customer: a.customer?.name || "-",
          status: a.status?.name || "-",
          endDate: a.endDate
        }))
      ];

      setData({
        requests: reqs.map((r: any) => ({
          code: r.id.split("-")[0],
          subject: r.title,
          customer: r.customer?.name,
          status: r.status?.name,
          date: r.createdAt?.substring(0, 10),
          priority: r.priority?.name || "Medium"
        })),
        complaints: comps.map((c: any) => ({
          code: c.id.split("-")[0],
          type: c.complaintType?.name || "-",
          customer: c.customer?.name,
          status: c.status?.name,
          date: c.createdAt?.substring(0, 10),
          severity: c.priority?.name || "Medium"
        })),
        defects: defs.map((d: any) => ({
          code: d.id.split("-")[0],
          defect: d.title,
          asset: d.customerAsset?.productName || "-",
          status: d.status?.name,
          date: d.createdAt?.substring(0, 10)
        })),
        installations: insts.map((i: any) => ({
          code: i.id.split("-")[0],
          customer: i.customer?.name,
          asset: i.customerAsset?.productName || "-",
          status: i.status?.name,
          date: i.createdAt?.substring(0, 10)
        })),
        warranty: mappedWarranty,
        engineer: []
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

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
          { header: "Request Code", accessorKey: "code", cell: (r) => <span className="font-mono text-[10px]">{r.code}</span> },
          { header: "Subject", accessorKey: "subject" },
          { header: "Customer", accessorKey: "customer" },
          { header: "Date", accessorKey: "date" },
          { header: "Priority", accessorKey: "priority" },
          { header: "Status", accessorKey: "status" }
        ];
      case "complaints":
        return [
          { header: "Complaint Code", accessorKey: "code", cell: (r) => <span className="font-mono text-[10px]">{r.code}</span> },
          { header: "Type", accessorKey: "type" },
          { header: "Customer", accessorKey: "customer" },
          { header: "Severity", accessorKey: "severity" },
          { header: "Date", accessorKey: "date" },
          { header: "Status", accessorKey: "status" }
        ];
      case "defects":
        return [
          { header: "Defect Code", accessorKey: "code", cell: (r) => <span className="font-mono text-[10px]">{r.code}</span> },
          { header: "Defect", accessorKey: "defect" },
          { header: "Asset", accessorKey: "asset" },
          { header: "Date", accessorKey: "date" },
          { header: "Status", accessorKey: "status" }
        ];
      case "installations":
        return [
          { header: "Installation Code", accessorKey: "code", cell: (r) => <span className="font-mono text-[10px]">{r.code}</span> },
          { header: "Customer", accessorKey: "customer" },
          { header: "Asset", accessorKey: "asset" },
          { header: "Date", accessorKey: "date" },
          { header: "Status", accessorKey: "status" }
        ];
      case "warranty":
        return [
          { header: "Type", accessorKey: "type" },
          { header: "Serial Number", accessorKey: "serial", cell: (r) => <span className="font-mono text-[10px]">{r.serial}</span> },
          { header: "Product", accessorKey: "product" },
          { header: "Customer", accessorKey: "customer" },
          { header: "End Date", accessorKey: "endDate", cell: (r) => <span>{r.endDate ? new Date(r.endDate).toLocaleDateString() : "-"}</span> },
          { header: "Status", accessorKey: "status" }
        ];
      case "engineer":
        return [
          { header: "Engineer Name", accessorKey: "name" },
          { header: "Team", accessorKey: "team" },
          { header: "Assigned Tickets", accessorKey: "assigned" },
          { header: "Resolved Tickets", accessorKey: "resolved" },
          { header: "SLA Met Rate", accessorKey: "slaMet" }
        ];
    }
  };

  const currentData = data[reportType] || [];
  
  const filteredData = currentData.filter(item => {
    let matchesSearch = true;
    let matchesStatus = true;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      matchesSearch = Object.values(item).some(val => 
        String(val).toLowerCase().includes(q)
      );
    }

    if (selectedStatus !== "All") {
      matchesStatus = item.status === selectedStatus;
    }

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-[var(--text-primary)]">Service Reports & Analytics</h1>
          <p className="text-xs text-[var(--text-muted)]">Generate cross-module insights, SLA tracking, and engineer performance metrics.</p>
        </div>
        <button 
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-colors shadow-sm"
        >
          <Download size={14} /> Export Report
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="w-full lg:w-64 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 space-y-1 backdrop-blur-md">
          <h3 className="px-3.5 pb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)] mb-2">
            Report Types
          </h3>
          {[
            { id: "requests", label: "Service Requests", icon: <FileSpreadsheet size={15} /> },
            { id: "complaints", label: "Complaints", icon: <BarChart size={15} /> },
            { id: "defects", label: "Product Defects", icon: <PieChart size={15} /> },
            { id: "installations", label: "Installations", icon: <Wrench size={15} /> },
            { id: "warranty", label: "Warranty & AMC", icon: <HardDrive size={15} /> },
            { id: "engineer", label: "Engineer Performance", icon: <Users size={15} /> }
          ].map(rt => (
            <button
              key={rt.id}
              onClick={() => setReportType(rt.id as ReportType)}
              className={cn(
                "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all text-left",
                reportType === rt.id 
                  ? "bg-[var(--surface-2)] text-[var(--text-primary)] border border-[var(--border)] shadow-sm" 
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] border border-transparent"
              )}
            >
              {rt.icon}
              {rt.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-0 space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 backdrop-blur-md flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                <input 
                  type="text" 
                  placeholder="Search in report..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors placeholder-[var(--text-muted)]"
                />
              </div>
              <div className="relative">
                <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="pl-9 pr-8 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  <option value="New">New</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Active">Active</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>
            </div>
            
            <button 
              onClick={fetchReports}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh Data
            </button>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden backdrop-blur-md">
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center text-[var(--text-muted)] gap-3">
                <RefreshCw size={24} className="animate-spin text-blue-500" />
                <span className="text-sm font-semibold">Generating Report...</span>
              </div>
            ) : filteredData.length > 0 ? (
              <DataTable data={filteredData} columns={getColumns()} />
            ) : (
              <div className="p-12 text-center text-sm font-semibold text-[var(--text-muted)] border-t border-[var(--border)]">
                No data found for this report with current filters.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
