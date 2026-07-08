"use client";

/**
 * Generates the one-line auto-summary shown in a collapsed StageAccordion header.
 * Also exported as a pure function for use in SSR contexts.
 */

type RequirementItem = {
  productName: string;
  estimatedQuantity: number;
  material?: string | null;
  technicalNote?: {
    feasibility?: string | null;
    confirmedSpec?: string | null;
  } | null;
};

type QualifiedData = {
  budgetRange?: string | null;
  timeline?: string | null;
  leadVerified?: boolean | null;
};

type MeetingData = {
  meetingDate?: string | null;
  meetingType?: string | null;
  meetingStatus?: string | null;
};

type DemoData = {
  demoDate?: string | null;
  demoOutcome?: string | null;
};

export function generateStageSummary(
  stage: string,
  data: {
    qualified?: QualifiedData;
    requirementItems?: RequirementItem[];
    meeting?: MeetingData;
    demo?: DemoData;
  }
): string {
  switch (stage) {
    case "Qualified": {
      const q = data.qualified;
      if (!q) return "Pending qualification";
      const parts: string[] = [];
      if (q.leadVerified) parts.push("Lead verified");
      if (q.budgetRange) parts.push(q.budgetRange);
      if (q.timeline) parts.push(q.timeline);
      return parts.length > 0 ? parts.join(" · ") : "Pending qualification";
    }

    case "RequirementGathering": {
      const items = data.requirementItems;
      if (!items || items.length === 0) return "No products added yet";
      const first = items[0];
      const extra = items.length > 1 ? ` +${items.length - 1} more` : "";
      const parts = [
        first.productName,
        `qty ${first.estimatedQuantity}`,
        first.material ? first.material : null,
      ].filter(Boolean);
      return parts.join(", ") + extra;
    }

    case "TechnicalDiscussion": {
      const items = data.requirementItems;
      if (!items || items.length === 0) return "No items reviewed";
      const feasible = items.filter(
        (i) => i.technicalNote?.feasibility === "Feasible" || i.technicalNote?.feasibility === "FeasibleWithChanges"
      ).length;
      const total = items.length;
      if (feasible === total) {
        // Surface the first confirmedSpec note if available
        const note = items[0]?.technicalNote?.confirmedSpec;
        return note ? `All ${total} feasible — ${note.slice(0, 40)}${note.length > 40 ? "…" : ""}` : `All ${total} products cleared`;
      }
      return `${feasible} of ${total} products cleared`;
    }

    case "MeetingScheduled": {
      const m = data.meeting;
      if (!m?.meetingDate) return "Meeting not yet scheduled";
      const d = new Date(m.meetingDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      return [m.meetingType, d, m.meetingStatus].filter(Boolean).join(" · ");
    }

    case "DemoConducted": {
      const d = data.demo;
      if (!d?.demoDate) return "Demo not yet conducted";
      const date = new Date(d.demoDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      return d.demoOutcome ? `${d.demoOutcome} — ${date}` : date;
    }

    default:
      return "";
  }
}

/**
 * React component wrapper — renders the summary as a span.
 * Use `generateStageSummary()` directly when you just need the string.
 */
export function StageSummaryLine({
  stage,
  data,
  className,
}: {
  stage: string;
  data: Parameters<typeof generateStageSummary>[1];
  className?: string;
}) {
  const text = generateStageSummary(stage, data);
  return <span className={className}>{text}</span>;
}
