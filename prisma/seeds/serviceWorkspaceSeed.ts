import { PrismaClient } from "@prisma/client";
import { randomUUID as uuidv4 } from "crypto";

export async function seedServiceWorkspace(prisma: PrismaClient) {
  console.log("Starting Service Workspace seeding...");

  // 1. Fetch dependencies
  const defaultCompany = await prisma.company.findFirst();
  if (!defaultCompany) {
    console.log("No company found, skipping Service Workspace seed.");
    return;
  }

  const users = await prisma.user.findMany({
    where: { companyId: defaultCompany.id }
  });
  if (users.length === 0) {
    console.log("No users found, skipping Service Workspace seed.");
    return;
  }

  const customers = await prisma.customer.findMany({
    where: { companyId: defaultCompany.id }
  });
  if (customers.length === 0) {
    console.log("No customers found, skipping Service Workspace seed.");
    return;
  }

  // 2. Clean Service tables (Safe ordering: children first)
  console.log("Cleaning existing Service Workspace settings tables...");
  await prisma.customerAsset.deleteMany({});
  await prisma.serviceEngineer.deleteMany({});
  await prisma.serviceTeam.deleteMany({});
  await prisma.serviceStatus.deleteMany({});
  await prisma.priorityLevel.deleteMany({});
  await prisma.defectType.deleteMany({});
  await prisma.complaintType.deleteMany({});
  await prisma.serviceCategory.deleteMany({});

  // 3. Seed Service Categories (10 categories)
  console.log("Seeding Service Categories...");
  const categories = [
    { name: "Preventive Maintenance", description: "Regular scheduled maintenance checkups, sensor testing, and fluid changes." },
    { name: "Breakdown Service", description: "Emergency repair services for sudden machine or component breakdown." },
    { name: "Installation", description: "On-site installation and configuration of new equipment." },
    { name: "Commissioning", description: "Official testing and deployment of newly installed equipment lines." },
    { name: "Calibration", description: "System calibration to meet factory pressure, torque, and accuracy tolerances." },
    { name: "Inspection", description: "Routine health check, diagnostics, and telemetry analysis." },
    { name: "Repair", description: "Corrective repair or restoration of mechanical or electrical modules." },
    { name: "Warranty Support", description: "Fulfillment and resolution of issues covered under manufacturer warranty." },
    { name: "AMC Support", description: "Service visits and troubleshooting covered under active Annual Maintenance Contracts." },
    { name: "Spare Replacement", description: "On-site installation and testing of critical spare parts." }
  ];
  for (const cat of categories) {
    await prisma.serviceCategory.create({
      data: {
        id: uuidv4(),
        name: cat.name,
        description: cat.description,
        isActive: true
      }
    });
  }

  // 4. Seed Complaint Types (10 types)
  console.log("Seeding Complaint Types...");
  const complaintTypes = [
    { name: "Product not working", description: "Equipment refuses to turn on or run basic command protocols." },
    { name: "Leakage issue", description: "Fluid, oil, or gas leakage detected from seals, valves, or pipelines." },
    { name: "Pressure drop", description: "Operating pressure drops below the calibrated output threshold." },
    { name: "Motor overheating", description: "Engine or auxiliary motor reaches critical temperature shutdown limits." },
    { name: "Noise/vibration", description: "Abnormal screeching, grinding, or severe mechanical vibrations." },
    { name: "Installation issue", description: "Alignment, electrical wiring, or layout faults during new setup." },
    { name: "Performance issue", description: "Efficiency drop, high energy consumption, or slow cycles." },
    { name: "Delay in service", description: "Escalated complaint regarding delayed field service response." },
    { name: "Repeat failure", description: "Equipment fails again with the same issue within 30 days." },
    { name: "Warranty dispute", description: "Dispute over coverage terms, spare part costs, or service charge exclusions." }
  ];
  for (const comp of complaintTypes) {
    await prisma.complaintType.create({
      data: {
        id: uuidv4(),
        name: comp.name,
        description: comp.description,
        isActive: true
      }
    });
  }

  // 5. Seed Defect Types (9 types)
  console.log("Seeding Defect Types...");
  const defectTypes = [
    { name: "Manufacturing defect", description: "Structural defects or dimensional errors from the factory floor." },
    { name: "Assembly defect", description: "Wiring or bolt tightening issues during setup/assembly." },
    { name: "Component failure", description: "Sudden failure of standard supplier-provided components." },
    { name: "Electrical defect", description: "PCB burnt, short circuit, or control fuse blowing." },
    { name: "Mechanical defect", description: "Gear wear, piston jamming, or structural alignment bend." },
    { name: "Quality issue", description: "Surface finish defects, paint peeling, or minor cosmetic faults." },
    { name: "Design issue", description: "Inadequate cooling or stress tolerance in standard product designs." },
    { name: "Material defect", description: "Internal air bubbles in castings or weak alloy compound stress test failure." },
    { name: "Recurrent defect", description: "Identified defect occurring repeatedly in a specific model batch." }
  ];
  for (const def of defectTypes) {
    await prisma.defectType.create({
      data: {
        id: uuidv4(),
        name: def.name,
        description: def.description,
        isActive: true
      }
    });
  }

  // 6. Seed Priority Levels (4 levels)
  console.log("Seeding Priority Levels...");
  const priorityLevels = [
    { name: "Low", color: "#6B7280", slaLimitHours: 72 },
    { name: "Medium", color: "#2090FF", slaLimitHours: 48 },
    { name: "High", color: "#F59E0B", slaLimitHours: 24 },
    { name: "Critical", color: "#EF4444", slaLimitHours: 8 }
  ];
  for (const pri of priorityLevels) {
    await prisma.priorityLevel.create({
      data: {
        id: uuidv4(),
        name: pri.name,
        color: pri.color,
        slaLimitHours: pri.slaLimitHours,
        isActive: true
      }
    });
  }

  // 7. Seed Service Status (lifecycle statuses) — one set per module
  console.log("Seeding Service Statuses...");
  const serviceStatuses = [
    { name: "New", color: "var(--brand-primary, #FF6901)", order: 1, allowedTransitions: '["Assigned", "Closed"]' },
    { name: "Assigned", color: "#2090FF", order: 2, allowedTransitions: '["In Progress", "Pending Customer", "Closed"]' },
    { name: "In Progress", color: "#EAB308", order: 3, allowedTransitions: '["Pending Customer", "Resolved", "Closed"]' },
    { name: "Pending Customer", color: "#A855F7", order: 4, allowedTransitions: '["In Progress", "Resolved", "Closed"]' },
    { name: "Resolved", color: "#10B981", order: 5, allowedTransitions: '["Closed", "In Progress"]' },
    { name: "Closed", color: "#6B7280", order: 6, allowedTransitions: '["New"]' }
  ];
  const statusModules = ["request", "complaint", "defect", "installation", "visit", "warranty", "amc"];
  for (const module of statusModules) {
    for (const stat of serviceStatuses) {
      await prisma.serviceStatus.create({
        data: {
          id: uuidv4(),
          name: stat.name,
          module,
          color: stat.color,
          order: stat.order,
          allowedTransitions: stat.allowedTransitions,
          isActive: true
        }
      });
    }
  }

  // 8. Seed Service Teams (6 teams)
  console.log("Seeding Service Teams...");
  const teamsData = [
    { name: "Field Service Team North", description: "Handles mechanical breakdowns and inspections in North territory." },
    { name: "Field Service Team South", description: "Handles breakdowns and calibration in South territory." },
    { name: "Installation Team", description: "Dedicated line installation and commissioning engineers." },
    { name: "AMC Support Team", description: "Deals with scheduled preventive maintenance and health checks." },
    { name: "Warranty Resolution Team", description: "Processes claims and part swaps under active warranties." },
    { name: "Escalation Desk", description: "Critical response unit for major plant breakdowns and high-SLA complaints." }
  ];
  const createdTeams: any[] = [];
  for (const t of teamsData) {
    const team = await prisma.serviceTeam.create({
      data: {
        id: uuidv4(),
        name: t.name,
        description: t.description,
        managerId: users[0]?.id || null,
        isActive: true
      }
    });
    createdTeams.push(team);
  }

  // 9. Seed Service Engineers (6 engineers)
  console.log("Seeding Service Engineers...");
  const specializations = [
    "Compressor Diagnostics",
    "Hydraulic Calibration",
    "Electrical Logic Controls",
    "Heavy Valve Installation",
    "Air System Commissioning",
    "Pressure Telemetry Testing"
  ];
  for (let i = 0; i < 6; i++) {
    const userIndex = i % users.length;
    const teamIndex = i % createdTeams.length;
    const spec = specializations[i % specializations.length];
    await prisma.serviceEngineer.create({
      data: {
        id: uuidv4(),
        userId: users[userIndex].id,
        teamId: createdTeams[teamIndex].id,
        specialization: spec,
        isActive: true
      }
    });
  }

  // 10. Seed Customer Assets (10 customer assets)
  console.log("Seeding Customer Assets...");
  const products = [
    "Air Compressor AC-400",
    "Hydraulic Press Pump H-200",
    "Electronic Control Panel CP-80",
    "Industrial Water Chiller WC-10",
    "High Flow Filtration Unit FU-15",
    "Calibration Pressure Vessel PV-45"
  ];
  for (let i = 0; i < 10; i++) {
    const customer = customers[i % customers.length];
    const serial = `SN-${2026000 + i}`;
    const prod = products[i % products.length];

    const purchaseDate = new Date();
    purchaseDate.setMonth(purchaseDate.getMonth() - (i % 24));

    const warrantyExpiry = new Date(purchaseDate);
    warrantyExpiry.setFullYear(warrantyExpiry.getFullYear() + 1);

    const amcExpiry = new Date(purchaseDate);
    amcExpiry.setMonth(amcExpiry.getMonth() + 18);

    await prisma.customerAsset.create({
      data: {
        id: `asset-${i + 1}`,
        customerId: customer.id,
        serialNumber: serial,
        productName: prod,
        purchaseDate,
        warrantyExpiryDate: i % 2 === 0 ? warrantyExpiry : null,
        amcExpiryDate: i % 2 !== 0 ? amcExpiry : null,
        status: i % 5 === 0 ? "Expired" : "Active"
      }
    });
  }

  console.log("Service Workspace database seeding complete successfully! ✓");
}

if (require.main === module) {
  const { PrismaClient } = require("@prisma/client");
  const prismaInstance = new PrismaClient();
  seedServiceWorkspace(prismaInstance)
    .then(async () => {
      await prismaInstance.$disconnect();
      process.exit(0);
    })
    .catch(async (e) => {
      console.error(e);
      await prismaInstance.$disconnect();
      process.exit(1);
    });
}
