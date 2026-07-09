"use client";

import React, { useState, useEffect } from "react";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { WarrantyAMCContextCard } from "@/components/shared/ServiceComponents";
import { Search, ShieldAlert, Award, FileText, ClipboardList } from "lucide-react";
import { cn } from "@/lib/ui-utils";

export default function WarrantyAMCPage() {
  const [amcContracts, setAmcContracts] = useState<any[]>([]);
  const [warrantyClaims, setWarrantyClaims] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"AMC" | "Warranty">("AMC");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [amcRes, warrantyRes] = await Promise.all([
          fetch("/api/service/amc-contracts"),
          fetch("/api/service/warranty-claims")
        ]);
        
        if (amcRes.ok) {
          const amcData = await amcRes.json();
          setAmcContracts(amcData);
        }
        if (warrantyRes.ok) {
          const warrantyData = await warrantyRes.json();
          setWarrantyClaims(warrantyData);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredAMC = amcContracts.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.contractNumber?.toLowerCase().includes(q) ||
      item.customerAsset?.productName?.toLowerCase().includes(q) ||
      item.customer?.name?.toLowerCase().includes(q)
    );
  });

  const filteredWarranty = warrantyClaims.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title?.toLowerCase().includes(q) ||
      item.customerAsset?.productName?.toLowerCase().includes(q) ||
      item.customer?.name?.toLowerCase().includes(q)
    );
  });

  const amcColumns: ColumnDef<any>[] = [
    { header: "Contract No.", accessorKey: "contractNumber" },
    { header: "Product", cell: (row) => row.customerAsset?.productName || "Unknown" },
    { header: "Customer", cell: (row) => row.customer?.name || "Unknown" },
    { header: "End Date", cell: (row) => row.endDate ? new Date(row.endDate).toLocaleDateString() : "-" },
    { 
      header: "Status", 
      cell: (row) => (
        <span className={cn(
          "px-2 py-0.5 rounded-full text-[11px] font-bold border",
          row.status?.name === "Active" ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)]"
        )}>
          {row.status?.name || "Unknown"}
        </span>
      )
    },
    {
      header: "Action",
      cell: (row) => (
        <button 
          onClick={() => setSelectedRecord({ type: "AMC", data: row })}
          className="text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline"
        >
          View Details
        </button>
      )
    }
  ];

  const warrantyColumns: ColumnDef<any>[] = [
    { header: "Title", accessorKey: "title" },
    { header: "Product", cell: (row) => row.customerAsset?.productName || "Unknown" },
    { header: "Customer", cell: (row) => row.customer?.name || "Unknown" },
    { header: "Claim Date", cell: (row) => row.claimDate ? new Date(row.claimDate).toLocaleDateString() : "-" },
    { 
      header: "Status", 
      cell: (row) => (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold border bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)]">
          {row.status?.name || "Unknown"}
        </span>
      )
    },
    {
      header: "Action",
      cell: (row) => (
        <button 
          onClick={() => setSelectedRecord({ type: "Warranty", data: row })}
          className="text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline"
        >
          View Details
        </button>
      )
    }
  ];

  if (selectedRecord) {
    const isAMC = selectedRecord.type === "AMC";
    const data = selectedRecord.data;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setSelectedRecord(null)}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            &larr; Back to List
          </button>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 backdrop-blur-md space-y-2">
          <span className="text-[10px] font-mono tracking-wider text-[var(--text-muted)]">
            {isAMC ? data.contractNumber : data.id}
          </span>
          <h2 className="text-xl font-black text-[var(--text-primary)]">
            {isAMC ? `AMC: ${data.customerAsset?.productName}` : data.title}
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Customer: <span className="text-[var(--text-primary)] font-semibold">{data.customer?.name}</span>
          </p>
          {!isAMC && data.description && (
            <p className="text-xs text-[var(--text-secondary)] mt-4 p-3 bg-[var(--surface-2)] rounded border border-[var(--border)]">
              {data.description}
            </p>
          )}
        </div>

        <div className="max-w-md">
          <WarrantyAMCContextCard 
            warrantyExpiry={data.customerAsset?.warrantyExpiryDate}
            amcExpiry={data.customerAsset?.amcExpiryDate}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black text-[var(--text-primary)]">Warranty & AMC Contracts</h1>
        <p className="text-xs text-[var(--text-muted)]">Manage coverage verification, expiration notifications, and claims.</p>
      </div>

      <div className="flex items-center gap-4 border-b border-[var(--border)] pb-2">
        <button
          onClick={() => setActiveTab("AMC")}
          className={cn(
            "flex items-center gap-2 text-sm font-bold pb-2 border-b-2 transition-all",
            activeTab === "AMC" ? "border-blue-500 text-blue-500" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          )}
        >
          <ClipboardList size={16} /> AMC Contracts
        </button>
        <button
          onClick={() => setActiveTab("Warranty")}
          className={cn(
            "flex items-center gap-2 text-sm font-bold pb-2 border-b-2 transition-all",
            activeTab === "Warranty" ? "border-blue-500 text-blue-500" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          )}
        >
          <FileText size={16} /> Warranty Claims
        </button>
      </div>

      <div className="relative bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl backdrop-blur-md flex items-center">
        <Search size={14} className="absolute left-6 text-[var(--text-muted)] pointer-events-none" />
        <input 
          type="text" 
          placeholder={`Search ${activeTab === "AMC" ? "contracts" : "claims"} by title, product, or customer...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors placeholder-[var(--text-muted)]"
        />
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden backdrop-blur-md">
        {loading ? (
          <div className="p-8 text-center text-sm text-[var(--text-muted)] animate-pulse">Loading data...</div>
        ) : (
          <DataTable 
            data={activeTab === "AMC" ? filteredAMC : filteredWarranty} 
            columns={activeTab === "AMC" ? amcColumns : warrantyColumns} 
          />
        )}
      </div>
    </div>
  );
}
