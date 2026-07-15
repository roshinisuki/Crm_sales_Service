import { PrismaClient } from "@prisma/client";
import { randomUUID as uuidv4 } from "crypto";

const prisma = new PrismaClient();

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  console.log("🌱 Starting seeding of 20+ operational service workspace records...");

  // 1. Fetch dependencies
  const defaultCompany = await prisma.company.findFirst();
  if (!defaultCompany) {
    console.error("❌ No company found! Please seed base data first.");
    process.exit(1);
  }

  const users = await prisma.user.findMany({
    where: { companyId: defaultCompany.id }
  });
  const createdById = users[0]?.id;
  if (!createdById) {
    console.error("❌ No users found! Please seed base data first.");
    process.exit(1);
  }

  const customers = await prisma.customer.findMany({
    where: { companyId: defaultCompany.id }
  });
  if (customers.length === 0) {
    console.error("❌ No customers found! Please seed base data first.");
    process.exit(1);
  }

  const assets = await prisma.customerAsset.findMany();
  if (assets.length === 0) {
    console.error("❌ No customer assets found! Please seed serviceWorkspaceSeed first.");
    process.exit(1);
  }

  const categories = await prisma.serviceCategory.findMany();
  const complaintTypes = await prisma.complaintType.findMany();
  const defectTypes = await prisma.defectType.findMany();
  const priorities = await prisma.priorityLevel.findMany();
  const statuses = await prisma.serviceStatus.findMany();
  const teams = await prisma.serviceTeam.findMany();
  const engineers = await prisma.serviceEngineer.findMany();

  if (!categories.length || !priorities.length || !statuses.length || !teams.length || !engineers.length) {
    console.error("❌ Setup data is incomplete! Run npx prisma db seed first.");
    process.exit(1);
  }

  const getStatusByName = (name: string, module?: string) => {
    return module 
      ? statuses.find(s => s.name === name && s.module === module)?.id 
      : statuses.find(s => s.name === name)?.id;
  };

  const assetForCustomer = (custId: string, i: number) => {
    const custAssets = assets.filter(a => a.customerId === custId);
    return custAssets.length > 0 ? custAssets[i % custAssets.length].id : assets[i % assets.length].id;
  };

  // 2. Clean operational tables (delete reviews first, then visits, etc.)
  console.log("🧹 Cleaning existing operational service workspace data...");
  await prisma.serviceReview.deleteMany({});
  await prisma.serviceVisit.deleteMany({});
  await prisma.installation.deleteMany({});
  await prisma.defect.deleteMany({});
  await prisma.complaint.deleteMany({});
  await prisma.serviceRequest.deleteMany({});

  // 3. Seed 22 Service Requests
  console.log("🔧 Seeding 22 Service Requests...");
  const reqStatusCycle = ["New", "Assigned", "In Progress", "Pending Customer", "Resolved", "Closed"];
  const createdRequests = [];
  for (let i = 1; i <= 22; i++) {
    const statusName = reqStatusCycle[i % reqStatusCycle.length];
    const statusId = getStatusByName(statusName) || statuses[0].id;
    const cust = customers[i % customers.length];
    const priority = priorities[i % priorities.length];
    const category = categories[i % categories.length];

    const req = await prisma.serviceRequest.create({
      data: {
        title: `Machine Calibration Issue #${100 + i}`,
        description: `Calibration variance detected on the main compressor line. Variance matches ${i}% tolerance leak.`,
        categoryId: category.id,
        priorityId: priority.id,
        statusId,
        customerId: cust.id,
        customerAssetId: assetForCustomer(cust.id, i),
        assignedTeamId: statusName !== "New" ? teams[i % teams.length].id : null,
        assignedEngineerId: statusName !== "New" && statusName !== "Assigned" ? engineers[i % engineers.length].id : null,
        createdById,
        closedAt: statusName === "Closed" ? daysAgo(i) : null,
        createdAt: daysAgo(30 - i),
      }
    });
    createdRequests.push(req);
  }

  // 4. Seed 20 Complaints
  console.log("⚠️ Seeding 20 Complaints...");
  const compStatusCycle = ["New", "Investigating", "Resolved", "Closed"];
  const compStatusMap: Record<string, string> = { "New": "New", "Investigating": "In Progress", "Resolved": "Resolved", "Closed": "Closed" };
  const createdComplaints = [];
  for (let i = 1; i <= 20; i++) {
    const statusName = compStatusCycle[i % compStatusCycle.length];
    const statusId = getStatusByName(compStatusMap[statusName]) || statuses[0].id;
    const cust = customers[i % customers.length];
    const priority = priorities[i % priorities.length];
    const category = categories[i % categories.length];
    const cType = complaintTypes[i % complaintTypes.length] || { id: uuidv4() };

    const comp = await prisma.complaint.create({
      data: {
        title: `Customer Complaint: ${cType.name || "System Alarm"} #${100 + i}`,
        description: `Customer reported critical pressure drop in auxiliary hydraulic booster block.`,
        categoryId: category.id,
        complaintTypeId: cType.id,
        priorityId: priority.id,
        statusId,
        customerId: cust.id,
        customerAssetId: assetForCustomer(cust.id, i),
        assignedTeamId: statusName !== "New" ? teams[i % teams.length].id : null,
        assignedEngineerId: statusName === "Investigating" || statusName === "Resolved" ? engineers[i % engineers.length].id : null,
        createdById,
        closedAt: statusName === "Closed" ? daysAgo(i) : null,
        createdAt: daysAgo(25 - i),
      }
    });
    createdComplaints.push(comp);
  }

  // 5. Seed 20 Defects
  console.log("🔍 Seeding 20 Defects...");
  const defectStatusCycle = ["New", "Under Investigation", "Corrective Action", "Closed"];
  const defectStatusMap: Record<string, string> = { "New": "New", "Under Investigation": "In Progress", "Corrective Action": "Pending Customer", "Closed": "Closed" };
  const createdDefects = [];
  for (let i = 1; i <= 20; i++) {
    const statusName = defectStatusCycle[i % defectStatusCycle.length];
    const statusId = getStatusByName(defectStatusMap[statusName]) || statuses[0].id;
    const cust = customers[i % customers.length];
    const priority = priorities[i % priorities.length];
    const category = categories[i % categories.length];
    const dType = defectTypes[i % defectTypes.length] || { id: uuidv4() };

    const df = await prisma.defect.create({
      data: {
        title: `Structural Defect: ${dType.name || "Mechanical Bend"} #${100 + i}`,
        description: `Quality check identified micro-cracks in alignment rods. Needs component replacement.`,
        categoryId: category.id,
        defectTypeId: dType.id,
        priorityId: priority.id,
        statusId,
        customerId: cust.id,
        customerAssetId: assetForCustomer(cust.id, i),
        assignedTeamId: statusName !== "New" ? teams[i % teams.length].id : null,
        assignedEngineerId: statusName !== "New" ? engineers[i % engineers.length].id : null,
        createdById,
        closedAt: statusName === "Closed" ? daysAgo(i) : null,
        createdAt: daysAgo(20 - i),
      }
    });
    createdDefects.push(df);
  }

  // 6. Seed 20 Installations
  console.log("🔨 Seeding 20 Installations...");
  const installStatusCycle = ["Scheduled", "In Progress", "Completed"];
  const installStatusMap: Record<string, string> = { "Scheduled": "Assigned", "In Progress": "In Progress", "Completed": "Closed" };
  const createdInstallations = [];
  for (let i = 1; i <= 20; i++) {
    const statusName = installStatusCycle[i % installStatusCycle.length];
    const statusId = getStatusByName(installStatusMap[statusName]) || statuses[0].id;
    const cust = customers[i % customers.length];
    const priority = priorities[i % priorities.length];
    const category = categories[i % categories.length];

    const inst = await prisma.installation.create({
      data: {
        title: `Compressor Installation at ${cust.name.split(" ")[0]} #${100 + i}`,
        description: `Install, level, wire, and test newly procured Air Compressor unit.`,
        categoryId: category.id,
        priorityId: priority.id,
        statusId,
        customerId: cust.id,
        customerAssetId: assetForCustomer(cust.id, i),
        assignedTeamId: teams[i % teams.length].id,
        assignedEngineerId: engineers[i % engineers.length].id,
        createdById,
        closedAt: statusName === "Completed" ? daysAgo(i) : null,
        createdAt: daysAgo(15 - i),
      }
    });
    createdInstallations.push(inst);
  }

  // 7. Seed 20 Service Visits
  console.log("📅 Seeding 20 Service Visits...");
  const visitConfig = [
    { statusName: "Assigned", label: "Scheduled", offset: 2 },
    { statusName: "Assigned", label: "Scheduled", offset: 4 },
    { statusName: "Closed", label: "Completed", offset: -2 },
    { statusName: "Closed", label: "Completed", offset: -4 },
    { statusName: "Assigned", label: "Overdue", offset: -3 },
    { statusName: "Assigned", label: "Overdue", offset: -5 },
  ];
  const createdVisits = [];
  for (let i = 1; i <= 20; i++) {
    const vc = visitConfig[i % visitConfig.length];
    const statusId = getStatusByName(vc.statusName) || statuses[0].id;
    const isCompleted = vc.label === "Completed";
    const cust = customers[i % customers.length];
    const eng = engineers[i % engineers.length];

    const visit = await prisma.serviceVisit.create({
      data: {
        title: `Routine Service Visit #${100 + i}`,
        notes: `Preventive checkup of filters, telemetry calibration, and alignment validation.`,
        statusId,
        engineerId: eng.id,
        scheduledDate: vc.offset > 0 ? daysFromNow(vc.offset) : daysAgo(Math.abs(vc.offset)),
        checkInTime: isCompleted ? daysAgo(Math.abs(vc.offset)) : null,
        checkOutTime: isCompleted ? daysAgo(Math.abs(vc.offset)) : null,
        customerId: cust.id,
        customerAssetId: assetForCustomer(cust.id, i),
        outcomeNotes: isCompleted ? `Outcome: Satisfactory. No leakage detected.` : null,
        completedAt: isCompleted ? daysAgo(Math.abs(vc.offset)) : null,
        createdById,
      }
    });
    createdVisits.push(visit);
  }

  // 8. Seed 20 Service Reviews
  console.log("⭐ Seeding 20 Reviews & Feedback...");
  const reviewComments = [
    "Excellent service, quick check-in and resolution!",
    "Engineer was very polite and checked everything.",
    "Delay in response. Compressor is still generating noise.",
    "Average work. Leakage issue resolved but valve cover was left loose.",
    "Very professional calibration, pressure drop has stabilized.",
    "Unsatisfactory resolution. Still overheating, had to call back.",
    "Quick parts swap. Happy with the warranty coverage.",
    "Calibration check was thorough.",
    "Highly recommended technician. Explained the problem details.",
    "Average response time.",
  ];

  for (let i = 1; i <= 20; i++) {
    const cust = customers[i % customers.length];
    const eng = engineers[i % engineers.length];
    
    // Distribute star ratings (1-5)
    const rating = (i % 5) + 1; 
    const isEscalation = rating <= 2;
    const escalationResolved = isEscalation ? (i % 2 === 0) : false;
    const status = i % 4 === 0 ? "Pending" : "Submitted";

    // Link every review to a unique non-null combination of Requests, Complaints, Defects, Installations, and Visits
    // This fully satisfies SQL Server's unique constraint check (no duplicate NULL values)
    const serviceRequestId = createdRequests[(i - 1) % createdRequests.length].id;
    const complaintId = createdComplaints[(i - 1) % createdComplaints.length].id;
    const defectId = createdDefects[(i - 1) % createdDefects.length].id;
    const installationId = createdInstallations[(i - 1) % createdInstallations.length].id;
    const serviceVisitId = createdVisits[(i - 1) % createdVisits.length].id;

    await prisma.serviceReview.create({
      data: {
        customerId: cust.id,
        engineerId: eng.id,
        rating: status === "Submitted" ? rating : null,
        comment: status === "Submitted" ? reviewComments[i % reviewComments.length] : null,
        status,
        isEscalation,
        escalationResolved,
        serviceRequestId,
        complaintId,
        defectId,
        installationId,
        serviceVisitId,
        requestedAt: daysAgo(12 - i),
        submittedAt: status === "Submitted" ? daysAgo(12 - i - 1) : null,
      }
    });
  }

  console.log("🎉 Seeding complete successfully! Seeded 20+ records for all 6 tables. ✓");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
