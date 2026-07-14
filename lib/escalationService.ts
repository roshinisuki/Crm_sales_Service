import { prisma } from "@/lib/prisma";
import { dispatchNotification, dispatchNotificationsToMany } from "@/lib/notifications";

export async function computeEscalations(records: any[]) {
  if (!records || records.length === 0) return records;

  // Fetch all active escalation rules
  const rules = await prisma.escalationRule.findMany({
    where: { isActive: true },
    include: { category: true, priority: true }
  });

  const now = new Date().getTime();

  // Process records in parallel for notifications
  const processed = await Promise.all(records.map(async (record) => {
    // 1. Calculate SLA deadline (dueDate) from priority slaLimitHours
    const slaLimitHours = record.priority?.slaLimitHours || 24; // Fallback to 24h
    const createdTime = new Date(record.createdAt).getTime();
    const dueDate = new Date(createdTime + slaLimitHours * 60 * 60 * 1000);

    // Find matching rules for this category + priority
    const matchingRules = rules.filter(r => 
      r.categoryId === record.categoryId && 
      r.priorityId === record.priorityId
    );

    let escalationLevel = 0;
    let escalationReason = "";

    if (matchingRules.length > 0) {
      for (const rule of matchingRules) {
        if (rule.triggerCondition === "SinceCreation" && record.createdAt) {
          const diffHours = (now - createdTime) / (1000 * 60 * 60);

          if (diffHours >= rule.thresholdHours) {
            escalationLevel = 1;
            escalationReason = `Breached SLA: ${rule.name} (>${rule.thresholdHours}h since creation)`;

            // Trigger notification (prevent duplicates by checking if notification exists for this ticket)
            const link = `/service/${record.complaintTypeId ? "complaints" : record.defectTypeId ? "defects" : record.installationId ? "installations" : "requests"}/${record.id}`;
            const existingNotif = await prisma.notification.findFirst({
              where: { link }
            });

            if (!existingNotif) {
              const notifMsg = `Ticket "${record.title}" has breached the ${rule.name} SLA threshold of ${rule.thresholdHours} hours.`;
              try {
                if (rule.notifyUserId) {
                  await dispatchNotification({
                    userId: rule.notifyUserId,
                    title: "SLA Escalation Alert",
                    message: notifMsg,
                    type: "service",
                    link
                  });
                } else if (rule.notifyTeamId) {
                  // Notify all engineers in the team and their manager
                  const team = await prisma.serviceTeam.findUnique({
                    where: { id: rule.notifyTeamId },
                    include: { engineers: true }
                  });
                  const userIds = new Set<string>();
                  if (team) {
                    if (team.managerId) userIds.add(team.managerId);
                    team.engineers.forEach(e => userIds.add(e.userId));
                  }
                  if (userIds.size > 0) {
                    await dispatchNotificationsToMany({
                      userIds: Array.from(userIds),
                      title: "SLA Escalation Alert",
                      message: notifMsg,
                      type: "service",
                      link
                    });
                  }
                }
              } catch (err) {
                console.error("Failed to send escalation notification:", err);
              }
            }
            break; // Stop at first breach for simplicity
          }
        }
      }
    }

    return {
      ...record,
      dueDate: dueDate.toISOString(),
      escalationLevel,
      escalationReason,
    };
  }));

  return processed;
}
