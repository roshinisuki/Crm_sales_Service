/**
 * SUKI CRM — Seed Data Script V4
 * Enterprise: Loss Reasons, Competitors, Lost Deal Analysis, Territories, Sales Targets, Key Accounts
 *
 * Run: npx ts-node prisma/seed-v4.ts
 * Prerequisite: seed-v1.ts, seed-v2.ts, and seed-v3.ts must be run first
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting V4 seed...\n");

  const apex = await prisma.company.findUnique({ where: { name: "Apex Industries" } });
  if (!apex) throw new Error("Run seed-v1.ts first — Apex Industries not found");

  const exec1 = await prisma.user.findUnique({ where: { email: "exec1@apexindustries.com" } });
  const exec2 = await prisma.user.findUnique({ where: { email: "exec2@apexindustries.com" } });
  const mgrApex = await prisma.user.findUnique({ where: { email: "manager@apexindustries.com" } });
  if (!exec1 || !exec2 || !mgrApex) throw new Error("Users not found — run seed-v1.ts first");

  const customers = await prisma.customer.findMany({ where: { companyId: apex.id } });
  const cust = (code: string) => customers.find((c) => c.customerCode === code);

  const deals = await prisma.deal.findMany({ where: { companyId: apex.id } });

  // ─── Loss Reasons (7) ────────────────────────────────────────────────────
  const lossReasonsData = [
    { name: "Price Too High", isActive: true, companyId: apex.id },
    { name: "Competitor Won", isActive: true, companyId: apex.id },
    { name: "Product Not Suitable", isActive: true, companyId: apex.id },
    { name: "Delivery Timeline Too Long", isActive: true, companyId: apex.id },
    { name: "Customer Budget Constraints", isActive: true, companyId: apex.id },
    { name: "Lost to In-house Solution", isActive: true, companyId: apex.id },
    { name: "Quality Concerns", isActive: true, companyId: apex.id },
  ];

  const lrMap: Record<string, string> = {};
  for (const lr of lossReasonsData) {
    try {
      const reason = await prisma.lossReason.create({ data: lr });
      lrMap[lr.name] = reason.id;
    } catch (e: any) {
      console.log(`⚠️  LossReason "${lr.name}" skipped: ${e.message?.slice(0, 80)}`);
    }
  }
  console.log(`✅ Loss Reasons: ${lossReasonsData.length}`);

  // ─── Competitors (3) with products ───────────────────────────────────────
  const competitorsData = [
    { name: "FlowTech Industries", website: "https://flowtech.com", description: "Leading manufacturer of industrial valves and fittings", strengths: "Wide product range, competitive pricing", weaknesses: "Slower delivery times, limited custom options", isActive: true, companyId: apex.id },
    { name: "ConveyMaster Systems", website: "https://conveymaster.in", description: "Specialist in conveyor and material handling systems", strengths: "Strong technical expertise, fast installation", weaknesses: "Higher price point, limited after-sales support", isActive: true, companyId: apex.id },
    { name: "PowerPanel Solutions", website: "https://powerpanel.co.in", description: "Electrical panel and switchgear manufacturer", strengths: "Certified quality, good brand reputation", weaknesses: "Small product range, long lead times", isActive: true, companyId: apex.id },
  ];

  const compMap: Record<string, string> = {};
  for (const c of competitorsData) {
    try {
      const comp = await prisma.competitor.create({ data: c });
      compMap[c.name] = comp.id;
    } catch (e: any) {
      console.log(`⚠️  Competitor "${c.name}" skipped: ${e.message?.slice(0, 80)}`);
    }
  }

  // Competitor products
  const compProductsData = [
    { competitorId: compMap["FlowTech Industries"], name: "FT-BallValve-2inch", description: "2 inch ball valve — SS304", priceRange: "₹3,800 - ₹4,200", ourAdvantage: "SS316 material vs their SS304, better corrosion resistance" },
    { competitorId: compMap["FlowTech Industries"], name: "FT-GateValve-4inch", description: "4 inch gate valve — cast iron", priceRange: "₹7,500 - ₹8,000", ourAdvantage: "Same spec but we offer faster delivery (2 weeks vs 4)" },
    { competitorId: compMap["ConveyMaster Systems"], name: "CM-BeltConv-10m", description: "10m belt conveyor — heavy duty", priceRange: "₹2,60,000 - ₹2,80,000", ourAdvantage: "Better motor (5.5kW vs their 4kW), longer belt life" },
    { competitorId: compMap["PowerPanel Solutions"], name: "PP-MCC-400A", description: "MCC panel 400A with IP54", priceRange: "₹1,70,000 - ₹1,90,000", ourAdvantage: "Copper bus bars standard (theirs uses aluminium upgrade)" },
  ];

  for (const cp of compProductsData) {
    try {
      await prisma.competitorProduct.create({ data: cp });
    } catch (e: any) {
      console.log(`⚠️  CompetitorProduct skipped: ${e.message?.slice(0, 80)}`);
    }
  }
  console.log(`✅ Competitors: ${competitorsData.length}, Products: ${compProductsData.length}`);

  // ─── Lost Deal Analysis ──────────────────────────────────────────────────
  const lostDeal = deals.find((d) => d.status === "Lost");
  if (lostDeal) {
    try {
      await prisma.lostDealAnalysis.create({
        data: {
          dealId: lostDeal.id,
          competitorId: compMap["FlowTech Industries"],
          lossReasonId: lrMap["Price Too High"],
          competitorWonPrice: 187000,
          ourFinalPrice: 220000,
          lessonsLearned: "Need to review pricing strategy for polymer valves. Consider volume-based discount tiers.",
          recordedById: exec1.id,
          companyId: apex.id,
        },
      });
      console.log(`✅ Lost Deal Analysis: 1 (for deal "${lostDeal.dealName}")`);
    } catch (e: any) {
      console.log(`⚠️  LostDealAnalysis skipped: ${e.message?.slice(0, 80)}`);
    }
  }

  // ─── Territories (2) ─────────────────────────────────────────────────────
  const territoriesData = [
    { name: "South India", region: "South", states: "Karnataka, Tamil Nadu, Kerala, Andhra Pradesh, Telangana", assignedUserId: exec1.id, isActive: true, companyId: apex.id },
    { name: "West & North India", region: "West-North", states: "Maharashtra, Gujarat, Rajasthan, Delhi, Madhya Pradesh", assignedUserId: exec2.id, isActive: true, companyId: apex.id },
  ];

  const terrMap: Record<string, string> = {};
  for (const t of territoriesData) {
    try {
      const terr = await prisma.territory.create({ data: t });
      terrMap[t.name] = terr.id;
    } catch (e: any) {
      console.log(`⚠️  Territory "${t.name}" skipped: ${e.message?.slice(0, 80)}`);
    }
  }

  // Territory accounts — assign some customers to territories
  const terrAccountsData = [
    { territoryId: terrMap["South India"], customerId: cust("CUST-0001")?.id },
    { territoryId: terrMap["South India"], customerId: cust("CUST-0003")?.id },
    { territoryId: terrMap["South India"], customerId: cust("CUST-0004")?.id },
    { territoryId: terrMap["West & North India"], customerId: cust("CUST-0002")?.id },
    { territoryId: terrMap["West & North India"], customerId: cust("CUST-0005")?.id },
    { territoryId: terrMap["West & North India"], customerId: cust("CUST-0006")?.id },
    { territoryId: terrMap["West & North India"], customerId: cust("CUST-0007")?.id },
  ];

  for (const ta of terrAccountsData) {
    try {
      if (ta.customerId) await prisma.territoryAccount.create({ data: { territoryId: ta.territoryId, customerId: ta.customerId } });
    } catch (e: any) {
      console.log(`⚠️  TerritoryAccount skipped: ${e.message?.slice(0, 80)}`);
    }
  }
  console.log(`✅ Territories: ${territoriesData.length}, Accounts: ${terrAccountsData.length}`);

  // ─── Sales Targets (15) ──────────────────────────────────────────────────
  const targetsData = [
    // Monthly targets — current month (June 2026)
    { targetType: "Monthly", period: "2026-06", targetAmount: 500000, achievedAmount: 213750, assignedUserId: exec1.id, territoryId: terrMap["South India"], notes: "June monthly target — South India", companyId: apex.id },
    { targetType: "Monthly", period: "2026-06", targetAmount: 450000, achievedAmount: 391500, assignedUserId: exec2.id, territoryId: terrMap["West & North India"], notes: "June monthly target — West & North", companyId: apex.id },
    { targetType: "Monthly", period: "2026-06", targetAmount: 1000000, achievedAmount: 605250, assignedUserId: mgrApex.id, notes: "June team target — overall", companyId: apex.id },
    // Monthly targets — last month (May 2026)
    { targetType: "Monthly", period: "2026-05", targetAmount: 480000, achievedAmount: 520000, assignedUserId: exec1.id, territoryId: terrMap["South India"], notes: "May monthly target — exceeded", companyId: apex.id },
    { targetType: "Monthly", period: "2026-05", targetAmount: 420000, achievedAmount: 380000, assignedUserId: exec2.id, territoryId: terrMap["West & North India"], notes: "May monthly target — behind", companyId: apex.id },
    // Quarterly targets — Q2 2026
    { targetType: "Quarterly", period: "2026-Q2", targetAmount: 1500000, achievedAmount: 818750, assignedUserId: exec1.id, territoryId: terrMap["South India"], notes: "Q2 quarterly target — South India", companyId: apex.id },
    { targetType: "Quarterly", period: "2026-Q2", targetAmount: 1350000, achievedAmount: 771500, assignedUserId: exec2.id, territoryId: terrMap["West & North India"], notes: "Q2 quarterly target — West & North", companyId: apex.id },
    { targetType: "Quarterly", period: "2026-Q2", targetAmount: 3000000, achievedAmount: 1590250, assignedUserId: mgrApex.id, notes: "Q2 team target — overall", companyId: apex.id },
    // Quarterly targets — Q1 2026
    { targetType: "Quarterly", period: "2026-Q1", targetAmount: 1400000, achievedAmount: 1250000, assignedUserId: exec1.id, territoryId: terrMap["South India"], notes: "Q1 quarterly — achieved", companyId: apex.id },
    { targetType: "Quarterly", period: "2026-Q1", targetAmount: 1200000, achievedAmount: 1100000, assignedUserId: exec2.id, territoryId: terrMap["West & North India"], notes: "Q1 quarterly — close to target", companyId: apex.id },
    // Yearly targets — 2026
    { targetType: "Yearly", period: "2026", targetAmount: 6000000, achievedAmount: 2068750, assignedUserId: exec1.id, territoryId: terrMap["South India"], notes: "2026 yearly target — South India", companyId: apex.id },
    { targetType: "Yearly", period: "2026", targetAmount: 5400000, achievedAmount: 1871500, assignedUserId: exec2.id, territoryId: terrMap["West & North India"], notes: "2026 yearly target — West & North", companyId: apex.id },
    { targetType: "Yearly", period: "2026", targetAmount: 12000000, achievedAmount: 3940250, assignedUserId: mgrApex.id, notes: "2026 team yearly target — overall", companyId: apex.id },
    // Yearly targets — 2025 (completed year)
    { targetType: "Yearly", period: "2025", targetAmount: 5000000, achievedAmount: 4800000, assignedUserId: exec1.id, notes: "2025 yearly — near achieved", companyId: apex.id },
    { targetType: "Yearly", period: "2025", targetAmount: 4500000, achievedAmount: 5200000, assignedUserId: exec2.id, notes: "2025 yearly — exceeded", companyId: apex.id },
  ];

  for (const t of targetsData) {
    try {
      await prisma.salesTarget.create({ data: t });
    } catch (e: any) {
      console.log(`⚠️  SalesTarget skipped: ${e.message?.slice(0, 80)}`);
    }
  }
  console.log(`✅ Sales Targets: ${targetsData.length}`);

  // ─── Key Accounts (4) ────────────────────────────────────────────────────
  const keyAccountsData = [
    { customerId: cust("CUST-0001")?.id, accountManagerId: exec1.id, revenuePotential: 5000000, strategicImportance: "Critical", relationshipStatus: "Strong", nextReviewDate: new Date("2026-07-15"), notes: "Top revenue customer — Q2 automation project pipeline", companyId: apex.id },
    { customerId: cust("CUST-0005")?.id, accountManagerId: exec1.id, revenuePotential: 8000000, strategicImportance: "Critical", relationshipStatus: "Strong", nextReviewDate: new Date("2026-07-01"), notes: "Annual supply contract — renewal in progress", companyId: apex.id },
    { customerId: cust("CUST-0004")?.id, accountManagerId: exec2.id, revenuePotential: 3500000, strategicImportance: "High", relationshipStatus: "Growing", nextReviewDate: new Date("2026-07-20"), notes: "Expanding relationship — conveyor system upgrade", companyId: apex.id },
    { customerId: cust("CUST-0002")?.id, accountManagerId: exec2.id, revenuePotential: 2500000, strategicImportance: "High", relationshipStatus: "Developing", nextReviewDate: new Date("2026-07-10"), notes: "Green energy sector — high growth potential", companyId: apex.id },
  ];

  for (const ka of keyAccountsData) {
    try {
      if (ka.customerId) await prisma.keyAccount.create({ data: ka as any });
    } catch (e: any) {
      console.log(`⚠️  KeyAccount skipped: ${e.message?.slice(0, 80)}`);
    }
  }
  console.log(`✅ Key Accounts: ${keyAccountsData.length}`);

  console.log("\n🎉 V4 seed complete!");
  console.log("\n📋 All 4 seed scripts done. You can now log in with any of the test accounts.");
  console.log("   ⚠️  PO-0005 has an intentionally failed ERP sync — use it to test the retry button.");
  console.log("   ⚠️  Log in as Company A user and verify you cannot see Company B (Bharat Metal Works) data.");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
