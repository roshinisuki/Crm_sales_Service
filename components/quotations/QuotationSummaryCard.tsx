"use client";

import { cn } from "@/lib/ui-utils";
import { statusColors } from "./QuotationStatusColors";
import { Ico, icons } from "./QuotationIcons";

interface QuotationSummaryCardProps {
  quotation: any;
  overallMargin: number | null;
  overallMarginColor: string;
  marginFloor: number;
  formatCurrency: (value: number) => string;
}

function SummaryField({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{label}</p>
      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export default function QuotationSummaryCard({ quotation, overallMargin, overallMarginColor, marginFloor, formatCurrency }: QuotationSummaryCardProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const validUntilDate = quotation.validUntil ? new Date(quotation.validUntil) : null;
  const daysRemaining = validUntilDate ? Math.ceil((validUntilDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const validityColor = daysRemaining === null ? "text-slate-500" : daysRemaining <= 3 ? "text-rose-600" : daysRemaining <= 7 ? "text-amber-600" : "text-slate-500";

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm p-6">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusColors[quotation.status]}`}>{quotation.status}</span>
        {quotation.status === "Sent" && daysRemaining !== null && (
          <>
            {daysRemaining >= 0 ? (
              <span className={`text-xs font-medium ${validityColor}`}><Ico d={icons.clock} size={14} className="inline mr-1" />Expires in {daysRemaining} day{daysRemaining !== 1 ? "s" : ""}</span>
            ) : (
              <span className="text-xs font-medium text-red-600">Expired {Math.abs(daysRemaining)} day{Math.abs(daysRemaining) !== 1 ? "s" : ""} ago</span>
            )}
          </>
        )}
        <span className="text-xs text-slate-500">Valid Until: <strong className="text-slate-700 dark:text-slate-300">{validUntilDate?.toLocaleDateString() || "—"}</strong></span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryField label="Customer" value={quotation.customer?.name} sub={quotation.customer?.customerCode} />
        <SummaryField label="Contact" value={quotation.contact?.name || "—"} />
        <SummaryField label="Created By" value={quotation.createdBy?.name || "—"} />
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Grand Total</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl font-black text-[var(--primary)]">{formatCurrency(quotation.finalAmount)}</span>
            {overallMargin !== null && (
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md", overallMarginColor)}>
                Margin {overallMargin.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
