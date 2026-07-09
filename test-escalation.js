const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const req = await prisma.serviceRequest.findFirst();
  if (!req) {
    console.log("No service request found to test.");
    return;
  }

  // Create an escalation rule that applies to this request's category and priority
  const rule = await prisma.escalationRule.create({
    data: {
      name: "Test Instant Breach",
      categoryId: req.categoryId,
      priorityId: req.priorityId,
      thresholdHours: 0, // 0 hours ensures it breaches immediately
      triggerCondition: "SinceCreation",
      isActive: true,
    }
  });

  console.log("Created Escalation Rule:", rule);

  // Now hit our compute logic (imported from lib or just duplicated for the test)
  const now = new Date().getTime();
  const createdMs = new Date(req.createdAt).getTime();
  const diffHours = (now - createdMs) / (1000 * 60 * 60);

  let escalationLevel = 0;
  let escalationReason = "";

  if (diffHours >= rule.thresholdHours) {
    escalationLevel = 1;
    escalationReason = `Breached SLA: ${rule.name} (>${rule.thresholdHours}h since creation)`;
  }

  console.log("Simulated Computation on Service Request:", {
    id: req.id,
    title: req.title,
    createdAt: req.createdAt,
    escalationLevel,
    escalationReason
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
