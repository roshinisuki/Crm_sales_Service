const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function test() {
    try {
        const id = "25fab1d5-3d5d-41f2-94b7-d8e394917f1f";
        const rfq = await p.rFQ.findFirst({
            where: { id },
            select: {
                id: true,
                rfqCode: true,
                status: true,
                priority: true,
                receivedDate: true,
                opportunityId: true,
                customer: { select: { name: true, customerCode: true, email: true, phone: true, city: true } },
                lineItems: {
                    select: { id: true, itemDescription: true, quantity: true, needsFeasibilityReview: true, displayOrder: true },
                    orderBy: { displayOrder: "asc" }
                }
            }
        });
        
        if (!rfq) {
            console.log("RFQ not found");
            return;
        }
        console.log("RFQ found:", rfq.rfqCode);

        const opportunity = await p.deal.findUnique({
            where: { id: rfq.opportunityId },
            select: {
                id: true, dealName: true, opportunityCode: true, status: true, demoOutcome: true, demoFollowUpDate: true,
                opportunityDetail: {
                    select: { demoDate: true, demoType: true, demoQuestionsRaised: true, demoRejectionRemarks: true, demoInterestLevel: true, meetingDate: true, meetingType: true, meetingStatus: true }
                },
                requirementItems: {
                    select: {
                        id: true, productName: true, estimatedQuantity: true, targetPriceMin: true, targetPriceMax: true, material: true, requiredDelivery: true, specNotes: true,
                        technicalNote: {
                            select: { feasibility: true, confirmedSpec: true, toolingRequired: true, reviewedAt: true, engineer: { select: { name: true } } }
                        }
                    },
                    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }]
                },
                stageHistories: {
                    select: { fromStatus: true, toStatus: true, changedAt: true, outcomeNotes: true },
                    orderBy: { changedAt: "asc" }
                }
            }
        });
        console.log("Opportunity found:", opportunity?.dealName);

        const rfqLineItemDescriptions = new Set(rfq.lineItems.map((li) => li.itemDescription));
        
        const requirementItems = (opportunity?.requirementItems || []).map((item) => ({
            id: item.id,
            productName: item.productName,
            estimatedQuantity: item.estimatedQuantity,
            targetPriceMin: item.targetPriceMin ? Number(item.targetPriceMin) : null,
            targetPriceMax: item.targetPriceMax ? Number(item.targetPriceMax) : null,
            material: item.material,
            requiredDelivery: item.requiredDelivery,
            specNotes: item.specNotes,
            feasibility: item.technicalNote?.feasibility ?? null,
            confirmedSpec: item.technicalNote?.confirmedSpec ?? null,
            toolingRequired: item.technicalNote?.toolingRequired ?? null,
            reviewedAt: item.technicalNote?.reviewedAt ?? null,
            engineerName: item.technicalNote?.engineer?.name ?? null,
            includedInRFQ: rfqLineItemDescriptions.has(item.productName),
            needsFeasibilityReview: !item.technicalNote || !["Feasible", "FeasibleWithChanges"].includes(item.technicalNote?.feasibility ?? "")
        }));
        
        console.log("Mapped requirement items:", requirementItems.length);
        
        const data = {
            rfq: { rfqCode: rfq.rfqCode, status: rfq.status, priority: rfq.priority, receivedDate: rfq.receivedDate },
            customer: rfq.customer,
            opportunity: opportunity ? {
                dealName: opportunity.dealName,
                opportunityCode: opportunity.opportunityCode,
                currentStatus: opportunity.status,
                demoOutcome: opportunity.demoOutcome,
                demoFollowUpDate: opportunity.demoFollowUpDate,
                demoDate: opportunity.opportunityDetail?.demoDate ?? null,
                demoType: opportunity.opportunityDetail?.demoType ?? null,
                demoNotes: [opportunity.opportunityDetail?.demoQuestionsRaised, opportunity.opportunityDetail?.demoRejectionRemarks].filter(Boolean).join("\n\n") || null,
                demoInterestLevel: opportunity.opportunityDetail?.demoInterestLevel ?? null,
                meetingDate: opportunity.opportunityDetail?.meetingDate ?? null,
                meetingType: opportunity.opportunityDetail?.meetingType ?? null,
                meetingStatus: opportunity.opportunityDetail?.meetingStatus ?? null,
            } : null,
            stageHistory: opportunity?.stageHistories ?? [],
            requirementItems,
            generatedAt: new Date().toISOString()
        };
        
        console.log("SUCCESS. Data keys:", Object.keys(data));
        console.log("Stringified:", JSON.stringify(data).substring(0, 200));

    } catch (e) {
        console.error("RUNTIME ERROR:", e);
    }
}
test().finally(() => p.$disconnect());
