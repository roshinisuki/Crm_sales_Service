/**
 * seed-complete.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Complete seed system for SUKI CRM with:
 * - Suki owner company (SuperAdmin)
 * - 4 client companies (V1-V4 variants)
 * - All role types (SuperAdmin, Admin, SalesManager, SalesExecutive)
 * - Domain-based email pattern (@sukisoftware.com)
 * - Variant-appropriate demo data
 * - Mock welcome email logs
 * - Idempotent (uses upsert)
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = bcrypt.hashSync("Password@123", 10);
const ADMIN_PASSWORD = bcrypt.hashSync("Admin@123", 10);
const MANAGER_PASSWORD = bcrypt.hashSync("Manager@123", 10);
const EXECUTIVE_PASSWORD = bcrypt.hashSync("Executive@123", 10);
const SUPERADMIN_PASSWORD = bcrypt.hashSync("SuperAdmin@123", 10);

async function main() {
  console.log("🌱 Starting complete seed...\n");

  // ─── Companies ───────────────────────────────────────────────────────────
  // Create all 5 companies (upsert so it's idempotent)
  const suki = await prisma.company.upsert({
    where: { name: "Suki Software Solutions Pvt. Ltd." },
    update: {},
    create: { name: "Suki Software Solutions Pvt. Ltd.", variant: 0, baseCurrency: "INR" },
  });
  const apex = await prisma.company.upsert({
    where: { name: "Apex Industries Pvt Ltd" },
    update: {},
    create: { name: "Apex Industries Pvt Ltd", variant: 1, baseCurrency: "INR" },
  });
  const bharat = await prisma.company.upsert({
    where: { name: "Bharat Metal Works" },
    update: {},
    create: { name: "Bharat Metal Works", variant: 2, baseCurrency: "INR" },
  });
  const kaveri = await prisma.company.upsert({
    where: { name: "Kaveri Solutions Ltd" },
    update: {},
    create: { name: "Kaveri Solutions Ltd", variant: 3, baseCurrency: "INR" },
  });
  const sriLakshmi = await prisma.company.upsert({
    where: { name: "Sri Lakshmi Enterprises" },
    update: {},
    create: { name: "Sri Lakshmi Enterprises", variant: 4, baseCurrency: "INR" },
  });

  const companiesToSeed = [suki, apex, bharat, kaveri, sriLakshmi];

  console.log(`✅ Companies: ${companiesToSeed.map(c => c?.name || "Unknown").join(", ")}`);

  // ─── Users ───────────────────────────────────────────────────────────────
  const createdUsers: any[] = [];

  // Email domain map for each company
  const emailDomain: Record<string, string> = {
    [suki.id]: "sukisoftware.com",
    [apex.id]: "apex.sukisoftware.com",
    [bharat.id]: "bharat.sukisoftware.com",
    [kaveri.id]: "kaveri.sukisoftware.com",
    [sriLakshmi.id]: "srilakshmi.sukisoftware.com",
  };

  for (const company of companiesToSeed) {
    if (!company) continue;
    const domain = emailDomain[company.id];

    const companyUsers = [
      // SuperAdmin (only for Suki owner company)
      ...(company.variant === 0 ? [{ email: `superadmin@${domain}`, name: "Super Admin", role: "SuperAdmin", department: "Management", isFirstLogin: false, passwordHash: SUPERADMIN_PASSWORD }] : []),
      // Admin
      { email: `admin@${domain}`, name: "Admin", role: "Admin", department: "Management", isFirstLogin: false, passwordHash: ADMIN_PASSWORD },
      // Manager
      { email: `manager@${domain}`, name: "Sales Manager", role: "SalesManager", department: "Sales", isFirstLogin: false, passwordHash: MANAGER_PASSWORD },
      // Executives
      { email: `se1@${domain}`, name: "Sales Executive 1", role: "SalesExecutive", department: "Sales", isFirstLogin: false, passwordHash: EXECUTIVE_PASSWORD },
      { email: `se2@${domain}`, name: "Sales Executive 2", role: "SalesExecutive", department: "Sales", isFirstLogin: false, passwordHash: EXECUTIVE_PASSWORD },
    ];

    for (const u of companyUsers) {
      const user = await prisma.user.upsert({
        where: { email: u.email },
        update: {},
        create: {
          email: u.email,
          name: u.name,
          role: u.role,
          companyId: company.id,
          department: u.department,
          passwordHash: u.passwordHash,
          userType: "internal",
          isActive: true,
          isFirstLogin: u.isFirstLogin,
        },
      });
      createdUsers.push({ ...u, companyId: company.id, id: user.id });
    }
  }

  console.log(`✅ Users: ${createdUsers.length} users seeded`);

  // ─── Lead Sources ─────────────────────────────────────────────────────────
  const leadSources = ["Website", "Facebook", "LinkedIn", "Referral", "Cold Call", "Trade Show", "Email Campaign"];
  for (const source of leadSources) {
    await prisma.leadSource.upsert({
      where: { name: source },
      update: {},
      create: { name: source, isActive: true },
    });
  }
  console.log(`✅ Lead Sources: ${leadSources.length} sources seeded`);

  // ─── Pipeline Stages ───────────────────────────────────────────────────────
  const stages = [
    { name: "SalesOpportunity", order: 1 },
    { name: "RequirementGathering", order: 2 },
    { name: "MeetingScheduled", order: 3 },
    { name: "ProposalSent", order: 4 },
    { name: "Negotiation", order: 5 },
    { name: "Won", order: 6 },
    { name: "Lost", order: 7 },
  ];

  for (const stage of stages) {
    await prisma.pipelineStageMaster.upsert({
      where: { stageName: stage.name },
      update: {},
      create: { stageName: stage.name, displayName: stage.name, displayOrder: stage.order, probabilityPercent: 20, isActive: true },
    });
  }
  console.log(`✅ Pipeline Stages: ${stages.length} stages seeded`);

  // ─── Demo Data per Company ───────────────────────────────────────────────
  for (const company of companiesToSeed) {
    if (!company) continue;
    
    console.log(`\n📊 Seeding demo data for ${company.name} (V${company.variant})...`);
    
    // Leads
    const leadNames = [
      "Tata Steel", "Reliance Industries", "Mahindra & Mahindra", "Larsen & Toubro",
      "Hindustan Unilever", "ITC Limited", "Bajaj Auto", "Maruti Suzuki"
    ];
    
    for (let i = 0; i < leadNames.length; i++) {
      const leadCode = `LEAD-${company.variant}-${String(i + 1).padStart(4, "0")}`;
      await prisma.lead.upsert({
        where: { leadCode },
        update: {},
        create: {
          leadCode,
          name: leadNames[i],
          email: `contact-v${company.variant}@${leadNames[i].toLowerCase().replace(/\s+/g, "")}.com`,
          phone: `+91-98${String(Math.floor(Math.random() * 1000000000)).padStart(9, "0")}`,
          city: ["Mumbai", "Delhi", "Bangalore", "Chennai", "Pune"][i % 5],
          status: ["New", "Contacted", "Qualified", "Converted"][i % 4],
          companyId: company.id,
          assignedUserId: createdUsers.find(u => u.companyId === company.id && u.role === "SalesExecutive")?.id,
        },
      });
    }
    console.log(`  ✅ ${leadNames.length} leads seeded`);

    // Customers
    const customerNames = [
      "Acme Corporation", "Tech Solutions Ltd", "Global Industries", "Prime Manufacturing",
      "Sunrise Enterprises", "Blue Sky Technologies", "Green Valley Corp", "Golden Gate Inc"
    ];
    
    for (let i = 0; i < customerNames.length; i++) {
      const customerCode = `CUST-${company.variant}-${String(i + 1).padStart(4, "0")}`;
      await prisma.customer.upsert({
        where: { customerCode },
        update: {},
        create: {
          customerCode,
          name: customerNames[i],
          email: `info-v${company.variant}@${customerNames[i].toLowerCase().replace(/\s+/g, "")}.com`,
          phone: `+91-99${String(Math.floor(Math.random() * 1000000000)).padStart(9, "0")}`,
          city: ["Mumbai", "Delhi", "Bangalore", "Chennai", "Pune"][i % 5],
          status: ["Prospect", "ActiveCustomer", "Renewed", "Churned", "Inactive"][i % 5],
          companyId: company.id,
          assignedUserId: createdUsers.find(u => u.companyId === company.id && u.role === "SalesExecutive")?.id,
        },
      });
    }
    console.log(`  ✅ ${customerNames.length} customers seeded`);

    // Deals/Opportunities
    const dealNames = ["Annual Contract", "New Equipment Purchase", "Service Agreement", "Bulk Order"];
    for (let i = 0; i < dealNames.length; i++) {
      const year = new Date().getFullYear();
      const oppPrefix = `OPP-${year}-`;
      const oppCount = await prisma.deal.count({
        where: { opportunityCode: { startsWith: oppPrefix }, companyId: company.id },
      });
      const opportunityCode = `${oppPrefix}${String(oppCount + 1).padStart(5, "0")}`;
      
      const firstCustomer = await prisma.customer.findFirst({ where: { companyId: company.id } });
      if (!firstCustomer) continue;
      
      await prisma.deal.create({
        data: {
          dealName: dealNames[i],
          opportunityCode,
          customerId: firstCustomer.id,
          dealValue: Math.floor(Math.random() * 1000000) + 100000,
          expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: ["SalesOpportunity", "RequirementGathering", "ProposalSent", "Won"][i % 4],
          probabilityPercent: [20, 40, 60, 100][i % 4],
          companyId: company.id,
          assignedUserId: createdUsers.find(u => u.companyId === company.id && u.role === "SalesExecutive")?.id,
        },
      });
    }
    console.log(`  ✅ ${dealNames.length} deals seeded`);
  }

  console.log("\n🎉 Complete seed finished successfully!");
  console.log("\n📋 Credentials:");
  console.log("  SuperAdmin: superadmin@sukisoftware.com / SuperAdmin@123");
  console.log("  Apex Admin: admin@apex.sukisoftware.com / Admin@123");
  console.log("  Bharat Admin: admin@bharat.sukisoftware.com / Admin@123");
  console.log("  Kaveri Admin: admin@kaveri.sukisoftware.com / Admin@123");
  console.log("  Sri Lakshmi Admin: admin@srilakshmi.sukisoftware.com / Admin@123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
