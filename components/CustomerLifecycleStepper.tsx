"use client";

import React from "react";
import { cn } from "@/lib/ui-utils";
import { Check } from "lucide-react";

const LIFECYCLE_STAGES = [
  "Lead",
  "Qualified",
  "Deal",
  "Proposal",
  "Negotiation",
  "Won",
  "Subscription",
  "Portal Activation",
  "Active Customer"
];

export default function CustomerLifecycleStepper({ currentStage }: { currentStage: string }) {
  // Normalize current stage name mapping
  let activeIdx = LIFECYCLE_STAGES.findIndex(
    s => s.toLowerCase() === currentStage.toLowerCase()
  );

  // Fallback mappings - clamp to last valid index (8) to prevent out-of-bounds crash
  if (activeIdx === -1) {
    if (currentStage === "New" || currentStage === "Contacted" || currentStage === "FollowUpDue") activeIdx = 0;
    else if (currentStage === "SQL") activeIdx = 1;
    else if (currentStage === "Qualified") activeIdx = 2;
    else if (currentStage === "Converted") activeIdx = 3;
    else if (["Open", "ProposalSent", "Negotiation"].includes(currentStage)) activeIdx = 4;
    else if (currentStage === "Draft" || currentStage === "Sent") activeIdx = 5;
    else if (currentStage === "Approved" || currentStage === "ContractReview") activeIdx = 6;
    else if (currentStage === "Won" || currentStage === "PaymentPending") activeIdx = 7;
    else if (currentStage === "SubscriptionActive") activeIdx = 8;
    else if (currentStage === "ActiveCustomer") activeIdx = 8; // Fixed: was 10, clamped to 8 (last valid index)
    else activeIdx = 0;
  }

  return (
    <div className="w-full py-4 overflow-x-auto">
      <div className="flex items-center min-w-[800px] px-2">
        {LIFECYCLE_STAGES.map((stage, i) => {
          const isDone = i < activeIdx;
          const isActive = i === activeIdx;
          const isFuture = i > activeIdx;

          return (
            <React.Fragment key={stage}>
              {/* Step circle */}
              <div className="flex flex-col items-center flex-1 min-w-0 relative group">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 shadow-sm",
                    isDone
                      ? "bg-[var(--primary)] text-[var(--accent-contrast)]"
                      : isActive
                      ? "bg-[var(--primary)] text-[var(--accent-contrast)] ring-4 ring-[var(--accent-soft)] scale-105"
                      : "bg-[var(--surface-2)] text-[var(--text-muted)]"
                  )}
                >
                  {isDone ? <Check size={14} strokeWidth={3} /> : i + 1}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-bold mt-2 text-center whitespace-nowrap tracking-tight max-w-[80px] truncate",
                    isDone ? "text-[var(--status-success-text)]" : isActive ? "text-[var(--text-primary)] font-extrabold" : "text-[var(--text-muted)]"
                  )}
                >
                  {stage}
                </span>
              </div>

              {/* Progress Line */}
              {i < LIFECYCLE_STAGES.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 -mt-6 rounded-full mx-1 transition-all duration-300",
                    isDone ? "bg-[var(--status-success)]" : "bg-[var(--border)]"
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
