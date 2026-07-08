"use client";

import { useState } from "react";
import { FileText, ArrowRight, CheckCircle, Package } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/ui-utils";

export interface RFQLinePreview {
  productName: string;
  quantity: number;
  confirmedSpec?: string | null;
  specNotes?: string | null;
  material?: string | null;
  requiredDelivery?: string | null;
  feasibility?: "Feasible" | "FeasibleWithChanges";
}

interface RFQSummaryCardProps {
  items: RFQLinePreview[];
  /** Existing RFQ id — if already created, navigates directly */
  rfqId?: string | null;
  opportunityId: string;
  onCreateRFQ: () => Promise<{ rfqId?: string }>;
}

export function RFQSummaryCard({ items, rfqId, opportunityId, onCreateRFQ }: RFQSummaryCardProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const handleClick = async () => {
    if (rfqId) {
      router.push(`/rfq/${rfqId}`);
      return;
    }
    setCreating(true);
    try {
      const result = await onCreateRFQ();
      if (result.rfqId) {
        router.push(`/rfq/${result.rfqId}`);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-green-100/60 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800/50 flex items-center gap-2">
        <CheckCircle size={16} className="text-green-600 dark:text-green-400" />
        <p className="text-sm font-medium text-green-800 dark:text-green-300">Demo accepted — review and create RFQ</p>
      </div>

      {/* Product list */}
      <div className="p-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          The following{items.length === 1 ? " product has" : ` ${items.length} products have`} been carried over from Requirement Gathering and Technical Discussion:
        </p>

        <div className="space-y-2 mb-4">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-4 rounded-lg border border-green-200 dark:border-green-800/50 bg-white dark:bg-slate-900 px-3 py-2.5"
            >
              <div className="flex items-center gap-2 flex-shrink-0">
                <Package size={14} className="text-slate-400" />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.productName}</span>
                <span className="text-xs text-slate-500">× {item.quantity}</span>
              </div>
              <div className="flex-1 space-y-1">
                {/* Confirmed spec with source label */}
                {(item.confirmedSpec || item.specNotes) && (
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {item.confirmedSpec || item.specNotes}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {item.confirmedSpec ? "from Technical Discussion" : "from Requirement Gathering"}
                    </p>
                  </div>
                )}
                {item.material && (
                  <p className="text-xs text-slate-500">
                    Material: <span className="text-slate-700 dark:text-slate-300">{item.material}</span>
                    <span className="ml-1 text-[10px] text-slate-400 italic">from Req. Gathering</span>
                  </p>
                )}
                {item.requiredDelivery && (
                  <p className="text-xs text-slate-500">
                    Delivery: <span className="text-slate-700 dark:text-slate-300">
                      {new Date(item.requiredDelivery).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </p>
                )}
              </div>
              {item.feasibility && (
                <span className={cn(
                  "self-start flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border",
                  item.feasibility === "Feasible"
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                )}>
                  {item.feasibility === "Feasible" ? "Feasible" : "Feasible with changes"}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* CTA button */}
        <button
          type="button"
          onClick={handleClick}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {creating ? (
            "Creating…"
          ) : rfqId ? (
            <><FileText size={15} /> View RFQ</>
          ) : (
            <><ArrowRight size={15} /> Create RFQ</>  
          )}
        </button>
        {!rfqId && (
          <p className="text-[11px] text-slate-400 mt-1.5">
            This will create a pre-populated RFQ — not a blank form.
          </p>
        )}
      </div>
    </div>
  );
}
