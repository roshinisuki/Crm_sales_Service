const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function test() {
    const rfq = await p.rFQ.create({
        data: {
            rfqCode: `TEST-${Date.now()}`,
            customerId: "0c7b433b-97af-4942-b8de-a6f4bc0a85dc",
            opportunityId: "40d216f4-b2b9-4f7d-a197-3d77fb1af7dc",
            status: "New",
            companyId: "d7c09cf6-7d1a-4173-8dd4-bca42a4e8bc7",
            lineItems: {
                create: [
                    {
                        itemDescription: "Test Item",
                        quantity: 5,
                        targetPrice: null,
                        requestedDeliveryDate: null,
                        specifications: "Specs",
                        notes: null,
                        displayOrder: 0,
                        needsFeasibilityReview: false,
                        quantityBreaks: {
                            create: [{ quantity: 5 }]
                        }
                    }
                ]
            }
        }
    });
    console.log(rfq);
}

test().catch(e => console.error(e)).finally(() => p.$disconnect());
