"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle, AlertTriangle, ShieldAlert, Calendar, Loader2 } from "lucide-react";

interface PendingItem {
  id: string;
  itemDescription: string;
}

interface LowMarginItem {
  itemDescription: string;
  quantity: number;
  marginPercent: number;
}

interface GenerateQuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  rfqId: string;
  userRole?: string;
  onSuccess: (quotationId: string, quotationCode: string) => void;
}

export function GenerateQuotationModal({
  isOpen,
  onClose,
  rfqId,
  userRole,
  onSuccess,
}: GenerateQuotationModalProps) {
  const [loading, setLoading] = useState(true);
  const [validityDays, setValidityDays] = useState("30");
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [lowMarginItems, setLowMarginItems] = useState<LowMarginItem[]>([]);
  const [marginFloor, setMarginFloor] = useState(15.0);
  const [costingCount, setCostingCount] = useState({ total: 0, costed: 0 });
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const isManagerOrAdmin = ["SalesManager", "Admin"].includes(userRole || "");

  // Load checklist items
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setPendingItems([]);
    setLowMarginItems([]);
    setErrorMsg("");

    const fetchChecklist = async () => {
      try {
        // Fetch RFQ detail including quantity breaks and costing sheets to verify locally
        const res = await fetch(`/api/rfq/${rfqId}`);
        const data = await res.json();
        if (data.success && data.data) {
          const rfq = data.data;

          // Count line items and costed breaks
          const items = rfq.lineItems || [];
          const totalItems = items.length;
          const costedItems = items.filter((item: any) => item.costingStatus === "Done").length;
          setCostingCount({ total: totalItems, costed: costedItems });

          const pending = items.filter((item: any) => item.costingStatus !== "Done");
          setPendingItems(pending);

          // Get margin floor settings
          const sheetsRes = await fetch(`/api/rfq/${rfqId}/costing-sheet`);
          const sheetsData = await sheetsRes.json();

          if (sheetsData.success && sheetsData.data) {
            const sheets = sheetsData.data;
            const lowMargins: LowMarginItem[] = [];

            // Retrieve threshold (default to 15)
            let threshold = 15.0;
            try {
              // We'll read from system configs or fallback
              const cRes = await fetch("/api/system-configs").then((r) => r.json()).catch(() => null);
              if (cRes?.success && Array.isArray(cRes.data)) {
                const floorConfig = cRes.data.find((c: any) => c.key === "rfq_margin_floor_percent");
                if (floorConfig) {
                  threshold = parseFloat(floorConfig.value);
                }
              }
            } catch {}
            setMarginFloor(threshold);

            // Match each quantity break of each line item with its latest costing sheet
            for (const item of items) {
              const itemSheets = sheets.filter((s: any) => s.rfqLineItemId === item.id);
              for (const qb of item.quantityBreaks || []) {
                const sheet = itemSheets.find((s: any) => s.quantityBreakId === qb.id);
                if (sheet && sheet.marginPercent < threshold) {
                  lowMargins.push({
                    itemDescription: item.itemDescription,
                    quantity: qb.quantity,
                    marginPercent: sheet.marginPercent,
                  });
                }
              }
            }
            setLowMarginItems(lowMargins);
          }
        }
      } catch (e) {
        console.error("Failed to load quotation checklist:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchChecklist();
  }, [isOpen, rfqId]);

  if (!isOpen) return null;

  const hasPending = pendingItems.length > 0;
  const hasLowMargin = lowMarginItems.length > 0;
  const isBlocked = hasPending || (hasLowMargin && !isManagerOrAdmin);

  const handleGenerate = async () => {
    if (isBlocked) return;

    setGenerating(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/rfq/${rfqId}/generate-quotation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          validityDays: parseInt(validityDays) || 30,
        }),
      });

      const data = await res.json();
      if (data.success) {
        onSuccess(data.data.quotation_id, data.data.quotation_code);
        onClose();
      } else {
        setErrorMsg(data.message || "Failed to generate quotation");
      }
    } catch {
      setErrorMsg("Failed to generate quotation due to a network error");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden shadow-2xl flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
            Quotation Generation Gate
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-8 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-[var(--primary)]" size={24} />
            <p className="text-xs text-slate-400 italic">Verifying costing checks...</p>
          </div>
        ) : (
          <div className="p-5 space-y-4 flex-1">
            {/* Checklist */}
            <div className="space-y-3">
              {/* Check 1: Costing completion */}
              <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-950/40 rounded-lg border border-slate-100 dark:border-slate-850">
                {hasPending ? (
                  <AlertTriangle className="text-amber-500 mt-0.5 flex-shrink-0" size={16} />
                ) : (
                  <CheckCircle className="text-emerald-500 mt-0.5 flex-shrink-0" size={16} />
                )}
                <div className="text-xs">
                  <p className="font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                    Costing Status Check
                  </p>
                  <p className="text-slate-500">
                    {costingCount.costed} of {costingCount.total} line items fully costed.
                  </p>
                  {hasPending && (
                    <div className="mt-2 space-y-1">
                      <p className="text-red-500 font-medium">Pending items:</p>
                      <ul className="list-disc list-inside text-slate-400 pl-1 space-y-0.5">
                        {pendingItems.map((item) => (
                          <li key={item.id} className="truncate max-w-[300px]">
                            {item.itemDescription}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Check 2: Margin floor */}
              <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-950/40 rounded-lg border border-slate-100 dark:border-slate-850">
                {hasLowMargin ? (
                  isManagerOrAdmin ? (
                    <AlertTriangle className="text-amber-500 mt-0.5 flex-shrink-0" size={16} />
                  ) : (
                    <ShieldAlert className="text-rose-500 mt-0.5 flex-shrink-0" size={16} />
                  )
                ) : (
                  <CheckCircle className="text-emerald-500 mt-0.5 flex-shrink-0" size={16} />
                )}
                <div className="text-xs">
                  <p className="font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                    Margin Floor Threshold ({marginFloor}%)
                  </p>
                  <p className="text-slate-500">
                    {hasLowMargin
                      ? `${lowMarginItems.length} price tier(s) fall below the floor limit.`
                      : "All costed items satisfy the minimum margin requirements."}
                  </p>
                  {hasLowMargin && (
                    <div className="mt-2 space-y-1">
                      <p className={isManagerOrAdmin ? "text-amber-600 font-medium" : "text-rose-600 font-medium"}>
                        {isManagerOrAdmin
                          ? "Low-margin items (Manager override permitted):"
                          : "Low-margin items (Approval required):"}
                      </p>
                      <ul className="list-disc list-inside text-slate-400 pl-1 space-y-0.5">
                        {lowMarginItems.map((item, idx) => (
                          <li key={idx} className="truncate max-w-[300px]">
                            {item.itemDescription} (Qty: {item.quantity}) —{" "}
                            <strong className="text-rose-500">{item.marginPercent}% margin</strong>
                          </li>
                        ))}
                      </ul>
                      {!isManagerOrAdmin && (
                        <p className="text-[10px] text-rose-500 mt-1 font-bold uppercase tracking-wider">
                          ⛔ Locked: Sales Manager or Admin privilege required.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Inputs: Validity */}
            {!isBlocked && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Calendar size={12} /> Quote Validity (Days)
                </label>
                <input
                  type="number"
                  value={validityDays}
                  onChange={(e) => setValidityDays(e.target.value)}
                  placeholder="30"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:border-[var(--primary)] focus:outline-none bg-transparent"
                />
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-600">
                {errorMsg}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-white dark:bg-slate-900">
          <button
            onClick={onClose}
            disabled={generating}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading || generating || isBlocked}
            className={`px-4 py-2 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              isBlocked
                ? "bg-slate-100 dark:bg-slate-850 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-800"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {generating ? (
              <>
                <Loader2 className="animate-spin" size={13} /> Generating...
              </>
            ) : hasLowMargin && isManagerOrAdmin ? (
              "Override & Generate Quotation"
            ) : (
              "Generate Quotation"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
