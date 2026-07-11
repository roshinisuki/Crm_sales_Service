"use client";

import { StatusStepper } from "@/components/ui/StatusStepper";
import { Ico, icons } from "./QuotationIcons";

interface QuotationStatusTimelineProps {
  quotation: any;
}

export default function QuotationStatusTimeline({ quotation }: QuotationStatusTimelineProps) {
  const order = ["Draft", "Approved", "Sent", "UnderReview", "Accepted", "Deal/PO"];
  const currentIdx = order.indexOf(quotation.status === "Rejected" || quotation.status === "Expired" ? "Accepted" : quotation.status);
  const isRejected = quotation.status === "Rejected";

  return (
    <section className="crm-card p-5">
      <StatusStepper
        compact
        steps={["Draft", "Approved", "Sent", "UnderReview", "Accepted", "Deal/PO"].map((key, idx) => {
          const stageIdx = idx;
          const isDone = stageIdx < currentIdx;
          const isCurrent = key === quotation.status || (key === "Deal/PO" && quotation.status === "Accepted" && quotation.dealId);
          const labelMap: Record<string, string> = { Draft: "Draft", Approved: "Approved", Sent: "Sent", UnderReview: "Negotiation", Accepted: "Accepted", "Deal/PO": "Deal / PO" };
          return {
            label: labelMap[key],
            key,
            reached: isDone || isCurrent,
            active: isCurrent,
            terminal: isRejected && stageIdx >= currentIdx ? ("danger" as const) : undefined,
          };
        })}
      />
      {quotation.status === "Rejected" && (
        <p className="text-xs text-[var(--status-danger-text)] font-medium mt-2 flex items-center gap-1"><Ico d={icons.x} size={12} /> Quotation rejected — use Clone &amp; Revise to create a new revision</p>
      )}
      {quotation.status === "Expired" && (
        <p className="text-xs text-[var(--text-muted)] font-medium mt-2 flex items-center gap-1"><Ico d={icons.clock} size={12} /> Quotation expired — use Clone &amp; Revise to create a new revision with updated validity</p>
      )}
    </section>
  );
}
