const fs = require('fs');
const content = `
export async function saveOpportunityDetailAction(dealId: string, payload: any) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role === "Customer") return { success: false, message: "Unauthorized" };

    const deal = await prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) return { success: false, message: "Deal not found" };

    if (!checkRecordScope(userPayload, deal, "Deal")) {
      return { success: false, message: "Unauthorized access to deal." };
    }

    const updated = await prisma.opportunityDetail.upsert({
      where: { dealId },
      update: payload,
      create: { dealId, ...payload }
    });

    await logAudit(
      userPayload.id,
      "Deal",
      "Update",
      \`Updated Opportunity Details for deal "\${deal.dealName}"\`
    );

    revalidatePath("/sales-pipeline");
    revalidatePath(\`/sales-pipeline/\${dealId}\`);

    return { success: true, data: updated };
  } catch (error: any) {
    console.error("Save Opportunity Detail Error:", error);
    return { success: false, message: error.message || "Failed to save details" };
  }
}
`;
fs.appendFileSync('app/actions/deals.ts', content);
