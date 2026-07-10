"use client";

import { useState, useEffect } from "react";
import { X, Calculator, HelpCircle, Save, AlertTriangle, ArrowRight } from "lucide-react";
import { useToast } from "@/components/ToastProvider";

export interface QuantityBreak {
  id: string;
  quantity: number;
  computedUnitPrice: number;
}

export interface LineItem {
  id: string;
  itemDescription: string;
  productId?: string | null;
  quantity: number;
  unit?: string | null;
  targetPrice?: number | null;
  specifications?: string | null;
  notes?: string | null;
  quantityBreaks: QuantityBreak[];
}

interface CostingDetailsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  lineItem: LineItem | null;
  rfqId: string;
  onSaved: () => void;
}

interface CostingDefaults {
  materialCost: number;
  labourCost: number;
  overheadPercent: number;
  marginPercent: number;
  bomFound: boolean;
  routingFound: boolean;
}

interface CostingFormState {
  material_cost: string;
  labour_cost: string;
  overhead_percent: string;
  margin_percent: string;
  freight_cost: string;
  packaging_cost: string;
  tooling_cost: string;
  other_cost: string;
  notes: string;
}

export function CostingDetailsPanel({
  isOpen,
  onClose,
  lineItem,
  rfqId,
  onSaved,
}: CostingDetailsPanelProps) {
  const toast = useToast();
  const [activeBreakIdx, setActiveBreakIdx] = useState(0);
  const [defaults, setDefaults] = useState<CostingDefaults | null>(null);
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const [saving, setSaving] = useState(false);

  // Costing data stored per quantity break ID
  const [tierForms, setTierForms] = useState<Record<string, CostingFormState>>({});
  // Overridden tracking per quantity break ID and field
  const [overrides, setOverrides] = useState<Record<string, Record<string, boolean>>>({});

  const activeBreak = lineItem?.quantityBreaks?.[activeBreakIdx] || null;

  // Load defaults and existing cost sheets when line item changes
  useEffect(() => {
    if (!isOpen || !lineItem) return;

    setActiveBreakIdx(0);
    setDefaults(null);
    setTierForms({});
    setOverrides({});

    // Fetch existing costing sheets for this line item to pre-fill
    const fetchExistingSheets = async () => {
      try {
        const res = await fetch(`/api/rfq/${rfqId}/costing-sheet`);
        const data = await res.json();
        if (data.success && data.data) {
          const sheets = data.data.filter((s: any) => s.rfqLineItemId === lineItem.id);
          const initialForms: Record<string, CostingFormState> = {};
          const initialOverrides: Record<string, Record<string, boolean>> = {};

          for (const qb of lineItem.quantityBreaks || []) {
            const sheet = sheets.find((s: any) => s.quantityBreakId === qb.id);
            if (sheet) {
              initialForms[qb.id] = {
                material_cost: String(sheet.materialCost),
                labour_cost: String(sheet.labourCost),
                overhead_percent: String(sheet.overheadPercent),
                margin_percent: String(sheet.marginPercent),
                freight_cost: String(sheet.freightCost),
                packaging_cost: String(sheet.packagingCost),
                tooling_cost: String(sheet.toolingCost),
                other_cost: String(sheet.otherCost),
                notes: sheet.notes || "",
              };
              // Any loaded sheet values are marked as manual override if they differ from the defaults (fetched next)
              initialOverrides[qb.id] = {};
            }
          }
          setTierForms(initialForms);
        }
      } catch (e) {
        console.error("Failed to load existing costing sheets:", e);
      }
    };

    fetchExistingSheets();

    // Always fetch auto-fill defaults — API handles no-product case gracefully
    setLoadingDefaults(true);
    fetch(`/api/rfq/${rfqId}/line-items/${lineItem.id}/auto-fill`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setDefaults({
              materialCost: data.data.material_cost,
              labourCost: data.data.labour_cost,
              overheadPercent: data.data.overhead_percent,
              marginPercent: data.data.margin_percent,
              bomFound: data.data.sources.material_cost === "bom",
              routingFound: data.data.sources.labour_cost === "routing",
            });
            // Pre-fill breaks that don't have sheets saved yet
            setTierForms((prev) => {
              const updated = { ...prev };
              for (const qb of lineItem.quantityBreaks || []) {
                if (!updated[qb.id]) {
                  updated[qb.id] = {
                    material_cost: String(data.data.material_cost),
                    labour_cost: String(data.data.labour_cost),
                    overhead_percent: String(data.data.overhead_percent),
                    margin_percent: String(data.data.margin_percent),
                    freight_cost: "0",
                    packaging_cost: "0",
                    tooling_cost: "0",
                    other_cost: "0",
                    notes: "",
                  };
                }
              }
              return updated;
            });
          }
        })
        .catch((err) => console.error("Error fetching costing defaults:", err))
        .finally(() => setLoadingDefaults(false));
  }, [isOpen, lineItem, rfqId]);

  if (!isOpen || !lineItem || !activeBreak) return null;

  const currentForm = tierForms[activeBreak.id] || {
    material_cost: "",
    labour_cost: "",
    overhead_percent: "",
    margin_percent: "",
    freight_cost: "0",
    packaging_cost: "0",
    tooling_cost: "0",
    other_cost: "0",
    notes: "",
  };

  const currentOverrides = overrides[activeBreak.id] || {};

  const handleFieldChange = (field: keyof CostingFormState, val: string) => {
    setTierForms((prev) => ({
      ...prev,
      [activeBreak.id]: {
        ...prev[activeBreak.id],
        [field]: val,
      },
    }));

    // Check if overridden from defaults
    if (defaults) {
      let isOverridden = false;
      const numVal = parseFloat(val) || 0;
      if (field === "material_cost" && numVal !== defaults.materialCost) isOverridden = true;
      if (field === "labour_cost" && numVal !== defaults.labourCost) isOverridden = true;
      if (field === "overhead_percent" && numVal !== defaults.overheadPercent) isOverridden = true;
      if (field === "margin_percent" && numVal !== defaults.marginPercent) isOverridden = true;
      // Freight packaging, tooling etc. are manual anyway
      if (["freight_cost", "packaging_cost", "tooling_cost", "other_cost"].includes(field)) {
        isOverridden = numVal > 0;
      }

      setOverrides((prev) => ({
        ...prev,
        [activeBreak.id]: {
          ...(prev[activeBreak.id] || {}),
          [field]: isOverridden,
        },
      }));
    } else {
      // No master defaults: everything manually entered
      setOverrides((prev) => ({
        ...prev,
        [activeBreak.id]: {
          ...(prev[activeBreak.id] || {}),
          [field]: true,
        },
      }));
    }
  };

  // Compute live price
  const mc = parseFloat(currentForm.material_cost) || 0;
  const lc = parseFloat(currentForm.labour_cost) || 0;
  const oh = parseFloat(currentForm.overhead_percent) || 0;
  const mg = parseFloat(currentForm.margin_percent) || 0;
  const fr = parseFloat(currentForm.freight_cost) || 0;
  const pk = parseFloat(currentForm.packaging_cost) || 0;
  const tl = parseFloat(currentForm.tooling_cost) || 0;
  const ot = parseFloat(currentForm.other_cost) || 0;

  const totalCostBeforeMarkup = mc + lc + fr + pk + tl + ot;
  const computedUnitPrice = totalCostBeforeMarkup * (1 + oh / 100) * (1 + mg / 100);

  // Target price delta calculation
  let targetDeltaNode = null;
  if (lineItem.targetPrice && computedUnitPrice > 0) {
    const deltaPercent = ((computedUnitPrice - lineItem.targetPrice) / lineItem.targetPrice) * 100;
    const isAbove = deltaPercent > 0;
    targetDeltaNode = (
      <span className={isAbove ? "text-rose-500 font-semibold" : "text-emerald-500 font-semibold"}>
        ({isAbove ? "+" : ""}{deltaPercent.toFixed(1)}% {isAbove ? "above" : "below"} target of ₹{lineItem.targetPrice})
      </span>
    );
  }

  // Get source label helper
  const getSourceLabel = (field: "material" | "labour" | "overhead" | "margin") => {
    const isOverridden = currentOverrides[field === "material" ? "material_cost" : field === "labour" ? "labour_cost" : `${field}_percent`];
    if (isOverridden) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
          ✏️ Manual Override
        </span>
      );
    }
    if (!defaults) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-50 text-slate-500 border border-slate-200 uppercase tracking-wider">
          Enter Manually
        </span>
      );
    }
    if (field === "material") {
      return defaults.bomFound ? (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
          ✨ Auto-filled: BOM
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
          No BOM - Manual
        </span>
      );
    }
    if (field === "labour") {
      return defaults.routingFound ? (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
          ✨ Auto-filled: Routing
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
          No Routing - Manual
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
        ✨ Auto-filled: Category
      </span>
    );
  };

  const handleSave = async () => {
    if (mc <= 0 || lc <= 0) {
      toast.error("Material cost and labour cost must be greater than 0");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        line_items: [
          {
            line_item_id: lineItem.id,
            quantity_break_id: activeBreak.id,
            material_cost: mc,
            labour_cost: lc,
            overhead_percent: oh,
            margin_percent: mg,
            freight_cost: fr,
            packaging_cost: pk,
            tooling_cost: tl,
            other_cost: ot,
            notes: currentForm.notes || undefined,
          },
        ],
      };

      const res = await fetch(`/api/rfq/${rfqId}/costing-sheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Costing sheet saved for quantity break: ${activeBreak.quantity} units`);
        onSaved();
      } else {
        toast.error(data.message || "Failed to save costing sheet");
      }
    } catch {
      toast.error("Failed to save costing sheet");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    const breaks = lineItem?.quantityBreaks || [];
    const formsToSave = breaks.filter((qb) => {
      const f = tierForms[qb.id];
      if (!f) return false;
      const fmc = parseFloat(f.material_cost) || 0;
      const flc = parseFloat(f.labour_cost) || 0;
      return fmc > 0 && flc > 0;
    });

    if (formsToSave.length === 0) {
      toast.error("No valid costing data to save. Material cost and labour cost must be greater than 0.");
      return;
    }

    setSaving(true);
    try {
      const line_items = formsToSave.map((qb) => {
        const f = tierForms[qb.id];
        return {
          line_item_id: lineItem!.id,
          quantity_break_id: qb.id,
          material_cost: parseFloat(f.material_cost) || 0,
          labour_cost: parseFloat(f.labour_cost) || 0,
          overhead_percent: parseFloat(f.overhead_percent) || 0,
          margin_percent: parseFloat(f.margin_percent) || 0,
          freight_cost: parseFloat(f.freight_cost) || 0,
          packaging_cost: parseFloat(f.packaging_cost) || 0,
          tooling_cost: parseFloat(f.tooling_cost) || 0,
          other_cost: parseFloat(f.other_cost) || 0,
          notes: f.notes || undefined,
        };
      });

      const res = await fetch(`/api/rfq/${rfqId}/costing-sheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line_items }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Saved costing for ${formsToSave.length} tier(s)`);
        onSaved();
      } else {
        toast.error(data.message || "Failed to save costing sheets");
      }
    } catch {
      toast.error("Failed to save costing sheets");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex-col animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Calculator className="text-[var(--primary)]" size={18} />
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
              Costing Sheet
            </h3>
            <p className="text-xs text-slate-500 truncate max-w-xs">{lineItem.itemDescription}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Tiers Switcher Tab Header */}
      <div className="bg-slate-50 dark:bg-slate-950 px-6 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
          Qty Tiers:
        </span>
        {lineItem.quantityBreaks.map((qb, idx) => (
          <button
            key={qb.id}
            onClick={() => setActiveBreakIdx(idx)}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              activeBreakIdx === idx
                ? "bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800"
            }`}
          >
            {qb.quantity} pcs {qb.computedUnitPrice > 0 && `(₹${qb.computedUnitPrice.toFixed(2)})`}
          </button>
        ))}
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Specifications carryover box */}
        {(lineItem.specifications || lineItem.notes) && (
          <div className="p-3 bg-slate-50 dark:bg-slate-950/40 rounded-lg border border-slate-100 dark:border-slate-850 text-xs">
            <h4 className="font-bold text-slate-400 uppercase tracking-wider mb-1">Specifications / Notes</h4>
            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {lineItem.specifications || lineItem.notes}
            </p>
          </div>
        )}

        {/* Master Cost Warning */}
        {loadingDefaults ? (
          <div className="text-xs text-slate-400 italic py-1 animate-pulse">
            Loading rates from BOM and Routing...
          </div>
        ) : defaults && !defaults.bomFound && !defaults.routingFound && lineItem.productId ? (
          <div className="flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-lg">
            <AlertTriangle className="text-amber-500 mt-0.5 flex-shrink-0" size={14} />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              No active BOM or Routing master data found for this product. Fields default to blank and must be populated manually.
            </p>
          </div>
        ) : defaults && !defaults.bomFound && lineItem.productId ? (
          <div className="flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-lg">
            <AlertTriangle className="text-amber-500 mt-0.5 flex-shrink-0" size={14} />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              No active BOM found for this product. Material cost must be entered manually.
            </p>
          </div>
        ) : defaults && !defaults.routingFound && lineItem.productId ? (
          <div className="flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-lg">
            <AlertTriangle className="text-amber-500 mt-0.5 flex-shrink-0" size={14} />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              No active Routing found for this product. Labour cost must be entered manually.
            </p>
          </div>
        ) : null}

        {/* Form Inputs */}
        <div className="grid grid-cols-2 gap-4">
          {/* Material Cost */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Material Cost (₹)
            </label>
            <input
              type="number"
              step="0.01"
              value={currentForm.material_cost}
              onChange={(e) => handleFieldChange("material_cost", e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-[var(--primary)] focus:outline-none bg-transparent"
            />
            <div className="flex items-center gap-1.5">{getSourceLabel("material")}</div>
          </div>

          {/* Labor Cost */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Labour Cost (₹)
            </label>
            <input
              type="number"
              step="0.01"
              value={currentForm.labour_cost}
              onChange={(e) => handleFieldChange("labour_cost", e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-[var(--primary)] focus:outline-none bg-transparent"
            />
            <div className="flex items-center gap-1.5">{getSourceLabel("labour")}</div>
          </div>

          {/* Overhead Percent */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Overhead (%)
            </label>
            <input
              type="number"
              step="0.01"
              value={currentForm.overhead_percent}
              onChange={(e) => handleFieldChange("overhead_percent", e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-[var(--primary)] focus:outline-none bg-transparent"
            />
            <div className="flex items-center gap-1.5">{getSourceLabel("overhead")}</div>
          </div>

          {/* Margin Percent */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Margin (%)
            </label>
            <input
              type="number"
              step="0.01"
              value={currentForm.margin_percent}
              onChange={(e) => handleFieldChange("margin_percent", e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-[var(--primary)] focus:outline-none bg-transparent"
            />
            <div className="flex items-center gap-1.5">{getSourceLabel("margin")}</div>
          </div>

          {/* Freight Cost */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Freight Cost (₹)
            </label>
            <input
              type="number"
              value={currentForm.freight_cost}
              onChange={(e) => handleFieldChange("freight_cost", e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-[var(--primary)] focus:outline-none bg-transparent"
            />
          </div>

          {/* Packaging Cost */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Packaging Cost (₹)
            </label>
            <input
              type="number"
              value={currentForm.packaging_cost}
              onChange={(e) => handleFieldChange("packaging_cost", e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-[var(--primary)] focus:outline-none bg-transparent"
            />
          </div>

          {/* Tooling Cost */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Tooling Cost (₹)
            </label>
            <input
              type="number"
              value={currentForm.tooling_cost}
              onChange={(e) => handleFieldChange("tooling_cost", e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-[var(--primary)] focus:outline-none bg-transparent"
            />
          </div>

          {/* Other Cost */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Other Cost (₹)
            </label>
            <input
              type="number"
              value={currentForm.other_cost}
              onChange={(e) => handleFieldChange("other_cost", e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-[var(--primary)] focus:outline-none bg-transparent"
            />
          </div>
        </div>

        {/* Costing Sheet Notes */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Costing Notes / Remarks (Per-item specific)
          </label>
          <textarea
            value={currentForm.notes}
            onChange={(e) => handleFieldChange("notes", e.target.value)}
            placeholder="Describe any tooling modifications, raw materials deviations, or specific labor operations involved..."
            rows={3}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-[var(--primary)] focus:outline-none bg-transparent resize-none"
          />
        </div>

        {/* Live Calculation Display Area */}
        <div className="p-4 bg-slate-900 text-slate-100 rounded-xl space-y-2 border border-slate-800 shadow-md">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Direct Cost (Material + Labour + Overhead):</span>
            <span className="font-semibold text-slate-200">
              ₹{((mc + lc) * (1 + oh / 100)).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Add-ons (Freight + Pack + Tooling + Other):</span>
            <span className="font-semibold text-slate-200">
              ₹{(fr + pk + tl + ot).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Total Cost (before margin):</span>
            <span className="font-semibold text-slate-200">
              ₹{((mc + lc + fr + pk + tl + ot) * (1 + oh / 100)).toFixed(2)}
            </span>
          </div>
          <div className="border-t border-slate-800 my-1 pt-2 flex justify-between items-end">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Computed Unit Price</p>
              <p className="text-2xl font-black tracking-tight text-white">
                ₹{computedUnitPrice.toFixed(2)}
              </p>
            </div>
            <div className="text-right text-xs">
              {targetDeltaNode}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-white dark:bg-slate-900">
        <button
          onClick={onClose}
          disabled={saving}
          className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>
        {lineItem.quantityBreaks.length > 1 && (
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? "Saving..." : <><Save size={13} /> Save All Tiers ({lineItem.quantityBreaks.length})</>}
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving || mc <= 0 || lc <= 0}
          className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-sm"
        >
          {saving ? "Saving..." : <><Save size={13} /> Save This Tier</>}
        </button>
      </div>
    </div>
  );
}
