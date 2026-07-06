/**
 * SUKI CRM — seed-fresh.ts
 * V4 Complete Seed — 20 records per module, manufacturing B2B (automotive parts)
 *
 * Run: npx tsx prisma/seed-fresh.ts
 *
 * PHASE 1: Delete all data (keep Users, Roles, Permissions, Company)
 * PHASE 2: Insert 20 records per module
 * PHASE 3: Verify counts
 */

if (process.env.NODE_ENV === "production") {
  throw new Error("SEED SCRIPT CANNOT RUN IN PRODUCTION. Exiting.");
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── HELPERS ────────────────────────────────────────────────────────────────
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🧹 PHASE 1 — Deleting all data (keeping Users, Roles, Company)...\n");

  // ── Tier 7: deepest children ──────────────────────────────────────────────
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.notificationPreference.deleteMany({});
  await prisma.negotiationRevision.deleteMany({});
  await prisma.purchaseOrderItem.deleteMany({});
  await prisma.quotationItem.deleteMany({});
  await prisma.productSpecification.deleteMany({});
  await prisma.lostDealAnalysis.deleteMany({});
  await prisma.competitorProduct.deleteMany({});
  await prisma.competitorInvolvement.deleteMany({});
  await prisma.territoryAccount.deleteMany({});
  await prisma.dealStageHistory.deleteMany({});
  await prisma.leadOwnerHistory.deleteMany({});
  await prisma.leadStatusHistory.deleteMany({});
  await prisma.approvalHistory.deleteMany({});
  await prisma.approvalRequest.deleteMany({});
  await prisma.accountStatusHistory.deleteMany({});
  await prisma.accountCreditHistory.deleteMany({});
  await prisma.rFQStatusHistory.deleteMany({});
  await prisma.rFQCostingSheet.deleteMany({});
  await prisma.rFQLineItem.deleteMany({});
  await prisma.quotationStatusHistory.deleteMany({});
  await prisma.quotationRevisionSnapshot.deleteMany({});
  await prisma.quotationApproval.deleteMany({});
  await prisma.opportunityContact.deleteMany({});
  await prisma.opportunityDetail.deleteMany({});
  await prisma.taskComment.deleteMany({});
  await prisma.activityAttendee.deleteMany({});
  await prisma.visitAttendee.deleteMany({});
  await prisma.customerVisitAttendee.deleteMany({});
  await prisma.visitHost.deleteMany({});
  await prisma.visitVisitor.deleteMany({});
  await prisma.customerVisitStatusLog.deleteMany({});
  await prisma.proposalVersion.deleteMany({});
  await prisma.reportExportLog.deleteMany({});

  // ── Tier 4: activities that reference Deal ───────────────────────────────
  await prisma.communicationLog.deleteMany({});
  await prisma.callLog.deleteMany({});
  await prisma.customerVisit.deleteMany({});
  await prisma.marketingVisit.deleteMany({});
  await prisma.visitor.deleteMany({});
  await prisma.followUp.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.note.deleteMany({});

  // ── Tier 6 ────────────────────────────────────────────────────────────────
  await prisma.purchaseOrder.deleteMany({});
  await prisma.negotiation.deleteMany({});
  await prisma.quotation.deleteMany({});
  await prisma.sampleRequest.deleteMany({});
  await prisma.rFQ.deleteMany({});
  await prisma.cRMDocument.deleteMany({});
  await prisma.reportSchedule.deleteMany({});
  await prisma.proposal.deleteMany({});

  // ── Tier 5 ────────────────────────────────────────────────────────────────
  await prisma.deal.deleteMany({});

  // ── Tier 3 ────────────────────────────────────────────────────────────────
  await prisma.contact.deleteMany({});
  await prisma.keyAccount.deleteMany({});
  await prisma.salesTarget.deleteMany({});
  await prisma.forecastEntry.deleteMany({});
  await prisma.territory.deleteMany({});
  await prisma.competitor.deleteMany({});
  await prisma.plantLocation.deleteMany({});

  // ── Tier 2 ────────────────────────────────────────────────────────────────
  await prisma.productDatasheet.deleteMany({});
  await prisma.productBrochure.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.productCategory.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.supportTicket.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.lead.deleteMany({});

  // ── Tier 1: settings master data ──────────────────────────────────────────
  await prisma.lossReason.deleteMany({});
  await prisma.emailTemplate.deleteMany({});
  await prisma.whatsAppTemplate.deleteMany({});
  await prisma.pipelineStage.deleteMany({});
  await prisma.pipelineStageMaster.deleteMany({});
  await prisma.leadSource.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});

  // NOTE: NOT deleting: User, Company, SystemConfig, ExchangeRate

  console.log("✅ All data deleted.\n");

  // ── Resolve company & users ───────────────────────────────────────────────
  console.log("🔍 Resolving company and users...");
  const company = await prisma.company.findFirst({
    where: { name: { contains: "Suki" } },
  });
  if (!company) throw new Error("Company not found. Cannot seed.");
  console.log(`  Company: ${company.name} (id: ${company.id})`);
  const companyId = company.id;

  const users = await prisma.user.findMany({
    where: { companyId },
    select: { id: true, name: true, email: true, role: true },
  });

  const admin = users.find(
    (u) => u.role === "Admin" || u.role === "SuperAdmin"
  );
  const manager = users.find(
    (u) => u.role === "SalesManager" || u.role === "Sales Manager"
  );
  const execUsers = users.filter(
    (u) => u.role === "SalesExecutive" || u.role === "Sales Executive"
  );
  const exec1 = execUsers[0];
  const exec2 = execUsers[1] ?? exec1;

  if (!manager || !exec1) {
    throw new Error(
      `Required users not found. Found roles: ${users.map((u) => u.role).join(", ")}`
    );
  }
  const resolvedAdmin = admin ?? manager;
  console.log(
    `  Users: ${users.length} (manager=${manager.name}, exec1=${exec1.name}, exec2=${exec2.name})\n`
  );

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 2 — SEED DATA
  // ════════════════════════════════════════════════════════════════════════════
  console.log("🌱 PHASE 2 — Seeding data...\n");

  // ── 2A: SETTINGS MASTER DATA ─────────────────────────────────────────────
  console.log("  2A. Settings master data...");

  // Lead Sources (8)
  const leadSourceNames = [
    "Website",
    "Referral",
    "Trade Show",
    "Cold Call",
    "LinkedIn",
    "Email Campaign",
    "WhatsApp",
    "Exhibition",
  ];
  const leadSources: { id: string; name: string }[] = [];
  for (const name of leadSourceNames) {
    const ls = await prisma.leadSource.create({
      data: { name, isActive: true, companyId },
    });
    leadSources.push(ls);
  }
  console.log(`    ✅ ${leadSources.length} lead sources`);

  // Pipeline Stages (6 — matching the actual 6-stage stepper)
  const stageNames = [
    { name: "Qualified", order: 1, probability: 20 },
    { name: "RequirementGathering", order: 2, probability: 35 },
    { name: "MeetingScheduled", order: 3, probability: 50 },
    { name: "DemoConducted", order: 4, probability: 65 },
    { name: "Negotiation", order: 5, probability: 80 },
    { name: "Won", order: 6, probability: 100 },
  ];
  const pipelineStages: { id: string; name: string }[] = [];
  for (const s of stageNames) {
    const stage = await prisma.pipelineStage.create({
      data: { name: s.name, order: s.order, isActive: true, companyId },
    });
    pipelineStages.push(stage);
  }
  console.log(`    ✅ ${pipelineStages.length} pipeline stages`);

  // Loss Reasons (7)
  const lossReasonNames = [
    "Price Too High",
    "Competitor Won",
    "Customer Budget Cut",
    "Product Not Suitable",
    "No Response",
    "Timeline Mismatch",
    "Quality Concerns",
  ];
  const lossReasons: { id: string; name: string }[] = [];
  for (const name of lossReasonNames) {
    const lr = await prisma.lossReason.create({
      data: { name, isActive: true, companyId },
    });
    lossReasons.push(lr);
  }
  console.log(`    ✅ ${lossReasons.length} loss reasons`);

  // Email Templates (5)
  // NOTE: EmailTemplate has a required `module` field in the schema
  const emailTemplateData = [
    {
      name: "Follow-up after call",
      subject: "Following up on our conversation",
      body: "Dear {{customerName}},\n\nThank you for your time today. As discussed, I'm following up on our conversation regarding your requirements. Please let me know if you need any additional information.\n\nBest regards,\n{{senderName}}",
      module: "FollowUp",
    },
    {
      name: "Quotation sent",
      subject: "Your Quotation {{quotationCode}}",
      body: "Dear {{customerName}},\n\nPlease find attached your quotation {{quotationCode}}. This quotation is valid for 30 days. Please do not hesitate to contact us for any clarifications.\n\nBest regards,\n{{senderName}}",
      module: "Quotation",
    },
    {
      name: "Sample dispatched",
      subject: "Sample Dispatch Confirmation",
      body: "Dear {{customerName}},\n\nYour sample has been dispatched with tracking number {{trackingNumber}}. Expected delivery: 3-5 business days. Please confirm receipt and share your feedback.\n\nBest regards,\n{{senderName}}",
      module: "Sample",
    },
    {
      name: "PO acknowledgement",
      subject: "PO Received — {{poNumber}}",
      body: "Dear {{customerName}},\n\nWe acknowledge receipt of your Purchase Order {{poNumber}}. We will process this and confirm dispatch schedule within 24 hours.\n\nBest regards,\n{{senderName}}",
      module: "PurchaseOrder",
    },
    {
      name: "Meeting confirmation",
      subject: "Meeting Confirmation",
      body: "Dear {{customerName}},\n\nThis confirms our meeting scheduled for {{meetingDate}}. Please find the agenda attached. Looking forward to a productive discussion.\n\nBest regards,\n{{senderName}}",
      module: "Activity",
    },
  ];
  for (const t of emailTemplateData) {
    await prisma.emailTemplate.create({
      data: { ...t, isActive: true, companyId },
    });
  }
  console.log(`    ✅ ${emailTemplateData.length} email templates`);

  // ── 2B: PRODUCT CATALOGUE ─────────────────────────────────────────────────
  console.log("  2B. Product catalogue...");

  // Categories (5)
  const categoryData = [
    {
      name: "Brake Components",
      description: "Disc brakes, brake pads, calipers, rotors",
    },
    {
      name: "Engine Parts",
      description: "Pistons, gaskets, valves, timing components",
    },
    {
      name: "Chassis & Suspension",
      description: "Shock absorbers, springs, bushings, arms",
    },
    {
      name: "Transmission Parts",
      description: "Gears, clutch plates, differentials",
    },
    {
      name: "Electrical Components",
      description: "Sensors, wiring harnesses, control modules",
    },
  ];
  const categories: { id: string; name: string }[] = [];
  for (const c of categoryData) {
    const cat = await prisma.productCategory.create({
      data: { ...c, isActive: true, companyId },
    });
    categories.push(cat);
  }
  console.log(`    ✅ ${categories.length} categories`);

  // Products (20 — 4 per category)
  const productData = [
    // Brake Components
    {
      code: "PRD-0001",
      name: "Disc Brake Rotor 280mm",
      catIdx: 0,
      unit: "pcs",
      price: 1250,
    },
    {
      code: "PRD-0002",
      name: "Ceramic Brake Pad Set",
      catIdx: 0,
      unit: "set",
      price: 850,
    },
    {
      code: "PRD-0003",
      name: "Brake Caliper Assembly",
      catIdx: 0,
      unit: "pcs",
      price: 3200,
    },
    {
      code: "PRD-0004",
      name: "Brake Drum 260mm",
      catIdx: 0,
      unit: "pcs",
      price: 980,
    },
    // Engine Parts
    {
      code: "PRD-0005",
      name: "Piston Ring Set",
      catIdx: 1,
      unit: "set",
      price: 680,
    },
    {
      code: "PRD-0006",
      name: "Cylinder Head Gasket",
      catIdx: 1,
      unit: "pcs",
      price: 420,
    },
    {
      code: "PRD-0007",
      name: "Valve Spring Set",
      catIdx: 1,
      unit: "set",
      price: 560,
    },
    {
      code: "PRD-0008",
      name: "Timing Belt Kit",
      catIdx: 1,
      unit: "kit",
      price: 1100,
    },
    // Chassis & Suspension
    {
      code: "PRD-0009",
      name: "Shock Absorber Front",
      catIdx: 2,
      unit: "pcs",
      price: 2100,
    },
    {
      code: "PRD-0010",
      name: "Coil Spring Heavy Duty",
      catIdx: 2,
      unit: "pcs",
      price: 1450,
    },
    {
      code: "PRD-0011",
      name: "Control Arm Bushing Kit",
      catIdx: 2,
      unit: "kit",
      price: 780,
    },
    {
      code: "PRD-0012",
      name: "Stabilizer Link Rod",
      catIdx: 2,
      unit: "pcs",
      price: 650,
    },
    // Transmission
    {
      code: "PRD-0013",
      name: "Clutch Plate Assembly",
      catIdx: 3,
      unit: "set",
      price: 2800,
    },
    {
      code: "PRD-0014",
      name: "Gear Synchronizer Ring",
      catIdx: 3,
      unit: "pcs",
      price: 890,
    },
    {
      code: "PRD-0015",
      name: "Drive Shaft Boot Kit",
      catIdx: 3,
      unit: "kit",
      price: 440,
    },
    {
      code: "PRD-0016",
      name: "Differential Bearing Set",
      catIdx: 3,
      unit: "set",
      price: 1680,
    },
    // Electrical
    {
      code: "PRD-0017",
      name: "ABS Wheel Speed Sensor",
      catIdx: 4,
      unit: "pcs",
      price: 1320,
    },
    {
      code: "PRD-0018",
      name: "Oxygen Lambda Sensor",
      catIdx: 4,
      unit: "pcs",
      price: 1750,
    },
    {
      code: "PRD-0019",
      name: "Crankshaft Position Sensor",
      catIdx: 4,
      unit: "pcs",
      price: 980,
    },
    {
      code: "PRD-0020",
      name: "Engine Control Module",
      catIdx: 4,
      unit: "pcs",
      price: 8500,
    },
  ];
  const materialByCategory = [
    "Cast Iron",
    "Aluminum Alloy",
    "High-grade Steel",
    "Chromium Steel",
    "Copper Alloy",
  ];
  const products: { id: string; basePrice: number | null; name: string }[] = [];
  for (const p of productData) {
    const prod = await prisma.product.create({
      data: {
        productCode: p.code,
        name: p.name,
        categoryId: categories[p.catIdx].id,
        unit: p.unit,
        basePrice: p.price,
        isActive: true,
        companyId,
        specifications: {
          create: [
            {
              specKey: "Material",
              specValue: materialByCategory[p.catIdx],
              displayOrder: 1,
              companyId,
            },
            {
              specKey: "Weight",
              specValue: `${(0.5 + p.price * 0.001).toFixed(2)} kg`,
              displayOrder: 2,
              companyId,
            },
            {
              specKey: "Tolerance",
              specValue: "±0.05 mm",
              displayOrder: 3,
              companyId,
            },
          ],
        },
      },
    });
    products.push({ id: prod.id, basePrice: prod.basePrice, name: prod.name });
  }
  console.log(`    ✅ ${products.length} products`);

  // ── 2C: ACCOUNTS (customers) — 20 records ─────────────────────────────────
  console.log("  2C. Accounts (customers)...");

  const accountData = [
    {
      code: "ACC-0001",
      name: "Tata Motors Ltd.",
      city: "Pune",
      industry: "Automotive",
      status: "Active",
    },
    {
      code: "ACC-0002",
      name: "Mahindra & Mahindra",
      city: "Mumbai",
      industry: "Automotive",
      status: "Active",
    },
    {
      code: "ACC-0003",
      name: "Bajaj Auto Ltd.",
      city: "Pune",
      industry: "Automotive",
      status: "Active",
    },
    {
      code: "ACC-0004",
      name: "Ashok Leyland",
      city: "Chennai",
      industry: "Commercial",
      status: "Active",
    },
    {
      code: "ACC-0005",
      name: "TVS Motor Company",
      city: "Chennai",
      industry: "Automotive",
      status: "Active",
    },
    {
      code: "ACC-0006",
      name: "Royal Enfield",
      city: "Chennai",
      industry: "Automotive",
      status: "Prospect",
    },
    {
      code: "ACC-0007",
      name: "Bharat Forge Ltd.",
      city: "Pune",
      industry: "Manufacturing",
      status: "Active",
    },
    {
      code: "ACC-0008",
      name: "Bosch India Pvt. Ltd.",
      city: "Bangalore",
      industry: "Auto Parts",
      status: "Active",
    },
    {
      code: "ACC-0009",
      name: "Minda Industries",
      city: "Gurgaon",
      industry: "Auto Parts",
      status: "Prospect",
    },
    {
      code: "ACC-0010",
      name: "Motherson Sumi Systems",
      city: "Noida",
      industry: "Auto Parts",
      status: "Active",
    },
    {
      code: "ACC-0011",
      name: "Hyundai Motor India",
      city: "Chennai",
      industry: "Automotive",
      status: "Active",
    },
    {
      code: "ACC-0012",
      name: "Maruti Suzuki India",
      city: "Gurugram",
      industry: "Automotive",
      status: "Active",
    },
    {
      code: "ACC-0013",
      name: "Renault Nissan India",
      city: "Chennai",
      industry: "Automotive",
      status: "Prospect",
    },
    {
      code: "ACC-0014",
      name: "Force Motors Ltd.",
      city: "Pune",
      industry: "Commercial",
      status: "Active",
    },
    {
      code: "ACC-0015",
      name: "Eicher Motors",
      city: "Gurgaon",
      industry: "Commercial",
      status: "Prospect",
    },
    {
      code: "ACC-0016",
      name: "Sundaram Clayton",
      city: "Chennai",
      industry: "Manufacturing",
      status: "Active",
    },
    {
      code: "ACC-0017",
      name: "Schaeffler India",
      city: "Pune",
      industry: "Auto Parts",
      status: "Inactive",
    },
    {
      code: "ACC-0018",
      name: "SKF India Ltd.",
      city: "Pune",
      industry: "Auto Parts",
      status: "Active",
    },
    {
      code: "ACC-0019",
      name: "Valeo India Pvt. Ltd.",
      city: "Chennai",
      industry: "Auto Parts",
      status: "Prospect",
    },
    {
      code: "ACC-0020",
      name: "ZF Steering Systems India",
      city: "Chennai",
      industry: "Auto Parts",
      status: "Active",
    },
  ];
  const accounts: { id: string; name: string }[] = [];
  for (let i = 0; i < accountData.length; i++) {
    const a = accountData[i];
    const acct = await prisma.customer.create({
      data: {
        customerCode: a.code,
        name: a.name,
        email: `info-${a.code.toLowerCase()}@${a.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15)}.com`,
        city: a.city,
        industryType: a.industry,
        status: a.status,
        accountType: a.status === "Prospect" ? "Prospect" : "ActiveCustomer",
        assignedUserId: i % 2 === 0 ? exec1.id : exec2.id,
        companyId,
        createdAt: daysAgo(90 - i * 2),
      },
    });
    accounts.push({ id: acct.id, name: acct.name });
  }
  console.log(`    ✅ ${accounts.length} accounts`);

  // ── 2D: CONTACTS — 20 records (1 per account) ─────────────────────────────
  console.log("  2D. Contacts...");

  const contactTypes = ["Technical", "Purchase", "Finance", "Management"];
  const contacts: { id: string }[] = [];
  for (let i = 0; i < 20; i++) {
    const type = contactTypes[i % 4];
    const acct = accounts[i];
    const nameSlug = acct.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 10);
    const c = await prisma.contact.create({
      data: {
        contactCode: `CON-${String(i + 1).padStart(4, "0")}`,
        customerId: acct.id,
        name: `${type} Manager — ${acct.name.split(" ")[0]}`,
        email: `${type.toLowerCase()}.mgr${i}@${nameSlug}.com`,
        phone: `98${String(7000000000 + i).slice(1)}`,
        designation:
          type === "Management"
            ? "General Manager"
            : `${type} Lead`,
        contactType: type,
        isPrimary: true,
        // Contact.ownerId is required — the user who "owns" this contact
        ownerId: i % 2 === 0 ? exec1.id : exec2.id,
        companyId,
      },
    });
    contacts.push({ id: c.id });
  }
  console.log(`    ✅ ${contacts.length} contacts`);

  // ── 2E: LEADS — 20 records ────────────────────────────────────────────────
  console.log("  2E. Leads...");

  // Lead.leadCode is unique — use LEAD-XXXX format (matching existing seeds)
  // Lead model fields: leadCode, name, companyName (not company), city, status,
  //   leadSource (string, not FK), leadScore (not score), slaStatus,
  //   lastInteractionAt (default now()), nextFollowUpDate → no such field in Lead model
  const leadData = [
    {
      name: "Rajesh Kumar",
      company: "Premier Auto Parts",
      city: "Delhi",
      status: "New",
      source: "Website",
      score: 45,
      daysOld: 1,
    },
    {
      name: "Priya Sharma",
      company: "Global Auto Solutions",
      city: "Mumbai",
      status: "Contacted",
      source: "LinkedIn",
      score: 62,
      daysOld: 3,
    },
    {
      name: "Arun Mehta",
      company: "National Motors",
      city: "Ahmedabad",
      status: "SQL",
      source: "Trade Show",
      score: 78,
      daysOld: 5,
    },
    {
      name: "Sneha Reddy",
      company: "Southern Auto Corp",
      city: "Chennai",
      status: "Qualified",
      source: "Referral",
      score: 85,
      daysOld: 7,
    },
    {
      name: "Vikram Singh",
      company: "North India Auto",
      city: "Chandigarh",
      status: "New",
      source: "Cold Call",
      score: 30,
      daysOld: 0,
    },
    {
      name: "Meena Pillai",
      company: "Kerala Autotech",
      city: "Kochi",
      status: "Contacted",
      source: "Website",
      score: 55,
      daysOld: 2,
    },
    {
      name: "Suresh Nair",
      company: "West Coast Motors",
      city: "Pune",
      status: "SQL",
      source: "Email Campaign",
      score: 70,
      daysOld: 6,
    },
    {
      name: "Kavita Joshi",
      company: "Central Auto Industries",
      city: "Nagpur",
      status: "Qualified",
      source: "Exhibition",
      score: 88,
      daysOld: 10,
    },
    {
      name: "Amit Patel",
      company: "Gujarat Auto Parts",
      city: "Surat",
      status: "Lost",
      source: "Website",
      score: 40,
      daysOld: 20,
    },
    {
      name: "Ravi Chandran",
      company: "Tamil Auto Works",
      city: "Coimbatore",
      status: "Converted",
      source: "Referral",
      score: 92,
      daysOld: 15,
    },
    {
      name: "Deepa Iyer",
      company: "South Motors Ltd.",
      city: "Bangalore",
      status: "New",
      source: "WhatsApp",
      score: 48,
      daysOld: 1,
    },
    {
      name: "Kiran Desai",
      company: "Western Auto Group",
      city: "Mumbai",
      status: "SQL",
      source: "LinkedIn",
      score: 73,
      daysOld: 8,
    },
    {
      name: "Anand Rao",
      company: "Deccan Motors",
      city: "Hyderabad",
      status: "Contacted",
      source: "Trade Show",
      score: 60,
      daysOld: 4,
    },
    {
      name: "Pooja Menon",
      company: "Malabar Autotech",
      city: "Kozhikode",
      status: "Qualified",
      source: "Website",
      score: 82,
      daysOld: 12,
    },
    {
      name: "Sanjay Verma",
      company: "Delhi Auto Industries",
      city: "Delhi",
      status: "New",
      source: "Cold Call",
      score: 25,
      daysOld: 0,
    },
    {
      name: "Nisha Kapoor",
      company: "Punjab Motors Corp",
      city: "Ludhiana",
      status: "Lost",
      source: "Cold Call",
      score: 35,
      daysOld: 25,
    },
    {
      name: "Mohan Krishnan",
      company: "Andhra Auto Parts",
      city: "Vijayawada",
      status: "SQL",
      source: "Referral",
      score: 77,
      daysOld: 9,
    },
    {
      name: "Sunita Yadav",
      company: "UP Auto Solutions",
      city: "Lucknow",
      status: "Contacted",
      source: "Exhibition",
      score: 58,
      daysOld: 3,
    },
    {
      name: "Aditya Bose",
      company: "Bengal Auto Tech",
      city: "Kolkata",
      status: "New",
      source: "Website",
      score: 42,
      daysOld: 1,
    },
    {
      name: "Lakshmi Priya",
      company: "Mysore Auto Works",
      city: "Mysore",
      status: "Duplicate",
      source: "Website",
      score: 42,
      daysOld: 1,
    },
  ];

  const leads: { id: string }[] = [];
  for (let i = 0; i < leadData.length; i++) {
    const ld = leadData[i];
    const execAssigned = i % 2 === 0 ? exec1.id : exec2.id;
    const lead = await prisma.lead.create({
      data: {
        leadCode: `LEAD-${String(i + 1).padStart(4, "0")}`,
        name: ld.name,
        email: `lead-${String(i + 1).padStart(4, "0")}@${ld.company.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15)}.com`,
        companyName: ld.company,
        city: ld.city,
        status: ld.status,
        leadSource: ld.source,
        leadScore: ld.score,
        assignedUserId: execAssigned,
        companyId,
        // slaStatus: "New" status with daysOld > 1 = Breached; else Met; else Pending
        slaStatus:
          ld.daysOld > 1 && ld.status === "New"
            ? "Breached"
            : ld.status !== "New"
            ? "Met"
            : "Pending",
        createdAt: daysAgo(ld.daysOld),
        lastInteractionAt: daysAgo(Math.max(ld.daysOld - 1, 0)),
      },
    });
    leads.push({ id: lead.id });
  }
  console.log(`    ✅ ${leads.length} leads`);

  // ── 2F: DEALS (opportunities) — 20 records across 6 stages ───────────────
  console.log("  2F. Deals (pipeline opportunities)...");

  // Deal statuses map to the pipeline stages used in the app
  // From seed-complete.ts: "Qualified","RequirementGathering","MeetingScheduled","DemoConducted"
  // Plus "Negotiation", "Won", "Lost"
  const opportunityData = [
    {
      name: "Brake Rotor Supply — Tata Motors",
      acctIdx: 0,
      value: 850000,
      stage: "Qualified",
      prob: 20,
      daysOld: 30,
      execIdx: 0,
    },
    {
      name: "Engine Gasket Contract — Mahindra",
      acctIdx: 1,
      value: 1200000,
      stage: "RequirementGathering",
      prob: 35,
      daysOld: 25,
      execIdx: 1,
    },
    {
      name: "Suspension Kit — Bajaj Auto",
      acctIdx: 2,
      value: 650000,
      stage: "MeetingScheduled",
      prob: 50,
      daysOld: 20,
      execIdx: 0,
    },
    {
      name: "Clutch Assembly — Ashok Leyland",
      acctIdx: 3,
      value: 2100000,
      stage: "DemoConducted",
      prob: 65,
      daysOld: 15,
      execIdx: 1,
    },
    {
      name: "Sensor Supply — TVS Motor",
      acctIdx: 4,
      value: 980000,
      stage: "Negotiation",
      prob: 80,
      daysOld: 10,
      execIdx: 0,
    },
    {
      name: "Brake Pad Annual — Royal Enfield",
      acctIdx: 5,
      value: 540000,
      stage: "Won",
      prob: 100,
      daysOld: 5,
      execIdx: 1,
    },
    {
      name: "Forged Parts — Bharat Forge",
      acctIdx: 6,
      value: 3200000,
      stage: "Qualified",
      prob: 20,
      daysOld: 28,
      execIdx: 0,
    },
    {
      name: "Auto Parts Bundle — Bosch",
      acctIdx: 7,
      value: 1750000,
      stage: "RequirementGathering",
      prob: 35,
      daysOld: 22,
      execIdx: 1,
    },
    {
      name: "Timing Belt Supply — Minda",
      acctIdx: 8,
      value: 420000,
      stage: "MeetingScheduled",
      prob: 50,
      daysOld: 18,
      execIdx: 0,
    },
    {
      name: "Wiring Harness — Motherson",
      acctIdx: 9,
      value: 1890000,
      stage: "DemoConducted",
      prob: 65,
      daysOld: 12,
      execIdx: 1,
    },
    {
      name: "Shock Absorbers — Hyundai",
      acctIdx: 10,
      value: 2450000,
      stage: "Negotiation",
      prob: 80,
      daysOld: 8,
      execIdx: 0,
    },
    {
      name: "Engine Parts — Maruti",
      acctIdx: 11,
      value: 3100000,
      stage: "Won",
      prob: 100,
      daysOld: 3,
      execIdx: 1,
    },
    {
      name: "Brake Drum Supply — Renault Nissan",
      acctIdx: 12,
      value: 780000,
      stage: "Qualified",
      prob: 20,
      daysOld: 35,
      execIdx: 0,
    },
    {
      name: "Drive Shaft — Force Motors",
      acctIdx: 13,
      value: 1100000,
      stage: "RequirementGathering",
      prob: 35,
      daysOld: 29,
      execIdx: 1,
    },
    {
      name: "Differential Parts — Eicher",
      acctIdx: 14,
      value: 890000,
      stage: "MeetingScheduled",
      prob: 50,
      daysOld: 24,
      execIdx: 0,
    },
    {
      name: "Bearing Kit — Sundaram",
      acctIdx: 15,
      value: 1560000,
      stage: "DemoConducted",
      prob: 65,
      daysOld: 17,
      execIdx: 1,
    },
    {
      name: "Sensor Array — Schaeffler",
      acctIdx: 16,
      value: 2200000,
      stage: "Negotiation",
      prob: 80,
      daysOld: 11,
      execIdx: 0,
    },
    {
      name: "Ball Bearing Supply — SKF",
      acctIdx: 17,
      value: 4500000,
      stage: "Won",
      prob: 100,
      daysOld: 2,
      execIdx: 1,
    },
    {
      name: "Clutch Parts — Valeo India",
      acctIdx: 18,
      value: 670000,
      stage: "Qualified",
      prob: 20,
      daysOld: 33,
      execIdx: 0,
    },
    {
      name: "Steering Parts — ZF India",
      acctIdx: 19,
      value: 1340000,
      stage: "RequirementGathering",
      prob: 35,
      daysOld: 27,
      execIdx: 1,
    },
  ];

  const deals: { id: string; dealValue: number; status: string }[] = [];
  for (let i = 0; i < opportunityData.length; i++) {
    const od = opportunityData[i];
    const assignedUserId = od.execIdx === 0 ? exec1.id : exec2.id;
    const opportunityCode = `OPP-2026-${String(i + 1).padStart(5, "0")}`;

    const deal = await prisma.deal.create({
      data: {
        dealName: od.name,
        opportunityCode,
        customerId: accounts[od.acctIdx].id,
        dealValue: od.value,
        status: od.stage,
        probabilityPercent: od.prob,
        expectedCloseDate: daysFromNow(30 + i),
        assignedUserId,
        companyId,
        createdAt: daysAgo(od.daysOld),
      },
    });

    // Stage history entry
    await prisma.dealStageHistory.create({
      data: {
        dealId: deal.id,
        fromStatus: null,
        toStatus: od.stage,
        changedById: assignedUserId,
        changedAt: daysAgo(od.daysOld),
      },
    });

    deals.push({ id: deal.id, dealValue: deal.dealValue, status: deal.status });
  }
  console.log(`    ✅ ${deals.length} deals`);

  // ── 2G: RFQs — 20 records ─────────────────────────────────────────────────
  console.log("  2G. RFQs...");

  const rfqStatuses = [
    "New",
    "UnderReview",
    "CostingPending",
    "QuotationCreated",
    "Closed",
  ];
  const rfqs: { id: string }[] = [];
  for (let i = 0; i < 20; i++) {
    const prod = products[i % products.length];
    const rfq = await prisma.rFQ.create({
      data: {
        rfqCode: `RFQ-2026-${String(i + 1).padStart(5, "0")}`,
        customerId: accounts[i % accounts.length].id,
        contactId: contacts[i % contacts.length].id,
        productId: prod.id,
        status: rfqStatuses[i % rfqStatuses.length],
        quantity: 50 + i * 10,
        targetPrice: (prod.basePrice ?? 1000) * 0.9,
        deliveryDate: daysFromNow(45 + i),
        requirementDetails: `Bulk requirement for ${prod.name} — production Q${Math.ceil((i + 1) / 3)} 2026.`,
        assignedUserId: i % 2 === 0 ? exec1.id : exec2.id,
        companyId,
        receivedDate: daysAgo(15 - (i % 10)),
        opportunityId: i < 20 ? deals[i % deals.length].id : undefined,
      },
    });
    rfqs.push({ id: rfq.id });
  }
  console.log(`    ✅ ${rfqs.length} RFQs`);

  // ── 2H: QUOTATIONS — 20 records with line items ───────────────────────────
  console.log("  2H. Quotations...");

  const quotationStatuses = [
    "Draft",
    "Sent",
    "UnderReview",
    "Accepted",
    "Rejected",
    "Expired",
  ];
  const quotations: { id: string; finalAmount: number }[] = [];
  for (let i = 0; i < 20; i++) {
    const acct = accounts[i];
    const contact = contacts[i];
    const p1 = products[i % products.length];
    const p2 = products[(i + 3) % products.length];
    const qty1 = 50 + i * 5;
    const qty2 = 30 + i * 3;
    const total1 = (p1.basePrice ?? 1000) * qty1;
    const total2 = (p2.basePrice ?? 800) * qty2;
    const grandTotal = total1 + total2;
    const discountPct = i % 5 === 0 ? 8 : i % 3 === 0 ? 5 : 0;
    const finalAmount = grandTotal * (1 - discountPct / 100);
    const status = quotationStatuses[i % quotationStatuses.length];
    const monthOffset = i % 6;

    const quot = await prisma.quotation.create({
      data: {
        quotationCode: `QT-2026-${String(i + 1).padStart(5, "0")}`,
        customerId: acct.id,
        contactId: contact.id,
        rfqId: rfqs[i].id,
        dealId: deals[i].id,
        status,
        validUntil: daysFromNow(status === "Expired" ? -5 : 30),
        totalAmount: grandTotal,
        subtotal: grandTotal,
        discountPercent: discountPct,
        finalAmount,
        termsAndConditions:
          "Payment: Net 30 days from delivery. Prices exclusive of GST @18%.",
        createdById: exec1.id,
        companyId,
        sentAt: status !== "Draft" ? monthsAgo(monthOffset) : null,
        acceptedAt: status === "Accepted" ? monthsAgo(monthOffset) : null,
        rejectedAt: status === "Rejected" ? monthsAgo(monthOffset) : null,
        rejectionReason:
          status === "Rejected"
            ? "Customer budget revised downward for Q3."
            : null,
        createdAt: monthsAgo(monthOffset),
        items: {
          create: [
            {
              productId: p1.id,
              description: p1.name,
              quantity: qty1,
              unitPrice: p1.basePrice ?? 1000,
              totalPrice: total1,
              lineTotal: total1,
            },
            {
              productId: p2.id,
              description: p2.name,
              quantity: qty2,
              unitPrice: p2.basePrice ?? 800,
              totalPrice: total2,
              lineTotal: total2,
            },
          ],
        },
      },
    });
    quotations.push({ id: quot.id, finalAmount: quot.finalAmount });
  }
  console.log(`    ✅ ${quotations.length} quotations`);

  // ── 2I: SAMPLE REQUESTS — 20 records ─────────────────────────────────────
  console.log("  2I. Sample requests...");

  const sampleStatuses = [
    "New",
    "UnderReview",
    "SentToCustomer",
    "Approved",
    "Rejected",
    "Revision",
    "New",
    "UnderReview",
    "SentToCustomer",
    "Approved",
    "Rejected",
    "Approved",
    "SentToCustomer",
    "New",
    "UnderReview",
    "Approved",
    "Rejected",
    "Revision",
    "Approved",
    "SentToCustomer",
  ];
  for (let i = 0; i < 20; i++) {
    const status = sampleStatuses[i];
    const isSent = ["SentToCustomer", "Approved", "Rejected", "Revision"].includes(
      status
    );
    await prisma.sampleRequest.create({
      data: {
        sampleCode: `SMP-2026-${String(i + 1).padStart(5, "0")}`,
        customerId: accounts[i % accounts.length].id,
        contactId: contacts[i % contacts.length].id,
        productId: products[i % products.length].id,
        rfqId: rfqs[i % rfqs.length].id,
        status,
        quantity: 3 + (i % 5),
        specifications: `Sample for ${products[i % products.length].name}: verify dimensional accuracy, material grade, surface finish.`,
        requestDate: daysAgo(20 - (i % 10)),
        sentDate: isSent ? daysAgo(10 - (i % 8)) : null,
        trackingNumber: isSent
          ? `TRK${String(100000 + i).padStart(6, "0")}`
          : null,
        approvedDate: status === "Approved" ? daysAgo(3) : null,
        rejectedDate: status === "Rejected" ? daysAgo(3) : null,
        revisionDate: status === "Revision" ? daysAgo(2) : null,
        customerFeedback:
          status === "Approved"
            ? "Sample meets specification requirements. Approved for bulk order."
            : status === "Rejected"
            ? "Surface finish below required Ra 0.8 µm. Rework needed."
            : null,
        revisionNotes:
          status === "Revision"
            ? "Adjust tolerance from ±0.05 to ±0.03 and resubmit."
            : null,
        assignedUserId: i % 2 === 0 ? exec1.id : exec2.id,
        companyId,
      },
    });
  }
  console.log(`    ✅ 20 sample requests`);

  // ── 2J: NEGOTIATIONS — 20 records ─────────────────────────────────────────
  console.log("  2J. Negotiations...");

  const negotiationStatuses = [
    "Active",
    "PriceRevision",
    "PendingApproval",
    "CommercialDiscussion",
    "Won",
    "Lost",
    "Active",
    "PriceRevision",
    "Won",
    "CommercialDiscussion",
    "Active",
    "PendingApproval",
    "Won",
    "Lost",
    "Active",
    "PriceRevision",
    "CommercialDiscussion",
    "Won",
    "Active",
    "Lost",
  ];
  const negotiations: { id: string }[] = [];
  for (let i = 0; i < 20; i++) {
    const status = negotiationStatuses[i];
    const quot = quotations[i % quotations.length];
    const initialAmount = quot.finalAmount;
    const revisedAmount = initialAmount * 0.94;
    const isClosed = status === "Won" || status === "Lost";

    const neg = await prisma.negotiation.create({
      data: {
        negotiationCode: `NEG-2026-${String(i + 1).padStart(5, "0")}`,
        quotationId: quotations[i % quotations.length].id,
        dealId: deals[i % deals.length].id,
        customerId: accounts[i % accounts.length].id,
        contactId: contacts[i % contacts.length].id,
        status,
        initialAmount,
        revisedAmount: status !== "Active" ? revisedAmount : null,
        finalAmount: isClosed ? revisedAmount : null,
        discountRequested: 8 + (i % 5),
        discountApproved: isClosed ? 6 : null,
        customerDemands: `Customer requesting ${8 + (i % 5)}% discount based on annual volume commitment of ${100 + i * 10} units.`,
        internalNotes:
          "Customer is a tier-1 OEM supplier — strategic relationship, consider approving within policy.",
        outcome:
          status === "Won"
            ? `Deal closed at ₹${revisedAmount.toLocaleString("en-IN")} after 6% discount approval.`
            : status === "Lost"
            ? "Customer awarded to competitor on lower pricing."
            : null,
        closedAt: isClosed ? daysAgo((i % 5) + 1) : null,
        assignedUserId: i % 2 === 0 ? exec1.id : exec2.id,
        approvedById: isClosed ? manager.id : null,
        companyId,
        createdAt: daysAgo(20 - (i % 12)),
        revisions: {
          create: [
            {
              revisionNumber: 1,
              proposedAmount: revisedAmount,
              discountPercent: 8 + (i % 5),
              reason:
                "Customer requesting volume discount for committed annual purchase order.",
              status:
                status === "PendingApproval"
                  ? "Pending"
                  : isClosed
                  ? "Approved"
                  : "Approved",
              createdById: i % 2 === 0 ? exec1.id : exec2.id,
            },
          ],
        },
      },
    });
    negotiations.push({ id: neg.id });
  }
  console.log(`    ✅ ${negotiations.length} negotiations`);

  // ── 2K: PURCHASE ORDERS — 20 records ─────────────────────────────────────
  console.log("  2K. Purchase orders...");

  const poStatuses = [
    "New",
    "UnderValidation",
    "Approved",
    "Approved",
    "Closed",
    "Rejected",
    "New",
    "UnderValidation",
    "Approved",
    "Closed",
    "Approved",
    "New",
    "Approved",
    "Closed",
    "UnderValidation",
    "Approved",
    "Rejected",
    "Approved",
    "Closed",
    "Approved",
  ];
  for (let i = 0; i < 20; i++) {
    const status = poStatuses[i];
    const isApproved = ["Approved", "Closed"].includes(status);
    // POs index 4 and 11 have failed ERP sync for testing
    const erpFailed = i === 4 || i === 11;
    const erpSynced = isApproved && !erpFailed;
    const p1 = products[i % products.length];
    const p2 = products[(i + 2) % products.length];
    const qty1 = 100 + i * 20;
    const qty2 = 80 + i * 15;
    const total1 = (p1.basePrice ?? 1000) * qty1;
    const total2 = (p2.basePrice ?? 800) * qty2;
    const grandTotal = total1 + total2;

    await prisma.purchaseOrder.create({
      data: {
        poCode: `PO-2026-${String(i + 1).padStart(5, "0")}`,
        customerId: accounts[i % accounts.length].id,
        contactId: contacts[i % contacts.length].id,
        quotationId: quotations[i % quotations.length].id,
        negotiationId: negotiations[i % negotiations.length].id,
        dealId: deals[i % deals.length].id,
        status,
        poNumber: `CUST-PO-${String(20260000 + i).padStart(8, "0")}`,
        poDate: daysAgo(10 - (i % 8)),
        poDocumentUrl: `https://example.com/po-documents/PO-2026-${String(i + 1).padStart(5, "0")}.pdf`,
        totalAmount: grandTotal,
        finalAmount: grandTotal,
        expectedDelivery: daysFromNow(45),
        shippingAddress: `${accounts[i % accounts.length].name}, Plant Gate 2, Industrial Estate`,
        paymentTerms:
          i % 3 === 0
            ? "Net 30"
            : i % 3 === 1
            ? "Net 45"
            : "50% Advance + 50% on Delivery",
        specialInstructions:
          i % 2 === 0
            ? "Deliver in 2 batches. Confirm dispatch 48hrs in advance."
            : null,
        approvedById: isApproved ? resolvedAdmin.id : null,
        approvedAt: isApproved ? daysAgo((i % 5) + 1) : null,
        rejectionReason:
          status === "Rejected"
            ? "PO amount does not match agreed quotation terms."
            : null,
        erpSyncStatus: erpFailed
          ? "Failed"
          : erpSynced
          ? "Synced"
          : "Pending",
        erpReferenceNumber: erpSynced
          ? `ERP-${String(500000 + i).padStart(6, "0")}`
          : null,
        erpSyncedAt: erpSynced ? daysAgo(i % 4) : null,
        erpResponse: erpFailed
          ? JSON.stringify({
              error: "Connection timeout. ERP endpoint unreachable.",
            })
          : erpSynced
          ? JSON.stringify({
              referenceNumber: `ERP-${String(500000 + i).padStart(6, "0")}`,
              status: "success",
            })
          : null,
        companyId,
        items: {
          create: [
            {
              productId: p1.id,
              description: p1.name,
              quantity: qty1,
              unitPrice: p1.basePrice ?? 1000,
              totalPrice: total1,
            },
            {
              productId: p2.id,
              description: p2.name,
              quantity: qty2,
              unitPrice: p2.basePrice ?? 800,
              totalPrice: total2,
            },
          ],
        },
      },
    });
  }
  console.log(`    ✅ 20 purchase orders`);

  // ── 2L: TASKS — 20 records ────────────────────────────────────────────────
  console.log("  2L. Tasks...");

  // Task model: uses `assignedTo` (NOT assignedUserId), status defaults "Open"
  // Valid statuses from app: Pending, Completed, Overdue, Cancelled (used in prompt)
  // Schema has no completedById field — just completedAt
  const taskStatuses = [
    "Pending",
    "Pending",
    "Completed",
    "Overdue",
    "Cancelled",
    "Pending",
    "Completed",
    "Overdue",
    "Pending",
    "Completed",
    "Overdue",
    "Pending",
    "Cancelled",
    "Completed",
    "Pending",
    "Overdue",
    "Pending",
    "Completed",
    "Overdue",
    "Pending",
  ];
  const taskTitles = [
    "Send product catalogue to Tata Motors",
    "Follow up on RFQ pricing query — Mahindra",
    "Prepare quotation draft for Bajaj Auto",
    "Call Ashok Leyland procurement team",
    "Update CRM with site visit notes — TVS",
    "Schedule product demo for Royal Enfield",
    "Send sample dispatch confirmation email",
    "Review and submit negotiation revision",
    "Collect credit note from Bosch India",
    "Internal pricing review meeting — Q3",
    "Follow up on overdue PO — Motherson",
    "Update lead status — 5 new leads",
    "Prepare weekly sales report",
    "Coordinate delivery schedule — Maruti",
    "Competitor analysis — Hyundai account",
    "Key account review — Bharat Forge",
    "Territory performance report",
    "Set Q3 monthly targets",
    "Submit BANT checklist — 3 leads",
    "Approval request — NEG-2026-00003",
  ];
  for (let i = 0; i < 20; i++) {
    const status = taskStatuses[i];
    await prisma.task.create({
      data: {
        taskCode: `TSK-2026-${String(i + 1).padStart(5, "0")}`,
        title: taskTitles[i],
        status,
        priority: i % 4 === 0 ? "High" : i % 3 === 0 ? "Low" : "Medium",
        dueDate:
          status === "Overdue"
            ? daysAgo((i % 3) + 1)
            : daysFromNow(i + 1),
        // assignedTo is the required FK to User (not assignedUserId)
        assignedTo: i % 2 === 0 ? exec1.id : exec2.id,
        dealId: deals[i % deals.length].id,
        companyId,
        completedAt:
          status === "Completed" ? daysAgo(1) : null,
      },
    });
  }
  console.log(`    ✅ 20 tasks`);

  // ── 2M: FOLLOW-UPS — 20 records ───────────────────────────────────────────
  console.log("  2M. Follow-ups...");

  const followUpStatuses = [
    "Pending",
    "Overdue",
    "Completed",
    "Cancelled",
    "Pending",
    "Overdue",
    "Completed",
    "Pending",
    "Overdue",
    "Completed",
    "Pending",
    "Cancelled",
    "Overdue",
    "Completed",
    "Pending",
    "Overdue",
    "Completed",
    "Pending",
    "Overdue",
    "Pending",
  ];
  for (let i = 0; i < 20; i++) {
    const status = followUpStatuses[i];
    await prisma.followUp.create({
      data: {
        customerId: accounts[i % accounts.length].id,
        assignedUserId: i % 2 === 0 ? exec1.id : exec2.id,
        nextMeetingDate:
          status === "Overdue"
            ? daysAgo((i % 4) + 1)
            : daysFromNow(i + 1),
        status,
        priority: i % 3 === 0 ? "High" : "Medium",
        remarks: `Follow-up regarding ${accounts[i % accounts.length].name} — ${
          status === "Overdue"
            ? "OVERDUE: action required immediately"
            : "discuss requirements and next steps"
        }.`,
        companyId,
        completedAt: status === "Completed" ? daysAgo(2) : null,
        completedById: status === "Completed" ? exec1.id : null,
      },
    });
  }
  console.log(`    ✅ 20 follow-ups`);

  // ── 2N: ACTIVITIES (CommunicationLog) — 20 records ────────────────────────
  console.log("  2N. Activities (communication logs)...");

  const channels = [
    "Call",
    "Meeting",
    "Email",
    "WhatsApp",
    "Call",
    "Meeting",
    "Email",
    "Call",
    "WhatsApp",
    "Meeting",
    "Call",
    "Email",
    "Meeting",
    "Call",
    "WhatsApp",
    "Email",
    "Call",
    "Meeting",
    "WhatsApp",
    "Call",
  ];
  for (let i = 0; i < 20; i++) {
    const channel = channels[i];
    await prisma.communicationLog.create({
      data: {
        customerId: accounts[i % accounts.length].id,
        channel,
        direction: i % 2 === 0 ? "Outbound" : "Inbound",
        status: "Completed",
        content:
          channel === "Call"
            ? "Discussed pricing and delivery timeline. Customer confirmed interest in Q3 bulk order."
            : channel === "Meeting"
            ? "Conducted product demo. Customer satisfied with quality. Requested formal quotation."
            : channel === "Email"
            ? `Subject: Quotation Follow-up\n\nDear Team,\n\nFollowing up on our quotation QT-2026-${String(i + 1).padStart(5, "0")}. Please confirm acceptance at your earliest convenience.`
            : 'Customer message: "Please send updated pricing for Q3. We are ready to place the order."',
        sentByUserId: i % 2 === 0 ? exec1.id : exec2.id,
        sentAt: daysAgo((i % 15) + 1),
        dealId: deals[i % deals.length].id,
      },
    });
  }
  console.log(`    ✅ 20 activities`);

  // ── 2O: COMPETITORS + LOST DEAL ANALYSIS ─────────────────────────────────
  console.log("  2O. Competitors + Lost deal analysis...");

  const competitorData = [
    {
      name: "Bosch Auto Components",
      website: "bosch.com",
      strength: "Brand recognition, R&D",
      weakness: "Premium pricing, long lead times",
    },
    {
      name: "Mahle India",
      website: "mahle.com",
      strength: "OEM relationships, engineering",
      weakness: "Rigid MOQs, limited customization",
    },
    {
      name: "Federal-Mogul India",
      website: "federalmogul.com",
      strength: "Wide product range",
      weakness: "Inconsistent delivery",
    },
    {
      name: "SKF Auto Components",
      website: "skf.com",
      strength: "Quality certifications",
      weakness: "Very high minimum orders",
    },
    {
      name: "Valeo Auto Parts",
      website: "valeo.com",
      strength: "European quality standards",
      weakness: "Higher cost than Indian suppliers",
    },
    {
      name: "ZF Auto Systems",
      website: "zf.com",
      strength: "Technology leadership",
      weakness: "Price premium, slow response",
    },
    {
      name: "Denso India",
      website: "denso.com",
      strength: "Japanese quality, reliability",
      weakness: "Limited customization",
    },
    {
      name: "Continental Auto",
      website: "continental.com",
      strength: "Safety innovation",
      weakness: "Complex ordering process",
    },
    {
      name: "Minda Auto Industries",
      website: "minda.com",
      strength: "Local presence, fast delivery",
      weakness: "Quality inconsistency",
    },
    {
      name: "Lumax Industries",
      website: "lumax.com",
      strength: "Competitive pricing",
      weakness: "Limited product range",
    },
    {
      name: "Sandhar Technologies",
      website: "sandhar.in",
      strength: "Cost advantage",
      weakness: "Limited engineering support",
    },
    {
      name: "Endurance Technologies",
      website: "endurancegroup.com",
      strength: "Die casting expertise",
      weakness: "Automotive only",
    },
    {
      name: "Suprajit Engineering",
      website: "suprajit.com",
      strength: "Cable systems leader",
      weakness: "Narrow product focus",
    },
    {
      name: "Subros Ltd.",
      website: "subros.com",
      strength: "Thermal management",
      weakness: "Very niche focus",
    },
    {
      name: "JBM Group",
      website: "jbmgroup.com",
      strength: "Large capacity",
      weakness: "Quality variable",
    },
    {
      name: "Uno Minda",
      website: "unominda.com",
      strength: "Switch & lighting expert",
      weakness: "Expanding outside core slowly",
    },
    {
      name: "Rane Group",
      website: "ranegroup.com",
      strength: "Steering components leader",
      weakness: "Premium priced",
    },
    {
      name: "Wheels India",
      website: "wheelsindia.com",
      strength: "Wheel rim specialist",
      weakness: "Limited category",
    },
    {
      name: "Banco Products",
      website: "bancoproducts.com",
      strength: "Cooling systems",
      weakness: "Slow to innovate",
    },
    {
      name: "Pricol Ltd.",
      website: "pricol.com",
      strength: "Instruments and sensors",
      weakness: "Small scale vs global rivals",
    },
  ];
  const competitors: { id: string }[] = [];
  for (let i = 0; i < competitorData.length; i++) {
    const cd = competitorData[i];
    const comp = await prisma.competitor.create({
      data: {
        name: cd.name,
        website: cd.website,
        strengths: cd.strength,
        weaknesses: cd.weakness,
        isActive: true,
        companyId,
        products: {
          create: [
            {
              name: `${cd.name} — Primary Product`,
              priceRange: `₹${(1000 + i * 200).toLocaleString("en-IN")}–₹${(2000 + i * 200).toLocaleString("en-IN")}`,
              ourAdvantage: `We offer ${5 + (i % 10)}% lower pricing with equal or better quality certifications.`,
            },
          ],
        },
      },
    });
    competitors.push({ id: comp.id });
  }
  console.log(`    ✅ ${competitors.length} competitors`);

  // Lost Deal Analysis — 10 records
  for (let i = 0; i < 10; i++) {
    const dealEntry = deals[i % deals.length];
    await prisma.lostDealAnalysis.create({
      data: {
        dealId: dealEntry.id,
        competitorId: competitors[i].id,
        lossReasonId: lossReasons[i % lossReasons.length].id,
        lostReason: lossReasons[i % lossReasons.length].name,
        competitorWonPrice: dealEntry.dealValue * 0.88,
        ourFinalPrice: dealEntry.dealValue,
        lessonsLearned: `Need earlier involvement in budget discussions. ${competitorData[i].name} aggressively discounted below our floor price.`,
        recordedById: manager.id,
        companyId,
      },
    });
  }
  console.log(`    ✅ 10 lost deal analyses`);

  // ── 2P: KEY ACCOUNTS — 20 records ────────────────────────────────────────
  console.log("  2P. Key accounts...");

  const importanceLevels = ["Critical", "High", "Medium"];
  const relationshipStatuses = ["Strong", "Developing", "Stable", "Growing"];
  for (let i = 0; i < 20; i++) {
    await prisma.keyAccount.create({
      data: {
        customerId: accounts[i].id,
        accountManagerId:
          i % 3 === 0
            ? manager.id
            : i % 2 === 0
            ? exec1.id
            : exec2.id,
        revenuePotential: 1000000 + i * 250000,
        strategicImportance: importanceLevels[i % importanceLevels.length],
        relationshipStatus:
          relationshipStatuses[i % relationshipStatuses.length],
        nextReviewDate: daysFromNow(7 + i * 3),
        notes: `${accounts[i].name} is a priority account with ₹${(
          (1000000 + i * 250000) /
          100000
        ).toFixed(1)}L annual potential. Next review focused on Q3 expansion.`,
        companyId,
      },
    });
  }
  console.log(`    ✅ 20 key accounts`);

  // ── 2Q: TERRITORIES — 4 territories with 5 accounts each ─────────────────
  console.log("  2Q. Territories...");

  const territoryData = [
    {
      name: "South India — Auto Hub",
      region: "South",
      states: "Tamil Nadu, Karnataka, Kerala, Andhra Pradesh",
      execIdx: 0,
    },
    {
      name: "West India — Industrial",
      region: "West",
      states: "Maharashtra, Gujarat, Rajasthan, Goa",
      execIdx: 1,
    },
    {
      name: "North India — OEM Belt",
      region: "North",
      states: "Delhi, Haryana, Punjab, Uttar Pradesh",
      execIdx: 0,
    },
    {
      name: "East India — Manufacturing",
      region: "East",
      states: "West Bengal, Odisha, Bihar, Jharkhand",
      execIdx: 1,
    },
  ];
  const territories: { id: string }[] = [];
  for (let i = 0; i < territoryData.length; i++) {
    const td = territoryData[i];
    const territory = await prisma.territory.create({
      data: {
        name: td.name,
        region: td.region,
        states: td.states,
        assignedUserId: td.execIdx === 0 ? exec1.id : exec2.id,
        isActive: true,
        companyId,
        accounts: {
          create: accounts
            .slice(i * 5, i * 5 + 5)
            .map((a) => ({ customerId: a.id })),
        },
      },
    });
    territories.push({ id: territory.id });
  }
  console.log(`    ✅ ${territories.length} territories`);

  // ── 2R: SALES TARGETS — 20 records ───────────────────────────────────────
  console.log("  2R. Sales targets...");

  const now = new Date();
  let targetIndex = 0;

  // 12 Monthly targets (6 months × 2 execs)
  for (let m = 0; m < 6; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    for (const [eIdx, exec] of [exec1, exec2].entries()) {
      if (targetIndex >= 20) break;
      const terrId = territories[targetIndex % territories.length].id;
      try {
        await prisma.salesTarget.create({
          data: {
            targetType: "Monthly",
            period,
            targetAmount: 800000 + m * 50000,
            achievedAmount: m > 2 ? 720000 + m * 40000 : 0,
            assignedUserId: exec.id,
            territoryId: terrId,
            companyId,
          },
        });
        targetIndex++;
      } catch {
        // Skip duplicates from unique constraint
      }
    }
  }

  // 4 Quarterly targets
  const quarters = ["2026-Q1", "2026-Q2", "2025-Q4", "2025-Q3"];
  for (const q of quarters) {
    if (targetIndex >= 20) break;
    try {
      await prisma.salesTarget.create({
        data: {
          targetType: "Quarterly",
          period: q,
          targetAmount: 2500000,
          achievedAmount: q.includes("2025") ? 2200000 : 0,
          assignedUserId: exec1.id,
          territoryId: territories[0].id,
          companyId,
        },
      });
      targetIndex++;
    } catch {
      // Skip duplicates
    }
  }

  // 2 Yearly targets
  for (const year of ["2026", "2025"]) {
    if (targetIndex >= 20) break;
    try {
      await prisma.salesTarget.create({
        data: {
          targetType: "Yearly",
          period: year,
          targetAmount: 10000000,
          achievedAmount: year === "2025" ? 8800000 : 0,
          assignedUserId: exec1.id,
          // No territoryId for yearly — unique constraint allows null
          companyId,
        },
      });
      targetIndex++;
    } catch {
      // Skip duplicates
    }
  }
  console.log(`    ✅ ${targetIndex} sales targets`);

  // ── 2S: FORECAST ENTRIES — 18 records (6 months × 3 types) ───────────────
  console.log("  2S. Forecast entries...");

  const forecastTypes = ["Revenue", "Opportunity", "Sales"];
  let forecastCount = 0;
  for (let m = 0; m < 6; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    for (const ft of forecastTypes) {
      await prisma.forecastEntry.create({
        data: {
          month: d.getMonth() + 1,
          year: d.getFullYear(),
          forecastType: ft,
          targetAmount:
            ft === "Revenue"
              ? 2000000 + m * 100000
              : ft === "Opportunity"
              ? 5000000 + m * 200000
              : 1500000 + m * 75000,
          achievedAmount: m > 2 ? 1750000 + m * 80000 : 0,
          assignedUserId: exec1.id,
          companyId,
          notes: `${ft} forecast for ${d.toLocaleString("default", {
            month: "long",
          })} ${d.getFullYear()}`,
        },
      });
      forecastCount++;
    }
  }
  console.log(`    ✅ ${forecastCount} forecast entries`);

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 3 — VERIFICATION
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n📊 PHASE 3 — Verification queries...\n");

  const counts = {
    leadSources: await prisma.leadSource.count({
      where: { companyId },
    }),
    pipelineStages: await prisma.pipelineStage.count({
      where: { companyId },
    }),
    lossReasons: await prisma.lossReason.count({
      where: { companyId },
    }),
    emailTemplates: await prisma.emailTemplate.count({
      where: { companyId },
    }),
    productCategories: await prisma.productCategory.count({
      where: { companyId },
    }),
    products: await prisma.product.count({ where: { companyId } }),
    accounts: await prisma.customer.count({ where: { companyId } }),
    contacts: await prisma.contact.count({ where: { companyId } }),
    leads: await prisma.lead.count({ where: { companyId } }),
    deals: await prisma.deal.count({ where: { companyId } }),
    rfqs: await prisma.rFQ.count({ where: { companyId } }),
    quotations: await prisma.quotation.count({ where: { companyId } }),
    sampleRequests: await prisma.sampleRequest.count({
      where: { companyId },
    }),
    negotiations: await prisma.negotiation.count({ where: { companyId } }),
    purchaseOrders: await prisma.purchaseOrder.count({
      where: { companyId },
    }),
    tasks: await prisma.task.count({ where: { companyId } }),
    followUps: await prisma.followUp.count({ where: { companyId } }),
    activities: await prisma.communicationLog.count({
      where: { sentByUserId: { in: users.map((u) => u.id) } },
    }),
    competitors: await prisma.competitor.count({ where: { companyId } }),
    keyAccounts: await prisma.keyAccount.count({ where: { companyId } }),
    territories: await prisma.territory.count({ where: { companyId } }),
    salesTargets: await prisma.salesTarget.count({ where: { companyId } }),
    forecastEntries: await prisma.forecastEntry.count({
      where: { companyId },
    }),
  };

  console.table(counts);

  // Expected minimums
  const expected: Record<string, number> = {
    products: 20,
    accounts: 20,
    contacts: 20,
    leads: 20,
    deals: 20,
    rfqs: 20,
    quotations: 20,
    sampleRequests: 20,
    negotiations: 20,
    purchaseOrders: 20,
    tasks: 20,
    followUps: 20,
    activities: 20,
    competitors: 20,
    keyAccounts: 20,
  };

  let allPassed = true;
  for (const [key, min] of Object.entries(expected)) {
    const actual = counts[key as keyof typeof counts] ?? 0;
    if (actual < min) {
      console.error(
        `❌ FAIL: ${key} has ${actual} records, expected >= ${min}`
      );
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log(
      "\n🎉 All verification checks passed! V4 seed complete.\n"
    );
  } else {
    throw new Error("Seed verification failed — some counts are below minimum.");
  }
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
