"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { Search, RefreshCw, Package, X, ChevronLeft, AlertTriangle, TrendingDown, Boxes, PlusCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/ui-utils";
import { ServiceKPICard, ServiceKPIGrid } from "@/components/shared/ServiceKPICard";
import { useToast } from "@/components/ToastProvider";

interface SparePart {
  id: string;
  partCode: string;
  partName: string;
  category?: string;
  unit?: string;
  unitCost: number;
  currentStock: number;
  isActive: boolean;
  partMovements?: PartMovement[];
}

interface PartMovement {
  id: string;
  type: string;
  quantity: number;
  notes?: string;
  createdAt: string;
  engineer?: { user?: { name: string } };
  serviceVisit?: { id: string; title: string };
  customerAsset?: { id: string; productName: string; serialNumber: string };
  createdBy?: { id: string; name: string };
}

const movementTypeColors: Record<string, string> = {
  Issued: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  Used: "bg-red-500/10 text-red-500 border-red-500/20",
  Returned: "bg-green-500/10 text-green-500 border-green-500/20",
  Damaged: "bg-amber-500/10 text-amber-500 border-amber-500/20",
};

export default function InventoryPage() {
  const [data, setData] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [selectedPart, setSelectedPart] = useState<SparePart | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustAction, setAdjustAction] = useState<"restock" | "damaged">("restock");
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjustNotes, setAdjustNotes] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [view, setView] = useState<"parts" | "holdings">("parts");
  const [engineers, setEngineers] = useState<any[]>([]);
  const [selectedEngineerId, setSelectedEngineerId] = useState("");
  const [holdings, setHoldings] = useState<any[]>([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const toast = useToast();

  const fetchParts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (lowStockOnly) params.set("lowStock", "true");
      const res = await fetch(`/api/service/inventory?${params.toString()}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error("Failed to fetch inventory:", err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, lowStockOnly]);

  useEffect(() => {
    fetch("/api/service/reference-data")
      .then(res => res.json())
      .then(json => { setEngineers(json.ServiceEngineer || []); })
      .catch(() => {});
  }, []);

  const fetchHoldings = useCallback(async (engineerId: string) => {
    if (!engineerId) { setHoldings([]); return; }
    setHoldingsLoading(true);
    try {
      const res = await fetch(`/api/service/inventory?engineerId=${engineerId}`);
      const json = await res.json();
      if (json.success) setHoldings(json.data);
    } catch (err) {
      console.error("Failed to fetch holdings:", err);
    } finally {
      setHoldingsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  const fetchLedger = useCallback(async (partId: string) => {
    setLedgerLoading(true);
    try {
      const res = await fetch(`/api/service/inventory?partId=${partId}`);
      const json = await res.json();
      if (json.success) setSelectedPart(json.data);
    } catch (err) {
      console.error("Failed to fetch ledger:", err);
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  const columns: ColumnDef<SparePart>[] = useMemo(() => [
    { header: "Part Code", accessorKey: "partCode", cell: (p: SparePart) => <span className="font-mono text-xs font-bold">{p.partCode}</span> },
    { header: "Part Name", accessorKey: "partName", cell: (p: SparePart) => <span className="font-medium">{p.partName}</span> },
    { header: "Category", accessorKey: "category", cell: (p: SparePart) => <span className="text-xs text-[var(--text-secondary)]">{p.category || "-"}</span> },
    { header: "Unit Cost", accessorKey: "unitCost", cell: (p: SparePart) => <span className="text-xs">₹{p.unitCost.toFixed(2)}</span> },
    {
      header: "Current Stock",
      accessorKey: "currentStock",
      cell: (p: SparePart) => (
        <span className={cn(
          "text-xs font-bold px-2 py-0.5 rounded-full border",
          p.currentStock <= 0
            ? "bg-red-500/10 text-red-500 border-red-500/20"
            : p.currentStock <= 5
              ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
              : "bg-green-500/10 text-green-500 border-green-500/20"
        )}>
          {p.currentStock} {p.unit || "pcs"}
        </span>
      ),
    },
    {
      header: "",
      cell: (p: SparePart) => (
        <button
          onClick={() => { setSelectedPart(p); fetchLedger(p.id); }}
          className="text-xs text-blue-500 hover:text-blue-400 font-bold"
        >
          View Ledger
        </button>
      ),
    },
  ], [fetchLedger]);

  const kpis = useMemo(() => {
    const totalParts = data.length;
    const lowStock = data.filter((p) => p.currentStock > 0 && p.currentStock <= 5).length;
    const outOfStock = data.filter((p) => p.currentStock <= 0).length;
    const totalValue = data.reduce((sum, p) => sum + p.currentStock * p.unitCost, 0);
    return { totalParts, lowStock, outOfStock, totalValue };
  }, [data]);

  if (selectedPart) {
    const movements = selectedPart.partMovements || [];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => setSelectedPart(null)}
              className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-2"
            >
              <ChevronLeft size={14} /> Back to Inventory
            </button>
            <h1 className="text-xl font-black text-[var(--text-primary)]">{selectedPart.partName}</h1>
            <p className="text-xs text-[var(--text-muted)] font-mono">{selectedPart.partCode}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <button
                onClick={() => { setAdjustAction("restock"); setAdjustQty(1); setAdjustNotes(""); setShowAdjustModal(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors"
              >
                <PlusCircle size={14} /> Restock
              </button>
              <button
                onClick={() => { setAdjustAction("damaged"); setAdjustQty(1); setAdjustNotes(""); setShowAdjustModal(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-500/30 bg-amber-500/10 text-amber-500 rounded-lg text-xs font-bold transition-colors hover:bg-amber-500/20"
              >
                <AlertCircle size={14} /> Mark Damaged
              </button>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">Current Stock</span>
              <span className={cn(
                "text-lg font-black",
                selectedPart.currentStock <= 0
                  ? "text-red-500"
                  : selectedPart.currentStock <= 5
                    ? "text-amber-500"
                    : "text-green-500"
              )}>
                {selectedPart.currentStock} {selectedPart.unit || "pcs"}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">Unit Cost</span>
              <span className="text-lg font-black text-[var(--text-primary)]">₹{selectedPart.unitCost.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4 backdrop-blur-md">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
            Movement Ledger ({movements.length} entries)
          </h3>

          {ledgerLoading ? (
            <p className="text-xs text-[var(--text-muted)] py-8 text-center">Loading ledger...</p>
          ) : movements.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-8 text-center">No movements recorded for this part yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2 px-3 font-bold text-[var(--text-secondary)]">Date</th>
                    <th className="text-left py-2 px-3 font-bold text-[var(--text-secondary)]">Type</th>
                    <th className="text-right py-2 px-3 font-bold text-[var(--text-secondary)]">Qty</th>
                    <th className="text-left py-2 px-3 font-bold text-[var(--text-secondary)]">Engineer</th>
                    <th className="text-left py-2 px-3 font-bold text-[var(--text-secondary)]">Visit / Asset</th>
                    <th className="text-left py-2 px-3 font-bold text-[var(--text-secondary)]">Notes</th>
                    <th className="text-left py-2 px-3 font-bold text-[var(--text-secondary)]">By</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-2)]">
                      <td className="py-2 px-3 text-[var(--text-secondary)]">{new Date(m.createdAt).toLocaleString()}</td>
                      <td className="py-2 px-3">
                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", movementTypeColors[m.type] || "bg-gray-500/10 text-gray-500 border-gray-500/20")}>
                          {m.type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-[var(--text-primary)]">
                        {m.type === "Used" ? "-" : m.type === "Returned" ? "+" : ""}{m.quantity}
                      </td>
                      <td className="py-2 px-3 text-[var(--text-secondary)]">{m.engineer?.user?.name || "-"}</td>
                      <td className="py-2 px-3 text-[var(--text-secondary)]">
                        {m.serviceVisit ? `VST: ${m.serviceVisit.title.substring(0, 20)}` : m.customerAsset ? `Asset: ${m.customerAsset.productName}` : "-"}
                      </td>
                      <td className="py-2 px-3 text-[var(--text-muted)] max-w-[200px] truncate">{m.notes || "-"}</td>
                      <td className="py-2 px-3 text-[var(--text-secondary)]">{m.createdBy?.name || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showAdjustModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  {adjustAction === "restock" ? "Restock / Add Inventory" : "Mark Parts as Damaged"}
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  {adjustAction === "restock"
                    ? `Add quantity to ${selectedPart?.partName}. Stock will increase.`
                    : `Mark damaged quantity for ${selectedPart?.partName}. Stock will not change (already deducted at use time).`}
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(parseInt(e.target.value) || 1)}
                    className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Notes</label>
                  <textarea
                    rows={2}
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    placeholder={adjustAction === "restock" ? "e.g. Initial stock, new purchase received..." : "e.g. Damaged during transit..."}
                    className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 placeholder-[var(--text-muted)]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  onClick={() => setShowAdjustModal(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setAdjusting(true);
                    try {
                      const res = await fetch("/api/service/inventory", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          sparePartId: selectedPart?.id,
                          action: adjustAction,
                          quantity: adjustQty,
                          notes: adjustNotes,
                        }),
                      });
                      const json = await res.json();
                      if (json.success) {
                        toast.success(adjustAction === "restock" ? `Added ${adjustQty} units to stock` : `Marked ${adjustQty} units as damaged`);
                        setShowAdjustModal(false);
                        if (selectedPart) {
                          fetchLedger(selectedPart.id);
                          fetchParts();
                        }
                      } else {
                        toast.error(json.message || "Failed to adjust stock");
                      }
                    } catch (e) {
                      toast.error("Failed to adjust stock");
                    } finally {
                      setAdjusting(false);
                    }
                  }}
                  disabled={adjusting || adjustQty < 1}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                    adjustAction === "restock" ? "bg-green-600 hover:bg-green-700" : "bg-amber-600 hover:bg-amber-700"
                  )}
                >
                  {adjusting ? "Processing..." : adjustAction === "restock" ? "Add Stock" : "Mark Damaged"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-[var(--text-primary)]">Spare Parts Inventory</h1>
          <p className="text-xs text-[var(--text-muted)]">Track stock levels and view full movement ledger for each part.</p>
        </div>
        <button
          onClick={fetchParts}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border)] bg-[var(--surface-2)] rounded-lg text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <ServiceKPIGrid>
        <ServiceKPICard icon={<Boxes size={16} className="text-blue-500" />} label="Total Parts" value={kpis.totalParts} color="bg-blue-500/10" />
        <ServiceKPICard icon={<TrendingDown size={16} className="text-amber-500" />} label="Low Stock" value={kpis.lowStock} color="bg-amber-500/10" />
        <ServiceKPICard icon={<AlertTriangle size={16} className="text-red-500" />} label="Out of Stock" value={kpis.outOfStock} color="bg-red-500/10" />
        <ServiceKPICard icon={<Package size={16} className="text-green-500" />} label="Inventory Value" value={`₹${kpis.totalValue.toFixed(0)}`} color="bg-green-500/10" />
      </ServiceKPIGrid>

      <div className="flex items-center gap-4 border-b border-[var(--border)] pb-2">
        <button
          onClick={() => setView("parts")}
          className={cn(
            "flex items-center gap-2 text-sm font-bold pb-2 border-b-2 transition-all",
            view === "parts" ? "border-blue-500 text-blue-500" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          )}
        >
          <Boxes size={16} /> Parts Inventory
        </button>
        <button
          onClick={() => setView("holdings")}
          className={cn(
            "flex items-center gap-2 text-sm font-bold pb-2 border-b-2 transition-all",
            view === "holdings" ? "border-blue-500 text-blue-500" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          )}
        >
          <Package size={16} /> Engineer Holdings
        </button>
      </div>

      {view === "parts" ? (
        <>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by part code, name, or category..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors placeholder-[var(--text-muted)]"
              />
            </div>
            <button
              onClick={() => setLowStockOnly(!lowStockOnly)}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-bold border transition-all",
                lowStockOnly
                  ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                  : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              Low Stock Only
            </button>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] backdrop-blur-md overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-[var(--text-muted)] animate-pulse">Loading inventory...</div>
            ) : data.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--text-muted)]">No spare parts found.</div>
            ) : (
              <DataTable columns={columns} data={data} />
            )}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <select
              value={selectedEngineerId}
              onChange={(e) => { setSelectedEngineerId(e.target.value); fetchHoldings(e.target.value); }}
              className="text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 min-w-[250px]"
            >
              <option value="">Select engineer...</option>
              {engineers.map((eng: any) => (
                <option key={eng.value || eng.id} value={eng.value || eng.id}>{eng.label || eng.user?.name || "Unknown"}</option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] backdrop-blur-md overflow-hidden">
            {!selectedEngineerId ? (
              <div className="p-8 text-center text-sm text-[var(--text-muted)]">Select an engineer to view their current parts holdings.</div>
            ) : holdingsLoading ? (
              <div className="p-8 text-center text-sm text-[var(--text-muted)] animate-pulse">Loading holdings...</div>
            ) : holdings.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--text-muted)]">No parts currently held by this engineer.</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2 px-4 font-bold text-[var(--text-secondary)]">Part Code</th>
                    <th className="text-left py-2 px-4 font-bold text-[var(--text-secondary)]">Part Name</th>
                    <th className="text-right py-2 px-4 font-bold text-[var(--text-secondary)]">Issued</th>
                    <th className="text-right py-2 px-4 font-bold text-[var(--text-secondary)]">Used</th>
                    <th className="text-right py-2 px-4 font-bold text-[var(--text-secondary)]">Returned</th>
                    <th className="text-right py-2 px-4 font-bold text-[var(--text-secondary)]">Holding</th>
                    <th className="text-right py-2 px-4 font-bold text-[var(--text-secondary)]">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h: any) => (
                    <tr key={h.sparePart?.id || h.sparePartId} className="border-b border-[var(--border)] hover:bg-[var(--surface-2)]">
                      <td className="py-2 px-4 font-mono font-bold text-[var(--text-primary)]">{h.sparePart?.partCode || "-"}</td>
                      <td className="py-2 px-4 text-[var(--text-primary)]">{h.sparePart?.partName || "-"}</td>
                      <td className="py-2 px-4 text-right text-[var(--text-secondary)]">{h.issuedQty ?? h.issued ?? 0}</td>
                      <td className="py-2 px-4 text-right text-[var(--text-secondary)]">{h.usedQty ?? h.used ?? 0}</td>
                      <td className="py-2 px-4 text-right text-[var(--text-secondary)]">{h.returnedQty ?? h.returned ?? 0}</td>
                      <td className="py-2 px-4 text-right font-bold text-blue-500">{h.holdingQty ?? h.holding ?? 0}</td>
                      <td className="py-2 px-4 text-right text-[var(--text-secondary)]">₹{((h.holdingQty ?? h.holding ?? 0) * (h.sparePart?.unitCost || 0)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
