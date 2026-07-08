"use client";

import React, { useState } from "react";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { WarrantyAMCContextCard, AssetHistoryPanel } from "@/components/shared/ServiceComponents";
import { Search, Plus, Filter, HardDrive, RefreshCw } from "lucide-react";
import { cn } from "@/lib/ui-utils";

// Mock customer assets data
const mockAssets: any[] = [
  {
    id: "asset-1",
    serialNumber: "SN-98273-A",
    productName: "Heavy Duty Air Compressor v4",
    customer: { name: "Apex Engineering Solutions" },
    purchaseDate: "2025-01-15",
    warrantyExpiryDate: "2027-01-15",
    amcExpiryDate: "2028-01-15",
    status: "Active",
    history: [
      { id: "h-1", type: "Installation", description: "Completed initial commissioning and load testing.", date: "2025-01-16", engineerName: "Ramesh Sharma" },
      { id: "h-2", type: "Preventative Maintenance", description: "Replaced air filters and check lubrication.", date: "2025-06-15", engineerName: "Suresh Patel" }
    ]
  },
  {
    id: "asset-2",
    serialNumber: "SN-10293-B",
    productName: "Hydraulic Press Pump H-200",
    customer: { name: "Vertex Manufacturing Corp" },
    purchaseDate: "2024-05-10",
    warrantyExpiryDate: "2025-05-10",
    amcExpiryDate: "2026-05-10",
    status: "Active",
    history: [
      { id: "h-3", type: "Installation", description: "Commissioned hydraulic lines and calibrated pressure sensors.", date: "2024-05-12", engineerName: "Suresh Patel" },
      { id: "h-4", type: "Repair", description: "Fixed oil valve gasket leak.", date: "2026-07-08", engineerName: "Ramesh Sharma" }
    ]
  },
  {
    id: "asset-3",
    serialNumber: "SN-44392-C",
    productName: "Pneumatic Valve Module X-100",
    customer: { name: "Aero Engine Corp" },
    purchaseDate: "2024-03-12",
    warrantyExpiryDate: "2025-03-12",
    amcExpiryDate: "2024-03-12",
    status: "Expired",
    history: [
      { id: "h-5", type: "Installation", description: "Installed valve assembly.", date: "2024-03-15", engineerName: "Unassigned" }
    ]
  }
];

export default function CustomerAssetsPage() {
  const [data, setData] = useState<any[]>(mockAssets);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const filteredData = data.filter(item => {
    if (statusFilter !== "All" && item.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const serialMatch = item.serialNumber.toLowerCase().includes(q);
      const nameMatch = item.productName.toLowerCase().includes(q);
      const customerMatch = item.customer.name.toLowerCase().includes(q);
      if (!serialMatch && !nameMatch && !customerMatch) return false;
    }
    return true;
  });

  const columns: ColumnDef<any>[] = [
    { header: "Serial Number", accessorKey: "serialNumber" },
    { header: "Product Name", accessorKey: "productName" },
    { header: "Customer", cell: (row) => <span>{row.customer.name}</span> },
    { header: "Purchase Date", cell: (row) => <span>{new Date(row.purchaseDate).toLocaleDateString()}</span> },
    { 
      header: "Status", 
      cell: (row) => (
        <span className={cn(
          "px-2 py-0.5 rounded-full text-[11px] font-bold border",
          row.status === "Active" ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"
        )}>
          {row.status}
        </span>
      )
    },
    {
      header: "Action",
      cell: (row) => (
        <button 
          onClick={() => setSelectedAsset(row)}
          className="text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline"
        >
          View Details
        </button>
      )
    }
  ];  if (selectedAsset) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setSelectedAsset(null)}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            &larr; Back to Installed Products
          </button>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 backdrop-blur-md space-y-2">
          <span className="text-[10px] font-mono tracking-wider text-[var(--text-muted)]">{selectedAsset.serialNumber}</span>
          <h2 className="text-xl font-black text-[var(--text-primary)]">{selectedAsset.productName}</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Assigned Customer: <span className="text-[var(--text-primary)] font-semibold">{selectedAsset.customer.name}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <AssetHistoryPanel events={selectedAsset.history || []} />
          </div>

          <div className="space-y-6">
            <WarrantyAMCContextCard 
              purchaseDate={selectedAsset.purchaseDate}
              warrantyExpiry={selectedAsset.warrantyExpiryDate}
              amcExpiry={selectedAsset.amcExpiryDate}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-[var(--text-primary)]">Customer Assets (Installed Products)</h1>
          <p className="text-xs text-[var(--text-muted)]">Trace registered product serial numbers, warranty, and AMC coverages.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl backdrop-blur-md">
        <div className="relative md:col-span-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input 
            type="text" 
            placeholder="Search assets by serial code, product name, customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors placeholder-[var(--text-muted)]"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] focus:outline-none focus:border-blue-500 transition-colors"
        >
          <option value="All">All Coverage Statuses</option>
          <option value="Active">Active Coverage</option>
          <option value="Expired">Expired / No Coverage</option>
        </select>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden backdrop-blur-md">
        <DataTable data={filteredData} columns={columns} />
      </div>
    </div>
  );
}
