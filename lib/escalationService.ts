import { prisma } from "@/lib/prisma";

export async function computeEscalations(records: any[]) {
  if (!records || records.length === 0) return records;

  // Fetch all active escalation rules
  const rules = await prisma.escalationRule.findMany({
    where: { isActive: true },
    include: { category: true, priority: true }
  });

  if (rules.length === 0) return records;

  const now = new Date().getTime();

  return records.map(record => {
    // Find matching rule
    const matchingRules = rules.filter(r => 
      r.categoryId === record.categoryId && 
      r.priorityId === record.priorityId
    );

    if (matchingRules.length === 0) return record;

    let escalationLevel = 0;
    let escalationReason = "";

    for (const rule of matchingRules) {
      if (rule.triggerCondition === "SinceCreation" && record.createdAt) {
        const createdMs = new Date(record.createdAt).getTime();
        const diffHours = (now - createdMs) / (1000 * 60 * 60);

        if (diffHours >= rule.thresholdHours) {
          escalationLevel = 1;
          escalationReason = `Breached SLA: ${rule.name} (>${rule.thresholdHours}h since creation)`;
          break; // Stop at first breach for simplicity
        }
      }
      
      // Could add more triggerConditions like SinceLastUpdate, StatusUnchanged etc.
    }

    return {
      ...record,
      escalationLevel,
      escalationReason,
    };
  });
}
