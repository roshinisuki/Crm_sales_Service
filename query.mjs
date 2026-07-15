import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const reqs = await prisma.serviceRequest.count();
  const comps = await prisma.complaint.count();
  const defs = await prisma.defect.count();
  const insts = await prisma.installation.count();
  const visits = await prisma.serviceVisit.count();
  const revs = await prisma.serviceReview.count();
  console.log({
    serviceRequests: reqs,
    complaints: comps,
    defects: defs,
    installations: insts,
    serviceVisits: visits,
    serviceReviews: revs
  });
}

main().finally(() => prisma.$disconnect());
