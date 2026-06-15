const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const dealId = "8fc8d684-6666-4912-b1c4-13c219db5a6e";
  const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        customer: true,
        assignedUser: { select: { id: true, name: true, email: true } },
        stageHistories: {
          include: { changedBy: { select: { name: true } } },
          orderBy: { changedAt: "desc" }
        },
        proposals: {
          orderBy: { createdAt: "desc" }
        },
        opportunityDetail: true
      }
    });

  const serialized = {
      ...deal,
      createdAt: deal.createdAt.toISOString(),
      updatedAt: deal.updatedAt.toISOString(),
      expectedCloseDate: deal.expectedCloseDate.toISOString(),
      customer: {
        ...deal.customer,
        createdAt: deal.customer.createdAt.toISOString(),
        updatedAt: deal.customer.updatedAt.toISOString()
      },
      stageHistories: (deal).stageHistories?.map((h) => ({
        ...h,
        changedAt: h.changedAt.toISOString()
      })) || [],
      proposals: (deal).proposals?.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        validUntil: p.validUntil.toISOString()
      })) || [],
      opportunityDetail: deal.opportunityDetail ? {
        ...deal.opportunityDetail,
        expectedGoLive: deal.opportunityDetail.expectedGoLive?.toISOString() || null,
        meetingDate: deal.opportunityDetail.meetingDate?.toISOString() || null,
        demoDate: deal.opportunityDetail.demoDate?.toISOString() || null,
        createdAt: deal.opportunityDetail.createdAt?.toISOString() || null,
        updatedAt: deal.opportunityDetail.updatedAt?.toISOString() || null
      } : null
    };
    
    console.log("Success!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
