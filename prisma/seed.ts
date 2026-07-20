/**
 * SUKI CRM — Consolidated Seed Script
 *
 * Run: npx prisma db seed  (or  npx tsx prisma/seed.ts)
 *
 * Seeds ALL data in one script:
 *   - Company, Users, Lead Sources
 *   - Customers, Contacts, Leads, Deals
 *   - Follow-ups, Tasks, Communication Logs, Notes, Notifications
 *   - Pipeline Stages, Product Categories, Products
 *   - Material/Labor Rates, BOM Items, Routing Operations
 *   - Service Workspace (config, teams, engineers, assets)
 *   - Service Operational (requests, complaints, defects, installations, warranties, AMCs, visits)
 *
 * Minimal demo data: 5-8 records per module covering all status values.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID as uuidv4 } from "crypto";
import { seedServiceWorkspace } from "./seeds/serviceWorkspaceSeed";

const prisma = new PrismaClient();

function daysAgo(n: number): Date { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function daysFromNow(n: number): Date { const d = new Date(); d.setDate(d.getDate() + n); return d; }

/**
 * Seeds the same shape of CRM + catalog sample data (customers, contacts, leads, deals,
 * follow-ups, tasks, communication logs, notes, notifications, product categories,
 * products, material rates, labor rates, BOM items, routing operations) for a single
 * variant demo company. `tag` keeps customerCode/email/leadCode/taskCode unique across
 * companies (Customer.customerCode, Customer.email, Lead.leadCode, Lead.email are
 * globally @unique in schema.prisma). Product.productCode is @@unique([companyId, productCode])
 * so it does not need tagging. Assigns everything to the company's single adminUser since
 * variant companies only have one seeded user.
 */
async function seedVariantCompanyData(prisma: PrismaClient, company: any, adminUser: any, tag: string, now: Date) {
  console.log(`Seeding sample data for ${company.name}...`);

  const customersData = [
    { customerCode: `CUST-${tag}-001`, name: "Tata Motors Ltd.", email: `procurement@tatamotors-${tag.toLowerCase()}.demo.com`, phone: "+91-9876501001", city: "Pune", status: "Active", industryType: "Automotive" },
    { customerCode: `CUST-${tag}-002`, name: "Ashok Leyland Industries", email: `supply@ashleyland-${tag.toLowerCase()}.demo.com`, phone: "+91-9845501002", city: "Chennai", status: "Active", industryType: "Automotive" },
    { customerCode: `CUST-${tag}-003`, name: "Bharat Forge Ltd.", email: `purchase@bharatforge-${tag.toLowerCase()}.demo.com`, phone: "+91-9822501003", city: "Pune", status: "Active", industryType: "Forging" },
    { customerCode: `CUST-${tag}-004`, name: "JSW Steel Ltd.", email: `procurement@jsw-${tag.toLowerCase()}.demo.com`, phone: "+91-9819001004", city: "Mumbai", status: "Active", industryType: "Steel" },
    { customerCode: `CUST-${tag}-005`, name: "Bosch India Ltd.", email: `supply@bosch-${tag.toLowerCase()}.demo.com`, phone: "+91-9845501005", city: "Bangalore", status: "Active", industryType: "Auto Components" },
  ];
  const createdCustomers: any[] = [];
  for (const c of customersData) {
    createdCustomers.push(await prisma.customer.create({ data: { ...c, companyId: company.id } }));
  }

  const contactsData = [
    { name: "Rajesh Sharma", email: `rajesh.sharma@tatamotors-${tag.toLowerCase()}.demo.com`, phone: "+91-9876502001", title: "VP Procurement", customerId: createdCustomers[0].id, ownerId: adminUser.id },
    { name: "Anita Desai", email: `anita.desai@ashleyland-${tag.toLowerCase()}.demo.com`, phone: "+91-9845502002", title: "Supply Chain Head", customerId: createdCustomers[1].id, ownerId: adminUser.id },
    { name: "Suresh Iyer", email: `suresh.iyer@bharatforge-${tag.toLowerCase()}.demo.com`, phone: "+91-9822502003", title: "Plant Manager", customerId: createdCustomers[2].id, ownerId: adminUser.id },
    { name: "Vikas Patil", email: `vikas.patil@jsw-${tag.toLowerCase()}.demo.com`, phone: "+91-9819002004", title: "Procurement Lead", customerId: createdCustomers[3].id, ownerId: adminUser.id },
    { name: "Meera Krishnan", email: `meera.k@bosch-${tag.toLowerCase()}.demo.com`, phone: "+91-9845502005", title: "Quality Director", customerId: createdCustomers[4].id, ownerId: adminUser.id },
  ];
  const createdContacts: any[] = [];
  for (const c of contactsData) {
    createdContacts.push(await prisma.contact.create({ data: { ...c, status: "Active", companyId: company.id } }));
  }

  const leadsData = [
    { leadCode: `LEAD-${tag}-001`, name: "Ravi Kumar", companyName: "Tata Motors Ltd.", email: `ravi.kumar@tatamotors-${tag.toLowerCase()}.demo.com`, phone: "+91-9876543210", city: "Pune", leadSource: "Exhibition", industryType: "Automotive", estimatedValue: 7500000, budgetAsked: "₹50-75L", timelineAsked: "Q3 2026", notes: "Interested in hydraulic press maintenance contract." },
    { leadCode: `LEAD-${tag}-002`, name: "Suresh Reddy", companyName: "Ashok Leyland Industries", email: `suresh.reddy@ashleyland-${tag.toLowerCase()}.demo.com`, phone: "+91-9845123456", city: "Chennai", leadSource: "Referral", industryType: "Automotive", estimatedValue: 3000000, budgetAsked: "₹20-30L", timelineAsked: "2 months", notes: "Enquiry for CNC machine parts supply." },
    { leadCode: `LEAD-${tag}-003`, name: "Amit Patel", companyName: "JSW Steel Ltd.", email: `amit.patel@jsw-${tag.toLowerCase()}.demo.com`, phone: "+91-9819009999", city: "Mumbai", leadSource: "Website", industryType: "Steel", estimatedValue: 5000000, budgetAsked: "₹30-50L", timelineAsked: "Q4 2026", notes: "Steel fabrication Q3 order inquiry." },
    { leadCode: `LEAD-${tag}-004`, name: "Sneha Gupta", companyName: "Bosch India Ltd.", email: `sneha.g@bosch-${tag.toLowerCase()}.demo.com`, phone: "+91-9845508888", city: "Bangalore", leadSource: "Cold Call", industryType: "Auto Components", estimatedValue: 2000000, budgetAsked: "₹10-20L", timelineAsked: "1 month", notes: "QC system upgrade inquiry." },
    { leadCode: `LEAD-${tag}-005`, name: "Karthik Nair", companyName: "Bharat Forge Ltd.", email: `karthik.n@bharatforge-${tag.toLowerCase()}.demo.com`, phone: "+91-9822507777", city: "Pune", leadSource: "Referral", industryType: "Forging", estimatedValue: 4000000, budgetAsked: "₹25-40L", timelineAsked: "3 months", notes: "Forging equipment upgrade evaluation." },
  ];
  const createdLeads: any[] = [];
  for (const ld of leadsData) {
    const leadId = uuidv4();
    await prisma.lead.create({ data: { id: leadId, ...ld, assignedUserId: adminUser.id, status: "New", companyId: company.id } });
    createdLeads.push({ id: leadId, ...ld });
  }

  const dealNames = [
    "CNC Machine Parts Supply — Tata Motors", "Hydraulic Press Maintenance Contract", "Precision Components Annual AMC",
    "Steel Fabrication Q3 Order — JSW", "Industrial Automation Pilot — Bosch",
  ];
  for (let i = 0; i < dealNames.length; i++) {
    await prisma.deal.create({
      data: {
        id: uuidv4(), dealName: dealNames[i], customerId: createdCustomers[i].id,
        assignedUserId: adminUser.id, status: ["Qualified", "TechnicalDiscussion", "DemoConducted", "Won", "Lost"][i],
        dealValue: [7500000, 3000000, 5000000, 2000000, 4000000][i], expectedCloseDate: daysFromNow(30 + i * 15),
        companyId: company.id,
      },
    });
  }

  const fuData = [
    { customerIdx: 0, days: 2, status: "Pending", remarks: "Call to confirm demo slot." },
    { customerIdx: 1, days: -3, status: "Pending", remarks: "OVERDUE: CNC parts follow-up." },
    { customerIdx: 2, days: 5, status: "Pending", remarks: "Send revised quotation." },
    { customerIdx: 3, days: -1, status: "Completed", remarks: "DONE: Proposal accepted." },
    { customerIdx: 4, days: 7, status: "Pending", remarks: "QC system demo scheduling." },
  ];
  for (const fu of fuData) {
    const d = new Date(now); d.setDate(d.getDate() + fu.days);
    await prisma.followUp.create({
      data: { id: uuidv4(), customerId: createdCustomers[fu.customerIdx].id, assignedUserId: adminUser.id, nextMeetingDate: d, remarks: fu.remarks, status: fu.status, companyId: company.id, updatedAt: now },
    });
  }

  const taskData = [
    { title: "Prepare proposal for Tata Motors AMC", status: "Pending", priority: "High", days: 2 },
    { title: "Client follow-up call — Ashok Leyland", status: "Pending", priority: "High", days: -1 },
    { title: "Update CRM data for Q2 leads", status: "Completed", priority: "Medium", days: -3 },
    { title: "Schedule demo for JSW Steel", status: "Pending", priority: "Medium", days: 5 },
    { title: "Contract review — Bosch India", status: "Overdue", priority: "High", days: -2 },
  ];
  for (let i = 0; i < taskData.length; i++) {
    const t = taskData[i];
    const d = new Date(now); d.setDate(d.getDate() + t.days);
    await prisma.task.create({
      data: { id: uuidv4(), taskCode: `TSK-${tag}-${String(i + 1).padStart(4, "0")}`, title: t.title, description: t.title, status: t.status, priority: t.priority, dueDate: d, assignedTo: adminUser.id, companyId: company.id },
    });
  }

  const commLogs = [
    { channel: "Call", direction: "Outbound", status: "Completed", content: "Initial discussion with client about project requirements.", duration: 15, outcome: "Interested" },
    { channel: "Meeting", direction: "Inbound", status: "Completed", content: "Technical evaluation meeting with procurement team.", duration: 45, outcome: "Positive" },
    { channel: "Email", direction: "Outbound", status: "Delivered", content: "Proposal sent for precision components AMC.", duration: 0, outcome: "Awaiting response" },
    { channel: "Note", direction: "Outbound", status: "Completed", content: "Client prefers email communication. Update preference.", duration: 0, outcome: "Noted" },
    { channel: "Call", direction: "Inbound", status: "Missed", content: "Missed call from client regarding quotation status.", duration: 0, outcome: "Callback needed" },
  ];
  for (let i = 0; i < commLogs.length; i++) {
    const c = commLogs[i];
    await prisma.communicationLog.create({
      data: { id: uuidv4(), customerId: createdCustomers[i % createdCustomers.length].id, sentByUserId: adminUser.id, channel: c.channel, direction: c.direction, status: c.status, content: c.content, duration: c.duration, outcome: c.outcome, companyId: company.id, sentAt: daysAgo(i) },
    });
  }

  const notesData = [
    { entityType: "LEAD", content: "Lead came through website enquiry. Budget approved." },
    { entityType: "CONTACT", content: "Prefers morning calls before 10 AM." },
    { entityType: "LEAD", content: "Met at Auto Expo 2026. Strong interest in automation." },
  ];
  for (let i = 0; i < notesData.length; i++) {
    const note = notesData[i];
    await prisma.note.create({
      data: { id: uuidv4(), content: note.content, createdById: adminUser.id, entityType: note.entityType, entityId: note.entityType === "LEAD" ? createdLeads[i % createdLeads.length].id : createdContacts[i % createdContacts.length].id, companyId: company.id },
    });
  }

  for (let i = 0; i < 3; i++) {
    await prisma.notification.create({
      data: { id: uuidv4(), userId: adminUser.id, title: ["Visit reminder", "Deal update", "Task overdue"][i], message: ["Customer visit scheduled for tomorrow.", "Deal moved to Technical Discussion stage.", "Task 'Prepare proposal' is overdue."][i], type: ["visit", "deal", "task"][i], isRead: i !== 0 },
    });
  }

  const categoriesData = [
    { name: "CNC Machined Components", description: "Precision-machined parts", defaultOverhead: 15, defaultMargin: 20 },
    { name: "Forging Components", description: "Forged parts and assemblies", defaultOverhead: 18, defaultMargin: 22 },
    { name: "Hydraulic Systems", description: "Hydraulic presses, cylinders, and parts", defaultOverhead: 12, defaultMargin: 18 },
    { name: "Steel Fabrication", description: "Custom steel fabrication", defaultOverhead: 20, defaultMargin: 25 },
    { name: "Industrial Automation", description: "Automation systems and control units", defaultOverhead: 10, defaultMargin: 15 },
    { name: "Electrical Equipment", description: "Motors, windings, and electrical components", defaultOverhead: 13, defaultMargin: 19 },
  ];
  const createdCategories: Record<string, string> = {};
  for (const cat of categoriesData) {
    const created = await prisma.productCategory.create({
      data: { name: cat.name, description: cat.description, isActive: true, defaultOverheadPercent: cat.defaultOverhead, defaultMarginPercent: cat.defaultMargin, companyId: company.id },
    });
    createdCategories[cat.name] = created.id;
  }

  const productsData = [
    { code: "PRD-001", name: "CNC Bracket Assembly — Type A", category: "CNC Machined Components", unit: "pcs", basePrice: 450, hsn: "8473", type: "Finished" },
    { code: "PRD-005", name: "Connecting Rod Forging — EN24", category: "Forging Components", unit: "pcs", basePrice: 850, hsn: "8431", type: "Finished" },
    { code: "PRD-007", name: "Hydraulic Press Cylinder — 100 Ton", category: "Hydraulic Systems", unit: "set", basePrice: 85000, hsn: "8412", type: "Finished" },
    { code: "PRD-009", name: "Hydraulic Press Maintenance Package", category: "Hydraulic Systems", unit: "job", basePrice: 25000, hsn: "9987", type: "Service" },
    { code: "PRD-010", name: "Steel Fabrication Frame — Custom", category: "Steel Fabrication", unit: "pcs", basePrice: 15000, hsn: "7308", type: "Finished" },
    { code: "PRD-012", name: "PLC Control Panel — Siemens S7-1500", category: "Industrial Automation", unit: "set", basePrice: 125000, hsn: "8537", type: "Finished" },
    { code: "PRD-016", name: "Fuel Injector Inspection Gauge", category: "Industrial Automation", unit: "pcs", basePrice: 8500, hsn: "9031", type: "Finished" },
    { code: "PRD-018", name: "Motor Winding — 3-Phase 50HP", category: "Electrical Equipment", unit: "pcs", basePrice: 18500, hsn: "8501", type: "Finished" },
  ];
  for (const p of productsData) {
    await prisma.product.create({
      data: { productCode: p.code, name: p.name, categoryId: createdCategories[p.category] || null, unit: p.unit, basePrice: p.basePrice, hsnCode: p.hsn, productType: p.type, isActive: true, companyId: company.id },
    });
  }

  const materialRates = [
    { code: "MAT-001", name: "EN8 Steel Round Bar", unitRate: 85, unit: "kg" },
    { code: "MAT-003", name: "SS316 Stainless Steel", unitRate: 350, unit: "kg" },
    { code: "MAT-005", name: "Carbon Steel Plate IS2062", unitRate: 65, unit: "kg" },
    { code: "MAT-007", name: "Copper Wire", unitRate: 450, unit: "kg" },
  ];
  for (const mr of materialRates) {
    await prisma.materialRate.create({
      data: { materialCode: mr.code, materialName: mr.name, unitRate: mr.unitRate, unit: mr.unit, currency: "INR", validFrom: new Date("2024-01-01"), companyId: company.id },
    });
  }

  const laborRates = [
    { workCenter: "CNC-Machining", hourlyRate: 450, setupRate: 200 },
    { workCenter: "Forging-Press", hourlyRate: 380, setupRate: 150 },
    { workCenter: "Welding-Fabrication", hourlyRate: 350, setupRate: 120 },
    { workCenter: "Quality-Inspection", hourlyRate: 280, setupRate: 80 },
  ];
  for (const lr of laborRates) {
    await prisma.laborRate.create({
      data: { workCenter: lr.workCenter, hourlyRate: lr.hourlyRate, setupRate: lr.setupRate, currency: "INR", validFrom: new Date("2024-01-01"), companyId: company.id },
    });
  }

  const bomItems = [
    { productCode: "PRD-001", materialCode: "MAT-001", quantity: 2.5, scrap: 5 },
    { productCode: "PRD-005", materialCode: "MAT-001", quantity: 4.5, scrap: 8 },
    { productCode: "PRD-007", materialCode: "MAT-003", quantity: 8.5, scrap: 4 },
    { productCode: "PRD-010", materialCode: "MAT-005", quantity: 12.0, scrap: 6 },
  ];
  for (const bom of bomItems) {
    const product = await prisma.product.findFirst({ where: { productCode: bom.productCode, companyId: company.id } });
    if (product) {
      await prisma.bOMItem.create({ data: { productId: product.id, materialCode: bom.materialCode, quantity: bom.quantity, scrapPercent: bom.scrap, companyId: company.id } });
    }
  }

  const routingOps = [
    { productCode: "PRD-001", sequence: 1, operation: "CNC Roughing", workCenter: "CNC-Machining", cycleTime: 15, setup: 5 },
    { productCode: "PRD-001", sequence: 2, operation: "CNC Finishing", workCenter: "CNC-Machining", cycleTime: 20, setup: 8 },
    { productCode: "PRD-005", sequence: 1, operation: "Heating", workCenter: "Forging-Press", cycleTime: 8, setup: 15 },
    { productCode: "PRD-005", sequence: 2, operation: "Forging", workCenter: "Forging-Press", cycleTime: 12, setup: 20 },
    { productCode: "PRD-007", sequence: 1, operation: "Tube Cutting", workCenter: "Welding-Fabrication", cycleTime: 20, setup: 12 },
    { productCode: "PRD-007", sequence: 2, operation: "Welding", workCenter: "Welding-Fabrication", cycleTime: 35, setup: 18 },
  ];
  for (const route of routingOps) {
    const product = await prisma.product.findFirst({ where: { productCode: route.productCode, companyId: company.id } });
    if (product) {
      await prisma.routingOperation.create({ data: { productId: product.id, sequence: route.sequence, operationName: route.operation, workCenter: route.workCenter, cycleTimeMin: route.cycleTime, setupTimeMin: route.setup, companyId: company.id } });
    }
  }

  console.log(`  ${company.name}: sample data seeded (5 customers, 5 contacts, 5 leads, 5 deals, 5 follow-ups, 5 tasks, 5 comm logs, 3 notes, 3 notifications, 6 categories, 8 products, 4 material rates, 4 labor rates, 4 BOM items, 6 routing ops).`);
}

async function main() {
  const now = new Date();

  console.log("Cleaning up existing database records...");
  // Service operational tables (children first)
  // ServiceReview must be deleted before its parents (ServiceVisit, ServiceRequest, Complaint,
  // Defect, Installation) — it holds unique nullable FKs to each with onDelete: SetNull, and
  // SQL Server permits only one NULL per unique constraint, so cascading SET NULL across
  // multiple existing rows at once violates it unless ServiceReview is cleared first.
  await prisma.serviceReview.deleteMany({});
  await prisma.serviceVisit.deleteMany({});
  await prisma.warrantyClaim.deleteMany({});
  await prisma.aMCContract.deleteMany({});
  await prisma.installation.deleteMany({});
  await prisma.defect.deleteMany({});
  await prisma.complaint.deleteMany({});
  await prisma.serviceRequest.deleteMany({});
  // Service workspace config
  await prisma.customerAsset.deleteMany({});
  await prisma.serviceEngineer.deleteMany({});
  await prisma.serviceTeam.deleteMany({});
  await prisma.serviceStatus.deleteMany({});
  await prisma.priorityLevel.deleteMany({});
  await prisma.defectType.deleteMany({});
  await prisma.complaintType.deleteMany({});
  await prisma.serviceCategory.deleteMany({});
  // CRM tables
  await prisma.callLog.deleteMany({});
  await prisma.communicationLog.deleteMany({});
  await prisma.note.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  // These tables hold NoAction FKs to Quotation/Negotiation and must be cleared first.
  await prisma.competitorInvolvement.deleteMany({});
  await prisma.quotationApproval.deleteMany({});
  await prisma.quotationRevisionSnapshot.deleteMany({});
  await prisma.quotationStatusHistory.deleteMany({});
  // Quotation.negotiationId <-> Negotiation.quotationId is a circular nullable FK pair
  // (both onDelete: NoAction); null out both sides before deleting either table.
  await prisma.quotation.updateMany({ data: { negotiationId: null, parentQuotationId: null } });
  await prisma.negotiation.updateMany({ data: { quotationId: null } });
  await prisma.negotiation.deleteMany({});
  await prisma.quotation.deleteMany({});
  await prisma.sampleRequest.deleteMany({});
  await prisma.contact.deleteMany({});
  await prisma.followUp.deleteMany({});
  await prisma.dealStageHistory.deleteMany({});
  await prisma.opportunityDetail.deleteMany({});
  await prisma.opportunityRequirementItem.deleteMany({});
  await prisma.opportunityTechnicalNote.deleteMany({});
  await prisma.proposal.deleteMany({});
  await prisma.approvalHistory.deleteMany({});
  await prisma.rFQ.deleteMany({});
  await prisma.quotationItem.deleteMany({});
  await prisma.negotiationRevision.deleteMany({});
  await prisma.purchaseOrderItem.deleteMany({});
  await prisma.deal.deleteMany({});
  await prisma.leadOwnerHistory.deleteMany({});
  await prisma.leadStatusHistory.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.customerVisit.deleteMany({});
  await prisma.marketingVisit.deleteMany({});
  await prisma.visitor.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.notificationPreference.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.territoryAccount.deleteMany({});
  await prisma.salesTarget.deleteMany({});
  await prisma.territory.deleteMany({});
  await prisma.keyAccount.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.supportTicket.deleteMany({});
  await prisma.lostDealAnalysis.deleteMany({});
  await prisma.lossReason.deleteMany({});
  await prisma.competitorProduct.deleteMany({});
  await prisma.competitor.deleteMany({});
  await prisma.forecastEntry.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.cRMDocument.deleteMany({});
  await prisma.approvalRequest.deleteMany({});
  await prisma.productSpecification.deleteMany({});
  await prisma.bOMItem.deleteMany({});
  await prisma.routingOperation.deleteMany({});
  await prisma.materialRate.deleteMany({});
  await prisma.laborRate.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.productCategory.deleteMany({});
  await prisma.proposalVersion.deleteMany({});
  await prisma.pipelineStage.deleteMany({});
  await prisma.pipelineStageMaster.deleteMany({});
  await prisma.exchangeRate.deleteMany({});
  await prisma.emailTemplate.deleteMany({});
  await prisma.whatsAppTemplate.deleteMany({});
  await prisma.systemConfig.deleteMany({});

  // ---- Lead Sources ----
  console.log("Seeding lead sources...");
  for (const src of ["Website", "Referral", "Exhibition", "Cold Call", "Email Campaign", "Social Media"]) {
    await prisma.leadSource.upsert({ where: { name: src }, update: {}, create: { name: src, isActive: true } });
  }

  // ---- Company ----
  console.log("Seeding default company...");
  const findOrCreateCompany = async (data: { name: string; variant?: number; domain?: string }) => {
    const existing = await prisma.company.findFirst({ where: { name: data.name } });
    if (existing) return existing;
    return prisma.company.create({ data: { id: uuidv4(), ...data } });
  };
  const defaultCompany = await findOrCreateCompany({ name: "Suki Software Solutions Pvt. Ltd." });

  // ---- Variant demo companies (3) ----
  console.log("Seeding variant demo companies...");
  const demoVariant1Company = await findOrCreateCompany({ name: "Demo Variant 1 Company", variant: 1, domain: "demo-variant1.sukisoftware.com" });
  const demoVariant2Company = await findOrCreateCompany({ name: "Demo Variant 2 Company", variant: 2, domain: "demo-variant2.sukisoftware.com" });
  const demoVariant3Company = await findOrCreateCompany({ name: "Demo Variant 3 Company", variant: 3, domain: "demo-variant3.sukisoftware.com" });

  // ---- Users (6 + 4 demo) ----
  console.log("Seeding users...");
  const passwordHash = await bcrypt.hash("Password@123", 10);
  const usersData = [
    { email: "admin@sukisoftware.com", name: "System Admin", role: "Admin", companyId: defaultCompany.id },
    { email: "lead@sukisoftware.com", name: "Vikram Iyer", role: "SalesManager", companyId: defaultCompany.id },
    { email: "exec1@sukisoftware.com", name: "Arjun Mehta", role: "SalesExecutive", companyId: defaultCompany.id },
    { email: "exec2@sukisoftware.com", name: "Priya Nair", role: "SalesExecutive", companyId: defaultCompany.id },
    { email: "exec3@sukisoftware.com", name: "Karthik Reddy", role: "SalesExecutive", companyId: defaultCompany.id },
    { email: "exec4@sukisoftware.com", name: "Deepa Krishnan", role: "SalesExecutive", companyId: defaultCompany.id },
    { email: "demo1admin@sukisoftware.com", name: "Demo Admin", role: "DemoAdmin", companyId: defaultCompany.id },
    { email: "variant1@sukisoftware.com", name: "Variant 1 Demo User", role: "Admin", companyId: demoVariant1Company.id },
    { email: "variant2@sukisoftware.com", name: "Variant 2 Demo User", role: "Admin", companyId: demoVariant2Company.id },
    { email: "variant3@sukisoftware.com", name: "Variant 3 Demo User", role: "Admin", companyId: demoVariant3Company.id },
  ];
  const createdUsers: Record<string, any> = {};
  for (const u of usersData) {
    let userRecord = await prisma.user.findFirst({ where: { email: u.email } });
    if (!userRecord) {
      userRecord = await prisma.user.create({
        data: { email: u.email, name: u.name, passwordHash, role: u.role, isActive: true, isFirstLogin: false, companyId: u.companyId },
      });
    }
    createdUsers[u.email] = userRecord;
  }
  const execs = [
    createdUsers["exec1@sukisoftware.com"],
    createdUsers["exec2@sukisoftware.com"],
    createdUsers["exec3@sukisoftware.com"],
    createdUsers["exec4@sukisoftware.com"],
  ];
  console.log("10 users created.");

  // ---- DemoAdmin role permission ----
  console.log("Seeding DemoAdmin role permission...");
  await prisma.rolePermission.upsert({
    where: { role_module: { role: "DemoAdmin", module: "User Management" } },
    update: {},
    create: { role: "DemoAdmin", module: "User Management", visible: false, canDelete: false },
  });

  // ---- Customers (5) ----
  console.log("Seeding customers...");
  const customersData = [
    { customerCode: "CUST-001", name: "Tata Motors Ltd.", email: "procurement@tatamotors.com", phone: "+91-9876501001", city: "Pune", status: "Active", industryType: "Automotive" },
    { customerCode: "CUST-002", name: "Ashok Leyland Industries", email: "supply@ashleyland.com", phone: "+91-9845501002", city: "Chennai", status: "Active", industryType: "Automotive" },
    { customerCode: "CUST-003", name: "Bharat Forge Ltd.", email: "purchase@bharatforge.com", phone: "+91-9822501003", city: "Pune", status: "Active", industryType: "Forging" },
    { customerCode: "CUST-004", name: "JSW Steel Ltd.", email: "procurement@jsw.in", phone: "+91-9819001004", city: "Mumbai", status: "Active", industryType: "Steel" },
    { customerCode: "CUST-005", name: "Bosch India Ltd.", email: "supply@bosch.in", phone: "+91-9845501005", city: "Bangalore", status: "Active", industryType: "Auto Components" },
  ];
  const createdCustomers: any[] = [];
  for (const c of customersData) {
    createdCustomers.push(await prisma.customer.create({
      data: { ...c, companyId: defaultCompany.id },
    }));
  }
  console.log("5 customers created.");

  // ---- Contacts (5) ----
  console.log("Seeding contacts...");
  const contactsData = [
    { name: "Rajesh Sharma", email: "rajesh.sharma@tatamotors.com", phone: "+91-9876502001", title: "VP Procurement", customerId: createdCustomers[0].id, ownerId: execs[0].id },
    { name: "Anita Desai", email: "anita.desai@ashleyland.com", phone: "+91-9845502002", title: "Supply Chain Head", customerId: createdCustomers[1].id, ownerId: execs[1].id },
    { name: "Suresh Iyer", email: "suresh.iyer@bharatforge.com", phone: "+91-9822502003", title: "Plant Manager", customerId: createdCustomers[2].id, ownerId: execs[2].id },
    { name: "Vikas Patil", email: "vikas.patil@jsw.in", phone: "+91-9819002004", title: "Procurement Lead", customerId: createdCustomers[3].id, ownerId: execs[3].id },
    { name: "Meera Krishnan", email: "meera.k@bosch.in", phone: "+91-9845502005", title: "Quality Director", customerId: createdCustomers[4].id, ownerId: execs[0].id },
  ];
  const createdContacts: any[] = [];
  for (const c of contactsData) {
    createdContacts.push(await prisma.contact.create({
      data: { ...c, status: "Active", companyId: defaultCompany.id },
    }));
  }
  console.log("5 contacts created.");

  // ---- Leads (5) ----
  console.log("Seeding leads...");
  const leadsData = [
    { leadCode: "LEAD-001", name: "Ravi Kumar", companyName: "Tata Motors Ltd.", email: "ravi.kumar@tatamotors.com", phone: "+91-9876543210", city: "Pune", leadSource: "Exhibition", industryType: "Automotive", estimatedValue: 7500000, budgetAsked: "₹50-75L", timelineAsked: "Q3 2026", notes: "Interested in hydraulic press maintenance contract." },
    { leadCode: "LEAD-002", name: "Suresh Reddy", companyName: "Ashok Leyland Industries", email: "suresh.reddy@ashleyland.com", phone: "+91-9845123456", city: "Chennai", leadSource: "Referral", industryType: "Automotive", estimatedValue: 3000000, budgetAsked: "₹20-30L", timelineAsked: "2 months", notes: "Enquiry for CNC machine parts supply." },
    { leadCode: "LEAD-003", name: "Amit Patel", companyName: "JSW Steel Ltd.", email: "amit.patel@jsw.in", phone: "+91-9819009999", city: "Mumbai", leadSource: "Website", industryType: "Steel", estimatedValue: 5000000, budgetAsked: "₹30-50L", timelineAsked: "Q4 2026", notes: "Steel fabrication Q3 order inquiry." },
    { leadCode: "LEAD-004", name: "Sneha Gupta", companyName: "Bosch India Ltd.", email: "sneha.g@bosch.in", phone: "+91-9845508888", city: "Bangalore", leadSource: "Cold Call", industryType: "Auto Components", estimatedValue: 2000000, budgetAsked: "₹10-20L", timelineAsked: "1 month", notes: "QC system upgrade inquiry." },
    { leadCode: "LEAD-005", name: "Karthik Nair", companyName: "Bharat Forge Ltd.", email: "karthik.n@bharatforge.com", phone: "+91-9822507777", city: "Pune", leadSource: "Referral", industryType: "Forging", estimatedValue: 4000000, budgetAsked: "₹25-40L", timelineAsked: "3 months", notes: "Forging equipment upgrade evaluation." },
  ];
  const createdLeads: any[] = [];
  for (let i = 0; i < leadsData.length; i++) {
    const ld = leadsData[i];
    const leadId = uuidv4();
    await prisma.lead.create({
      data: { id: leadId, ...ld, assignedUserId: execs[i % execs.length].id, status: "New", companyId: defaultCompany.id },
    });
    createdLeads.push({ id: leadId, name: ld.name, companyName: ld.companyName, email: ld.email, phone: ld.phone });
  }
  console.log("5 leads created.");

  // ---- Deals (5) ----
  console.log("Seeding deals...");
  const dealNames = [
    "CNC Machine Parts Supply — Tata Motors", "Hydraulic Press Maintenance Contract", "Precision Components Annual AMC",
    "Steel Fabrication Q3 Order — JSW", "Industrial Automation Pilot — Bosch",
  ];
  for (let i = 0; i < dealNames.length; i++) {
    await prisma.deal.create({
      data: {
        id: uuidv4(), dealName: dealNames[i], customerId: createdCustomers[i].id,
        assignedUserId: execs[i % execs.length].id, status: ["Qualified", "TechnicalDiscussion", "DemoConducted", "Won", "Lost"][i],
        dealValue: [7500000, 3000000, 5000000, 2000000, 4000000][i], expectedCloseDate: daysFromNow(30 + i * 15),
        companyId: defaultCompany.id,
      },
    });
  }
  console.log("5 deals created.");

  // ---- Follow-ups (5) ----
  console.log("Seeding follow-ups...");
  const fuData = [
    { customerIdx: 0, days: 2, status: "Pending", remarks: "Call to confirm demo slot." },
    { customerIdx: 1, days: -3, status: "Pending", remarks: "OVERDUE: CNC parts follow-up." },
    { customerIdx: 2, days: 5, status: "Pending", remarks: "Send revised quotation." },
    { customerIdx: 3, days: -1, status: "Completed", remarks: "DONE: Proposal accepted." },
    { customerIdx: 4, days: 7, status: "Pending", remarks: "QC system demo scheduling." },
  ];
  for (const fu of fuData) {
    const d = new Date(now); d.setDate(d.getDate() + fu.days);
    await prisma.followUp.create({
      data: { id: uuidv4(), customerId: createdCustomers[fu.customerIdx].id, assignedUserId: execs[fu.customerIdx % execs.length].id, nextMeetingDate: d, remarks: fu.remarks, status: fu.status, companyId: defaultCompany.id, updatedAt: now },
    });
  }
  console.log("5 follow-ups created.");

  // ---- Tasks (5) ----
  console.log("Seeding tasks...");
  const taskData = [
    { title: "Prepare proposal for Tata Motors AMC", status: "Pending", priority: "High", days: 2 },
    { title: "Client follow-up call — Ashok Leyland", status: "Pending", priority: "High", days: -1 },
    { title: "Update CRM data for Q2 leads", status: "Completed", priority: "Medium", days: -3 },
    { title: "Schedule demo for JSW Steel", status: "Pending", priority: "Medium", days: 5 },
    { title: "Contract review — Bosch India", status: "Overdue", priority: "High", days: -2 },
  ];
  for (let i = 0; i < taskData.length; i++) {
    const t = taskData[i];
    const d = new Date(now); d.setDate(d.getDate() + t.days);
    await prisma.task.create({
      data: { id: uuidv4(), taskCode: `TSK-${String(i + 1).padStart(4, "0")}`, title: t.title, description: t.title, status: t.status, priority: t.priority, dueDate: d, assignedTo: execs[i % execs.length].id, companyId: defaultCompany.id },
    });
  }
  console.log("5 tasks created.");

  // ---- Communication Logs (5) ----
  console.log("Seeding communication logs...");
  const commLogs = [
    { channel: "Call", direction: "Outbound", status: "Completed", content: "Initial discussion with client about project requirements.", duration: 15, outcome: "Interested" },
    { channel: "Meeting", direction: "Inbound", status: "Completed", content: "Technical evaluation meeting with procurement team.", duration: 45, outcome: "Positive" },
    { channel: "Email", direction: "Outbound", status: "Delivered", content: "Proposal sent for precision components AMC.", duration: 0, outcome: "Awaiting response" },
    { channel: "Note", direction: "Outbound", status: "Completed", content: "Client prefers email communication. Update preference.", duration: 0, outcome: "Noted" },
    { channel: "Call", direction: "Inbound", status: "Missed", content: "Missed call from client regarding quotation status.", duration: 0, outcome: "Callback needed" },
  ];
  for (let i = 0; i < commLogs.length; i++) {
    const c = commLogs[i];
    await prisma.communicationLog.create({
      data: { id: uuidv4(), customerId: createdCustomers[i % createdCustomers.length].id, sentByUserId: execs[i % execs.length].id, channel: c.channel, direction: c.direction, status: c.status, content: c.content, duration: c.duration, outcome: c.outcome, companyId: defaultCompany.id, sentAt: daysAgo(i) },
    });
  }
  console.log("5 communication logs created.");

  // ---- Notes (3) ----
  console.log("Seeding notes...");
  const notesData = [
    { entityType: "LEAD", content: "Lead came through website enquiry. Budget approved.", createdByIdx: 0 },
    { entityType: "CONTACT", content: "Prefers morning calls before 10 AM.", createdByIdx: 1 },
    { entityType: "LEAD", content: "Met at Auto Expo 2026. Strong interest in automation.", createdByIdx: 2 },
  ];
  for (let i = 0; i < notesData.length; i++) {
    const note = notesData[i];
    await prisma.note.create({
      data: { id: uuidv4(), content: note.content, createdById: execs[note.createdByIdx].id, entityType: note.entityType, entityId: note.entityType === "LEAD" ? createdLeads[i % createdLeads.length].id : createdContacts[i % createdContacts.length].id, companyId: defaultCompany.id },
    });
  }
  console.log("3 notes created.");

  // ---- Notifications (3) ----
  for (let i = 0; i < 3; i++) {
    await prisma.notification.create({
      data: { id: uuidv4(), userId: execs[i % execs.length].id, title: ["Visit reminder", "Deal update", "Task overdue"][i], message: ["Customer visit scheduled for tomorrow.", "Deal moved to Technical Discussion stage.", "Task 'Prepare proposal' is overdue."][i], type: ["visit", "deal", "task"][i], isRead: i !== 0 },
    });
  }

  // ---- Pipeline Stage Master ----
  console.log("Seeding pipeline stages...");
  const defaultStages = [
    { stageName: 'Qualified', displayName: 'Qualified', displayOrder: 1, probabilityPercent: 20, isClosedStage: false },
    { stageName: 'RequirementGathering', displayName: 'Requirement Gathering', displayOrder: 2, probabilityPercent: 35, isClosedStage: false },
    { stageName: 'TechnicalDiscussion', displayName: 'Technical Discussion', displayOrder: 3, probabilityPercent: 50, isClosedStage: false },
    { stageName: 'MeetingScheduled', displayName: 'Meeting Scheduled', displayOrder: 4, probabilityPercent: 60, isClosedStage: false },
    { stageName: 'DemoConducted', displayName: 'Demo Conducted', displayOrder: 5, probabilityPercent: 75, isClosedStage: false },
    { stageName: 'Won', displayName: 'Won', displayOrder: 6, probabilityPercent: 100, isClosedStage: true },
    { stageName: 'Rejected', displayName: 'Rejected', displayOrder: 0, probabilityPercent: 0, isClosedStage: true },
    { stageName: 'Lost', displayName: 'Lost', displayOrder: 0, probabilityPercent: 0, isClosedStage: true },
  ];
  // NOTE: stageName is globally @unique (not scoped per company), so these can only be
  // seeded once regardless of how many Company rows exist — kept on defaultCompany only.
  for (const stage of defaultStages) {
    await prisma.pipelineStageMaster.create({
      data: { stageName: stage.stageName, displayName: stage.displayName, displayOrder: stage.displayOrder, probabilityPercent: stage.probabilityPercent, isClosedStage: stage.isClosedStage, isActive: true, companyId: defaultCompany.id },
    });
  }
  console.log("Pipeline stages seeded.");

  // ---- Product Categories (6) ----
  console.log("Seeding product categories...");
  const categoriesData = [
    { name: "CNC Machined Components", description: "Precision-machined parts", defaultOverhead: 15, defaultMargin: 20 },
    { name: "Forging Components", description: "Forged parts and assemblies", defaultOverhead: 18, defaultMargin: 22 },
    { name: "Hydraulic Systems", description: "Hydraulic presses, cylinders, and parts", defaultOverhead: 12, defaultMargin: 18 },
    { name: "Steel Fabrication", description: "Custom steel fabrication", defaultOverhead: 20, defaultMargin: 25 },
    { name: "Industrial Automation", description: "Automation systems and control units", defaultOverhead: 10, defaultMargin: 15 },
    { name: "Electrical Equipment", description: "Motors, windings, and electrical components", defaultOverhead: 13, defaultMargin: 19 },
  ];
  const createdCategories: Record<string, string> = {};
  for (const cat of categoriesData) {
    const created = await prisma.productCategory.create({
      data: { name: cat.name, description: cat.description, isActive: true, defaultOverheadPercent: cat.defaultOverhead, defaultMarginPercent: cat.defaultMargin, companyId: defaultCompany.id },
    });
    createdCategories[cat.name] = created.id;
  }
  console.log("6 product categories created.");

  // ---- Products (8) ----
  console.log("Seeding products...");
  const productsData = [
    { code: "PRD-001", name: "CNC Bracket Assembly — Type A", category: "CNC Machined Components", unit: "pcs", basePrice: 450, hsn: "8473", type: "Finished" },
    { code: "PRD-005", name: "Connecting Rod Forging — EN24", category: "Forging Components", unit: "pcs", basePrice: 850, hsn: "8431", type: "Finished" },
    { code: "PRD-007", name: "Hydraulic Press Cylinder — 100 Ton", category: "Hydraulic Systems", unit: "set", basePrice: 85000, hsn: "8412", type: "Finished" },
    { code: "PRD-009", name: "Hydraulic Press Maintenance Package", category: "Hydraulic Systems", unit: "job", basePrice: 25000, hsn: "9987", type: "Service" },
    { code: "PRD-010", name: "Steel Fabrication Frame — Custom", category: "Steel Fabrication", unit: "pcs", basePrice: 15000, hsn: "7308", type: "Finished" },
    { code: "PRD-012", name: "PLC Control Panel — Siemens S7-1500", category: "Industrial Automation", unit: "set", basePrice: 125000, hsn: "8537", type: "Finished" },
    { code: "PRD-016", name: "Fuel Injector Inspection Gauge", category: "Industrial Automation", unit: "pcs", basePrice: 8500, hsn: "9031", type: "Finished" },
    { code: "PRD-018", name: "Motor Winding — 3-Phase 50HP", category: "Electrical Equipment", unit: "pcs", basePrice: 18500, hsn: "8501", type: "Finished" },
  ];
  for (const p of productsData) {
    await prisma.product.create({
      data: { productCode: p.code, name: p.name, categoryId: createdCategories[p.category] || null, unit: p.unit, basePrice: p.basePrice, hsnCode: p.hsn, productType: p.type, isActive: true, companyId: defaultCompany.id },
    });
  }
  console.log("8 products created.");

  // ---- Material Rates (4) ----
  console.log("Seeding material rates...");
  const materialRates = [
    { code: "MAT-001", name: "EN8 Steel Round Bar", unitRate: 85, unit: "kg" },
    { code: "MAT-003", name: "SS316 Stainless Steel", unitRate: 350, unit: "kg" },
    { code: "MAT-005", name: "Carbon Steel Plate IS2062", unitRate: 65, unit: "kg" },
    { code: "MAT-007", name: "Copper Wire", unitRate: 450, unit: "kg" },
  ];
  for (const mr of materialRates) {
    await prisma.materialRate.create({
      data: { materialCode: mr.code, materialName: mr.name, unitRate: mr.unitRate, unit: mr.unit, currency: "INR", validFrom: new Date("2024-01-01"), companyId: defaultCompany.id },
    });
  }
  console.log("4 material rates created.");

  // ---- Labor Rates (4) ----
  console.log("Seeding labor rates...");
  const laborRates = [
    { workCenter: "CNC-Machining", hourlyRate: 450, setupRate: 200 },
    { workCenter: "Forging-Press", hourlyRate: 380, setupRate: 150 },
    { workCenter: "Welding-Fabrication", hourlyRate: 350, setupRate: 120 },
    { workCenter: "Quality-Inspection", hourlyRate: 280, setupRate: 80 },
  ];
  for (const lr of laborRates) {
    await prisma.laborRate.create({
      data: { workCenter: lr.workCenter, hourlyRate: lr.hourlyRate, setupRate: lr.setupRate, currency: "INR", validFrom: new Date("2024-01-01"), companyId: defaultCompany.id },
    });
  }
  console.log("4 labor rates created.");

  // ---- BOM Items (4) ----
  console.log("Seeding BOM items...");
  const bomItems = [
    { productCode: "PRD-001", materialCode: "MAT-001", quantity: 2.5, scrap: 5 },
    { productCode: "PRD-005", materialCode: "MAT-001", quantity: 4.5, scrap: 8 },
    { productCode: "PRD-007", materialCode: "MAT-003", quantity: 8.5, scrap: 4 },
    { productCode: "PRD-010", materialCode: "MAT-005", quantity: 12.0, scrap: 6 },
  ];
  for (const bom of bomItems) {
    const product = await prisma.product.findFirst({ where: { productCode: bom.productCode, companyId: defaultCompany.id } });
    if (product) {
      await prisma.bOMItem.create({ data: { productId: product.id, materialCode: bom.materialCode, quantity: bom.quantity, scrapPercent: bom.scrap, companyId: defaultCompany.id } });
    }
  }
  console.log("4 BOM items created.");

  // ---- Routing Operations (6) ----
  console.log("Seeding routing operations...");
  const routingOps = [
    { productCode: "PRD-001", sequence: 1, operation: "CNC Roughing", workCenter: "CNC-Machining", cycleTime: 15, setup: 5 },
    { productCode: "PRD-001", sequence: 2, operation: "CNC Finishing", workCenter: "CNC-Machining", cycleTime: 20, setup: 8 },
    { productCode: "PRD-005", sequence: 1, operation: "Heating", workCenter: "Forging-Press", cycleTime: 8, setup: 15 },
    { productCode: "PRD-005", sequence: 2, operation: "Forging", workCenter: "Forging-Press", cycleTime: 12, setup: 20 },
    { productCode: "PRD-007", sequence: 1, operation: "Tube Cutting", workCenter: "Welding-Fabrication", cycleTime: 20, setup: 12 },
    { productCode: "PRD-007", sequence: 2, operation: "Welding", workCenter: "Welding-Fabrication", cycleTime: 35, setup: 18 },
  ];
  for (const route of routingOps) {
    const product = await prisma.product.findFirst({ where: { productCode: route.productCode, companyId: defaultCompany.id } });
    if (product) {
      await prisma.routingOperation.create({ data: { productId: product.id, sequence: route.sequence, operationName: route.operation, workCenter: route.workCenter, cycleTimeMin: route.cycleTime, setupTimeMin: route.setup, companyId: defaultCompany.id } });
    }
  }
  console.log("6 routing operations created.");

  // ---- Variant demo company sample data (Customers, Contacts, Leads, Deals, Follow-ups,
  //      Tasks, Comm Logs, Notes, Notifications, Product Catalog) ----
  await seedVariantCompanyData(prisma, demoVariant1Company, createdUsers["variant1@sukisoftware.com"], "V1", now);
  await seedVariantCompanyData(prisma, demoVariant2Company, createdUsers["variant2@sukisoftware.com"], "V2", now);
  await seedVariantCompanyData(prisma, demoVariant3Company, createdUsers["variant3@sukisoftware.com"], "V3", now);

  // ---- Service Workspace (config + teams + engineers + assets) ----
  // NOTE: ServiceRequest/CustomerAsset/ServiceTeam etc. have no companyId field in the schema —
  // this module is not company-scoped and only ever seeds against defaultCompany's customers.
  await seedServiceWorkspace(prisma);

  // ---- Service Operational Data ----
  console.log("Seeding service operational records...");

  const admin = createdUsers["admin@sukisoftware.com"];
  const createdBy = admin?.id || execs[0].id;
  const assets = await prisma.customerAsset.findMany({ select: { id: true, customerId: true, productName: true, serialNumber: true } });
  const svcCategories = await prisma.serviceCategory.findMany({ select: { id: true, name: true } });
  const priorities = await prisma.priorityLevel.findMany({ select: { id: true, name: true } });
  const svcTeams = await prisma.serviceTeam.findMany({ select: { id: true, name: true } });
  const svcEngineers = await prisma.serviceEngineer.findMany({ select: { id: true, teamId: true, userId: true } });
  const complaintTypes = await prisma.complaintType.findMany({ select: { id: true, name: true } });
  const defectTypes = await prisma.defectType.findMany({ select: { id: true, name: true } });

  // Ensure contract & warranty statuses
  const contractStatusDefs = [
    { name: "Active", color: "#10B981", order: 1, allowedTransitions: '["Expired"]' },
    { name: "Expired", color: "#EF4444", order: 2, allowedTransitions: '["Active"]' },
  ];
  const warrantyStatusDefs = [
    { name: "Under Review", color: "#F59E0B", order: 2, allowedTransitions: '["Approved", "Rejected"]' },
    { name: "Approved", color: "#10B981", order: 3, allowedTransitions: '["Resolved"]' },
    { name: "Rejected", color: "#EF4444", order: 4, allowedTransitions: '[]' },
  ];
  for (const s of contractStatusDefs) {
    if (!await prisma.serviceStatus.findFirst({ where: { name: s.name, module: "contract" } })) {
      await prisma.serviceStatus.create({ data: { ...s, module: "contract", isActive: true, allowedTransitions: s.allowedTransitions } });
    }
  }
  for (const s of warrantyStatusDefs) {
    if (!await prisma.serviceStatus.findFirst({ where: { name: s.name, module: "warranty" } })) {
      await prisma.serviceStatus.create({ data: { ...s, module: "warranty", isActive: true, allowedTransitions: s.allowedTransitions } });
    }
  }
  for (const name of ["New", "Resolved"]) {
    if (!await prisma.serviceStatus.findFirst({ where: { name, module: "warranty" } })) {
      const base = await prisma.serviceStatus.findFirst({ where: { name } });
      await prisma.serviceStatus.create({ data: { name, module: "warranty", color: base?.color || "#6B7280", order: name === "New" ? 1 : 5, allowedTransitions: base?.allowedTransitions || '[]', isActive: true } });
    }
  }

  const refreshedStatuses = await prisma.serviceStatus.findMany({ select: { id: true, name: true, module: true } });
  const statusByName = (name: string, module?: string) => module ? refreshedStatuses.find(s => s.name === name && s.module === module)?.id : refreshedStatuses.find(s => s.name === name)?.id;
  const priorityByName = (name: string) => priorities.find(p => p.name === name)?.id;
  const categoryByIndex = (i: number) => svcCategories[i % svcCategories.length].id;
  const teamByIndex = (i: number) => svcTeams[i % svcTeams.length].id;
  const engineerByIndex = (i: number) => svcEngineers[i % svcEngineers.length].id;
  const assetForCustomer = (custId: string, i: number) => {
    const custAssets = assets.filter(a => a.customerId === custId);
    return custAssets.length > 0 ? custAssets[i % custAssets.length].id : assets[i % assets.length].id;
  };

  // Service Requests (6 — 1 per status)
  console.log("  Service Requests...");
  const reqStatusCycle = ["New", "Assigned", "In Progress", "Pending Customer", "Resolved", "Closed"];
  for (let i = 0; i < 6; i++) {
    const cust = createdCustomers[i % createdCustomers.length];
    const statusName = reqStatusCycle[i];
    const statusId = statusByName(statusName);
    if (!statusId) continue;
    await prisma.serviceRequest.create({
      data: {
        title: `Service Request — ${cust.name.split(" ")[0]} #${i + 1}`,
        description: `Issue: ${["vibration detected", "pressure drop", "motor overheating", "sensor malfunction", "calibration drift", "fluid leakage"][i]}.`,
        categoryId: categoryByIndex(i), priorityId: priorityByName(["Low", "Medium", "High", "Critical", "Medium", "Low"][i])!,
        statusId, customerId: cust.id, customerAssetId: assetForCustomer(cust.id, i),
        assignedTeamId: statusName !== "New" ? teamByIndex(i) : null,
        assignedEngineerId: statusName !== "New" && statusName !== "Assigned" ? engineerByIndex(i) : null,
        createdById: createdBy, closedAt: statusName === "Closed" ? daysAgo(i) : null, createdAt: daysAgo(20 - i),
      },
    });
  }

  // Complaints (4 — 1 per status)
  console.log("  Complaints...");
  const complaintStatusMap: Record<string, string> = { "New": "New", "Investigating": "In Progress", "Resolved": "Resolved", "Closed": "Closed" };
  const complaintStatusCycle = ["New", "Investigating", "Resolved", "Closed"];
  for (let i = 0; i < 4; i++) {
    const cust = createdCustomers[i % createdCustomers.length];
    const statusName = complaintStatusCycle[i];
    const statusId = statusByName(complaintStatusMap[statusName]);
    if (!statusId) continue;
    await prisma.complaint.create({
      data: {
        title: `Complaint — ${cust.name.split(" ")[0]} #${i + 1}`,
        description: `Customer reported: ${["product not working", "leakage issue", "motor overheating", "noise/vibration"][i]}.`,
        categoryId: categoryByIndex(i), complaintTypeId: complaintTypes[i % complaintTypes.length].id,
        priorityId: priorityByName(["Medium", "High", "Critical", "Low"][i])!,
        statusId, customerId: cust.id, customerAssetId: assetForCustomer(cust.id, i),
        assignedTeamId: statusName !== "New" ? teamByIndex(i) : null,
        assignedEngineerId: statusName === "Investigating" || statusName === "Resolved" ? engineerByIndex(i) : null,
        createdById: createdBy, closedAt: statusName === "Closed" ? daysAgo(i) : null, createdAt: daysAgo(15 - i),
      },
    });
  }

  // Defects (4 — 1 per status)
  console.log("  Defects...");
  const defectStatusMap: Record<string, string> = { "New": "New", "Under Investigation": "In Progress", "Corrective Action": "Pending Customer", "Closed": "Closed" };
  const defectStatusCycle = ["New", "Under Investigation", "Corrective Action", "Closed"];
  for (let i = 0; i < 4; i++) {
    const cust = createdCustomers[(i + 1) % createdCustomers.length];
    const statusName = defectStatusCycle[i];
    const statusId = statusByName(defectStatusMap[statusName]);
    if (!statusId) continue;
    await prisma.defect.create({
      data: {
        title: `Defect — ${defectTypes[i % defectTypes.length].name} #${i + 1}`,
        description: `Defect in ${assets[i % assets.length].productName} (SN: ${assets[i % assets.length].serialNumber}).`,
        categoryId: categoryByIndex(i + 2), defectTypeId: defectTypes[i % defectTypes.length].id,
        priorityId: priorityByName(["High", "Critical", "Medium", "Low"][i])!,
        statusId, customerId: cust.id, customerAssetId: assetForCustomer(cust.id, i),
        assignedTeamId: statusName !== "New" ? teamByIndex(i + 1) : null,
        assignedEngineerId: statusName !== "New" ? engineerByIndex(i + 1) : null,
        createdById: createdBy, closedAt: statusName === "Closed" ? daysAgo(i) : null, createdAt: daysAgo(12 - i),
      },
    });
  }

  // Installations (3 — 1 per status)
  console.log("  Installations...");
  const installStatusMap: Record<string, string> = { "Scheduled": "Assigned", "In Progress": "In Progress", "Completed": "Closed" };
  const installStatusCycle = ["Scheduled", "In Progress", "Completed"];
  for (let i = 0; i < 3; i++) {
    const cust = createdCustomers[(i + 2) % createdCustomers.length];
    const statusName = installStatusCycle[i];
    const statusId = statusByName(installStatusMap[statusName]);
    if (!statusId) continue;
    await prisma.installation.create({
      data: {
        title: `Installation — ${cust.name.split(" ")[0]} #${i + 1}`,
        description: `New equipment installation at ${cust.name}.`,
        categoryId: categoryByIndex(i + 3), priorityId: priorityByName(["Medium", "High", "Low"][i])!,
        statusId, customerId: cust.id, customerAssetId: assetForCustomer(cust.id, i),
        assignedTeamId: teamByIndex(i + 2), assignedEngineerId: engineerByIndex(i + 2),
        createdById: createdBy, closedAt: statusName === "Completed" ? daysAgo(i) : null, createdAt: daysAgo(10 - i),
      },
    });
  }

  // Warranty Claims (5 — covering all statuses)
  console.log("  Warranty Claims...");
  const warrantyStatusNames = ["New", "Under Review", "Approved", "Resolved", "Rejected"];
  for (let i = 0; i < 5; i++) {
    const cust = createdCustomers[(i + 3) % createdCustomers.length];
    const statusId = statusByName(warrantyStatusNames[i], "warranty");
    if (!statusId) continue;
    const asset = assets.filter(a => a.customerId === cust.id)[0] || assets[i];
    await prisma.warrantyClaim.create({
      data: {
        title: `Warranty Claim — ${cust.name.split(" ")[0]} #${i + 1}`,
        description: `Issue: ${["motor failure", "sensor drift", "hydraulic leak", "electrical fault", "mechanical wear"][i]}.`,
        customerId: cust.id, customerAssetId: asset.id, statusId, claimDate: daysAgo(8 - i),
        resolution: i >= 3 ? `Resolved: ${["part replaced", "repaired on-site", "claim rejected — out of warranty"][i - 3]}` : null,
        createdById: createdBy,
      },
    });
  }

  // AMC Contracts (4 — 2 Active, 2 Expired)
  console.log("  AMC Contracts...");
  for (let i = 0; i < 4; i++) {
    const cust = createdCustomers[(i + 1) % createdCustomers.length];
    const asset = assets.filter(a => a.customerId === cust.id)[0] || assets[i];
    const isActive = i % 2 === 0;
    const statusId = statusByName(isActive ? "Active" : "Expired", "contract");
    if (!statusId) continue;
    await prisma.aMCContract.create({
      data: {
        contractNumber: `AMC-2026-${String(i + 1).padStart(4, "0")}`,
        customerId: cust.id, customerAssetId: asset.id, statusId,
        startDate: daysAgo(isActive ? 180 - i * 30 : 400 + i * 30),
        endDate: isActive ? daysFromNow(180 - i * 30) : daysAgo(40 + i * 20),
        renewalStatus: isActive ? "Active" : "Lapsed",
        createdById: createdBy,
      },
    });
  }

  // Service Visits (6 — 2 Scheduled, 2 Completed, 2 Overdue)
  console.log("  Service Visits...");
  const visitConfig = [
    { statusName: "Assigned", label: "Scheduled", offset: 3 },
    { statusName: "Assigned", label: "Scheduled", offset: 5 },
    { statusName: "Closed", label: "Completed", offset: -1 },
    { statusName: "Closed", label: "Completed", offset: -3 },
    { statusName: "Assigned", label: "Overdue", offset: -2 },
    { statusName: "Assigned", label: "Overdue", offset: -5 },
  ];
  for (let i = 0; i < 6; i++) {
    const vc = visitConfig[i];
    const statusId = statusByName(vc.statusName);
    if (!statusId) continue;
    const isCompleted = vc.label === "Completed";
    const cust = createdCustomers[i % createdCustomers.length];
    const eng = svcEngineers[i % svcEngineers.length];
    await prisma.serviceVisit.create({
      data: {
        title: `Service Visit #${i + 1}`,
        notes: `Visit for ${["preventive maintenance", "breakdown repair", "calibration check", "installation support", "warranty inspection", "AMC health check"][i]}.`,
        statusId, engineerId: eng.id,
        scheduledDate: vc.offset > 0 ? daysFromNow(vc.offset) : daysAgo(Math.abs(vc.offset)),
        checkInTime: isCompleted ? daysAgo(Math.abs(vc.offset)) : null,
        checkOutTime: isCompleted ? daysAgo(Math.abs(vc.offset)) : null,
        customerId: cust.id,
        customerAssetId: assetForCustomer(cust.id, i),
        outcomeNotes: isCompleted ? `Completed: ${["part replaced", "calibration done"][i % 2]}` : null,
        completedAt: isCompleted ? daysAgo(Math.abs(vc.offset)) : null,
        createdById: createdBy,
      },
    });
  }

  // ── Verification ──
  console.log("\n📊 Verification...\n");
  const counts = {
    users: await prisma.user.count(),
    customers: await prisma.customer.count(),
    leads: await prisma.lead.count(),
    deals: await prisma.deal.count(),
    contacts: await prisma.contact.count(),
    products: await prisma.product.count(),
    productCategories: await prisma.productCategory.count(),
    customerAssets: await prisma.customerAsset.count(),
    serviceEngineers: await prisma.serviceEngineer.count(),
    serviceRequests: await prisma.serviceRequest.count(),
    complaints: await prisma.complaint.count(),
    defects: await prisma.defect.count(),
    installations: await prisma.installation.count(),
    warrantyClaims: await prisma.warrantyClaim.count(),
    amcContracts: await prisma.aMCContract.count(),
    serviceVisits: await prisma.serviceVisit.count(),
  };
  console.table(counts);
  console.log("\nDatabase seeded successfully! All models populated. ✓");
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
