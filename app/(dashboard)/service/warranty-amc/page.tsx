"use client";

import React, { useState } from "react";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { WarrantyAMCContextCard } from "@/components/shared/ServiceComponents";
import { Search, ShieldAlert, Award } from "lucide-react";
import { cn } from "@/lib/ui-utils";

const mockContracts: any[] = [
  {
    id: "cnt-1",
    serialNumber: "SN-98273-A",
    productName: "Heavy Duty Air Compressor v4",
    customerName: "Apex Engineering Solutions",
    warrantyExpiryDate: "2027-01-15",
    amcExpiryDate: "2028-01-15",
    status: "Active"
  },
  {
    id: "cnt-2",
    serialNumber: "SN-10293-B",
    productName: "Hydraulic Press Pump H-200",
    customerName: "Vertex Manufacturing Corp",
    warrantyExpiryDate: "2025-05-10",
    amcExpiryDate: "2026-05-10",
    status: "Active"
  },
  {
    id: "cnt-3",
    serialNumber: "SN-44392-C",
    productName: "Pneumatic Valve Module X-100",
    customerName: "Aero Engine Corp",
    warrantyExpiryDate: "2025-03-12",
    amcExpiryDate: "2024-03-12",
    status: "Expired"
  }
];

export default function WarrantyAMCPage() {
  const [data, setData] = useState<any[]>(mockContracts);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContract, setSelectedContract] = useState<any>(null);

  const filteredData = data.filter(item => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const serialMatch = item.serialNumber.toLowerCase().includes(q);
      const productNameMatch = item.productName.toLowerCase().includes(q);
      const customerMatch = item.customerName.toLowerCase().includes(q);
      if (!serialMatch && !productNameMatch && !customerMatch) return false;
    }
    return true;
  });

  const columns: ColumnDef<any>[] = [
    { header: "Serial Number", accessorKey: "serialNumber" },
    { header: "Product Name", accessorKey: "productName" },
    { header: "Customer Name", accessorKey: "customerName" },
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
          onClick={() => setSelectedContract(row)}
          className="text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline"
        >
          View Details
        </button>
      )
    }
  ];
  if (selectedContract) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setSelectedContract(null)}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            &larr; Back to Contracts List
          </button>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 backdrop-blur-md space-y-2">
          <span className="text-[10px] font-mono tracking-wider text-[var(--text-muted)]">{selectedContract.serialNumber}</span>
          <h2 className="text-xl font-black text-[var(--text-primary)]">{selectedContract.productName}</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Customer: <span className="text-[var(--text-primary)] font-semibold">{selectedContract.customerName}</span>
          </p>
        </div>

        <div className="max-w-md">
          <WarrantyAMCContextCard 
            warrantyExpiry={selectedContract.warrantyExpiryDate}
            amcExpiry={selectedContract.amcExpiryDate}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black text-[var(--text-primary)]">Warranty & AMC Contracts</h1>
        <p className="text-xs text-[var(--text-muted)]">Manage coverage verification, expiration notifications, and service history links.</p>
      </div>

      <div className="relative bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl backdrop-blur-md flex items-center">
        <Search size={14} className="absolute left-6 text-[var(--text-muted)] pointer-events-none" />
        <input 
          type="text" 
          placeholder="Search contracts by serial, product, or customer..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors placeholder-[var(--text-muted)]"
        />
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden backdrop-blur-md">
        <DataTable data={filteredData} columns={columns} />
      </div>
    </div>
  );
}
