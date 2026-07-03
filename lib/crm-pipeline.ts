import { prisma } from "@/lib/prisma";
type CustomerStatus = "Prospect" | "ActiveCustomer" | "Renewed" | "Churned";
type LeadStatus = "New" | "Contacted" | "FollowUpDue" | "SQL" | "Qualified" | "Converted" | "Lost";

export async function processVisitOutcome(
  visitId: string,
  visitType: "Inbound" | "Outbound",
  outcome: string,
  customerDecision: string
): Promise<{ success: boolean; error?: string; portalMsg?: string }> {
  // Define outcomes
  const followUpOutcomes = [
    "Follow-up Required", "Follow-up Needed", "Pending Decision", "Interested",
    "Budget Hold", "Discount Requested", "Renewal Pending", "Revisit Needed",
    "Trial Requested", "Demo Rescheduled"
  ];
  
  const qualifiedOutcomes = ["Qualified Lead", "Demo Completed"];

  const closedWonOutcomes = ["Converted", "Closed Won", "Renewed", "Resolved"];
  const closedLostOutcomes = ["Closed Lost", "Not Interested", "Not Qualified", "Churn Risk"];

  let leadId: string | null = null;
  let customerId: string | null = null;

  if (visitType === "Inbound") {
    const visit = await prisma.customerVisit.findUnique({
      where: { id: visitId }
    });
    if (!visit) return { success: false, error: "Visit not found." };
    customerId = visit.customerId;
  } else {
    const visit = await prisma.marketingVisit.findUnique({
      where: { id: visitId }
    });
    if (!visit) return { success: false, error: "Visit not found." };
    customerId = visit.customerId;
    leadId = visit.leadId;
  }

  let portalMsg = "";

  // 1. Process Lead Progression
  if (leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return { success: false, error: "Lead not found." };

    let nextLeadStatus = lead.status;

    if (closedWonOutcomes.includes(outcome)) {
      nextLeadStatus = "Converted";
    } else if (closedLostOutcomes.includes(outcome)) {
      nextLeadStatus = "Lost";
    } else if (qualifiedOutcomes.includes(outcome)) {
      nextLeadStatus = "Qualified";
    } else if (followUpOutcomes.includes(outcome)) {
      if (lead.status === "New") {
        nextLeadStatus = "Contacted";
      }
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: { status: nextLeadStatus }
    });

    if (nextLeadStatus === "Converted") {
      const { convertLeadToCustomerAction } = await import("@/app/actions/leads");
      const conversionRes = await convertLeadToCustomerAction(leadId);
      if (conversionRes.success && conversionRes.data) {
        portalMsg = " Lead converted to Customer.";
        customerId = conversionRes.data.id; // Map subsequent operations to new customer
      }
    }
  }

  // 2. Process Customer Progression
  if (customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return { success: false, error: "Customer.status not found." };

    let nextCustomerStatus = customer.status;
    let requiresPortalActivation = false;

    if (closedWonOutcomes.includes(outcome)) {
      nextCustomerStatus = "ActiveCustomer";
    } else if (closedLostOutcomes.includes(outcome)) {
      nextCustomerStatus = "Churned";
    }

    if (customerDecision === "APPROVED") {
      requiresPortalActivation = true;
      nextCustomerStatus = "ActiveCustomer";
    } else if (customerDecision === "REJECTED") {
      nextCustomerStatus = "Churned";
    }

    // Use centralized customer status service for validation and history
    if (nextCustomerStatus !== customer.status) {
      const { setCustomerStatus } = await import("@/lib/customerService");
      // Get a system user ID for the transition
      const systemUser = await prisma.user.findFirst({
        where: { role: { in: ["SuperAdmin", "Admin"] }, isActive: true },
        select: { id: true }
      });
      
      await setCustomerStatus(customerId, nextCustomerStatus as any, {
        actorId: systemUser?.id || "system",
        reason: `Visit outcome: ${outcome}${customerDecision ? `, decision: ${customerDecision}` : ""}`,
        companyId: customer.companyId || "",
        isAdminOverride: true, // Allow visit-based activation with reason
      });
    }

    if (requiresPortalActivation) {
      const { activateCustomerPortal } = await import("@/app/actions/auth");
      const emailRes = await activateCustomerPortal(customerId);
      if (emailRes.success) {
        portalMsg += " Portal activation link emailed.";
      }
    }
  }

  return { success: true, portalMsg };
}
