/**
 * SUKI CRM — V4 Demo Seed for Suki Software Solutions Pvt. Ltd.
 * (admin@sukisoftware.com tenant)
 *
 * Run: npx ts-node prisma/seed-v4-sukisoftware.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting V4 seed for Suki Software Solutions...\n");

  const company = await prisma.company.findUnique({
    where: { id: "a3950d24-49b7-485b-ac19-2e186ebde41a" }
  });
  if (!company) throw new Error("Company not found.");
  console.log(`✅ Company: ${company.name} (Variant ${company.variant})`);

  const companyId = company.id;

  const users = await prisma.user.findMany({
    where: { companyId },
    select: { id: true, name: true, email: true, role: true }
  });

  const salesManager = users.find(u => u.role === "SalesManager");
  const salesExecs = users.filter(u => u.role === "SalesExecutive");

  if (!salesManager || salesExecs.length < 1) {
    throw new Error("Required users not found.");
  }
  console.log(`✅ Users: ${users.length}`);

  // ─── Extra Customers (to make 16 total) ──────────────────────────────────
  const extraCustomers = [
    { customerCode: "SUKI-0011", name: "Chennai Petrochemicals Ltd", email: "procurement@chennaipetro-suki.com", phone: "+91-44-2543-5678", city: "Chennai", status: "Active", companyId },
    { customerCode: "SUKI-0012", name: "Coimbatore Textiles Pvt Ltd", email: "purchase@coimbatoretextiles-suki.com", phone: "+91-422-2345-678", city: "Coimbatore", status: "Active", companyId },
    { customerCode: "SUKI-0013", name: "Hyderabad Pharmaceuticals", email: "procurement@hyderabadpharma-suki.com", phone: "+91-40-2345-6789", city: "Hyderabad", status: "Active", companyId },
    { customerCode: "SUKI-0014", name: "Delhi Energy Systems", email: "energy@delhisystems-suki.com", phone: "+91-11-2345-6789", city: "Delhi", status: "Active", companyId },
    { customerCode: "SUKI-0015", name: "Kolkata Engineering Works", email: "purchase@kolkataeng-suki.com", phone: "+91-33-2345-6789", city: "Kolkata", status: "Active", companyId },
    { customerCode: "SUKI-0016", name: "Ahmedabad Chemical Industries", email: "procurement@ahmedabadchem-suki.com", phone: "+91-79-2345-6789", city: "Ahmedabad", status: "Active", companyId },
  ];

  for (const c of extraCustomers) {
    try {
      const existing = await prisma.customer.findFirst({ where: { companyId, customerCode: c.customerCode } });
      if (!existing) await prisma.customer.create({ data: c });
    } catch (e: any) {
      console.log(`⚠️  Customer "${c.customerCode}" skipped: ${e.message?.slice(0, 80)}`);
    }
  }

  const customers = await prisma.customer.findMany({ where: { companyId }, select: { id: true, customerCode: true } });
  console.log(`✅ Customers: ${customers.length}`);

  // ─── Extra Deals ──────────────────────────────────────────────────────────
  const extraDeals = [
    { dealName: "Petrochem-Deal-1", customerId: customers.find(c => c.customerCode === "SUKI-0011")?.id, dealValue: 450000, expectedCloseDate: new Date("2026-09-30"), status: "Active", companyId },
    { dealName: "Textiles-Deal-1", customerId: customers.find(c => c.customerCode === "SUKI-0012")?.id, dealValue: 320000, expectedCloseDate: new Date("2026-10-15"), status: "Won", companyId },
    { dealName: "Pharma-Deal-1", customerId: customers.find(c => c.customerCode === "SUKI-0013")?.id, dealValue: 780000, expectedCloseDate: new Date("2026-08-31"), status: "Lost", companyId },
    { dealName: "Energy-Deal-1", customerId: customers.find(c => c.customerCode === "SUKI-0014")?.id, dealValue: 550000, expectedCloseDate: new Date("2026-09-15"), status: "Active", companyId },
    { dealName: "Engineering-Deal-1", customerId: customers.find(c => c.customerCode === "SUKI-0015")?.id, dealValue: 890000, expectedCloseDate: new Date("2026-10-31"), status: "Lost", companyId },
    { dealName: "Chemical-Deal-1", customerId: customers.find(c => c.customerCode === "SUKI-0016")?.id, dealValue: 620000, expectedCloseDate: new Date("2026-09-20"), status: "On Hold", companyId },
  ];

  for (const d of extraDeals) {
    try {
      if (!d.customerId) continue;
      await prisma.deal.create({ data: d as any });
    } catch (e: any) {
      console.log(`⚠️  Deal "${d.dealName}" skipped: ${e.message?.slice(0, 80)}`);
    }
  }

  // Mark some existing deals as Lost for lost deal analysis
  const allDeals = await prisma.deal.findMany({ where: { companyId }, select: { id: true, dealName: true, status: true, dealValue: true } });
  const hasLost = allDeals.some(d => d.status === 'Lost');
  if (!hasLost && allDeals.length >= 2) {
    await prisma.deal.update({ where: { id: allDeals[0].id }, data: { status: 'Lost' } });
    await prisma.deal.update({ where: { id: allDeals[1].id }, data: { status: 'Lost' } });
  }
  const deals = await prisma.deal.findMany({ where: { companyId }, select: { id: true, dealName: true, status: true, dealValue: true } });
  console.log(`✅ Deals: ${deals.length}`);

  // ─── Loss Reasons ─────────────────────────────────────────────────────────
  const lossReasonsData = [
    "Price Too High", "Competitor Relationship Stronger", "Missing Feature",
    "Delayed Response", "No Decision", "Budget Issue",
    "Technical Mismatch", "Existing Vendor Retained", "Quality Concerns"
  ];

  const lrMap: Record<string, string> = {};
  for (const name of lossReasonsData) {
    try {
      const existing = await prisma.lossReason.findFirst({ where: { companyId, name } });
      if (existing) { lrMap[name] = existing.id; }
      else { const r = await prisma.lossReason.create({ data: { name, isActive: true, companyId } }); lrMap[name] = r.id; }
    } catch (e: any) { console.log(`⚠️  LossReason "${name}" skipped`); }
  }
  console.log(`✅ Loss Reasons: ${Object.keys(lrMap).length}`);

  // ─── Competitors ──────────────────────────────────────────────────────────
  const competitorsData = [
    { name: "Bharat Valves Ltd", website: "https://bharatvalves.com", description: "Industrial valve manufacturer in South India", strengths: "Wide distribution, competitive pricing", weaknesses: "Limited range, slow R&D", isActive: true, companyId },
    { name: "TechFlow Systems", website: "https://techflow.in", description: "Fluid control and automation systems", strengths: "Strong technical expertise, custom solutions", weaknesses: "Higher price, limited brand", isActive: true, companyId },
    { name: "Southern Conveyors", website: "https://southernconveyors.co.in", description: "Material handling manufacturer", strengths: "Fast delivery, good quality", weaknesses: "Limited customization", isActive: true, companyId },
    { name: "PowerMax Electricals", website: "https://powermaxelectricals.com", description: "Electrical panels and switchgear", strengths: "Certified products, good reputation", weaknesses: "Long lead times", isActive: true, companyId },
    { name: "Precision Pumps India", website: "https://precisionpumps.in", description: "Industrial pumps and systems", strengths: "Energy efficient, good warranty", weaknesses: "Higher cost, limited network", isActive: true, companyId },
    { name: "Metro Machinery", website: "https://metromachinery.com", description: "Heavy machinery supplier", strengths: "Wide range, financing options", weaknesses: "Older technology", isActive: true, companyId },
    { name: "Apex Automation", website: "https://apexautomation.co.in", description: "Industrial automation and control", strengths: "Advanced tech, integration expertise", weaknesses: "Very high pricing", isActive: true, companyId },
    { name: "QuickFit Fasteners", website: "https://quickfitfasteners.com", description: "Industrial fasteners supplier", strengths: "Huge inventory, fast delivery", weaknesses: "Inconsistent quality", isActive: true, companyId },
    { name: "GreenTech Solutions", website: "https://greentechsolutions.in", description: "Sustainable industrial products", strengths: "Eco-friendly, certifications", weaknesses: "Limited range, higher cost", isActive: true, companyId },
    { name: "Global Pipes & Fittings", website: "https://globalpipes.com", description: "International pipes manufacturer", strengths: "Global standards, wide range", weaknesses: "Import delays, limited support", isActive: true, companyId },
  ];

  const compMap: Record<string, string> = {};
  for (const c of competitorsData) {
    try {
      const existing = await prisma.competitor.findFirst({ where: { companyId, name: c.name } });
      if (existing) { compMap[c.name] = existing.id; }
      else { const comp = await prisma.competitor.create({ data: c }); compMap[c.name] = comp.id; }
    } catch (e: any) { console.log(`⚠️  Competitor "${c.name}" skipped`); }
  }

  // Competitor products
  const compProductsData = [
    { competitorId: compMap["Bharat Valves Ltd"], name: "BV-BallValve-2inch-SS304", description: "2 inch ball valve SS304", priceRange: "₹3,500 - ₹3,800", ourAdvantage: "SS316 material, better corrosion resistance" },
    { competitorId: compMap["Bharat Valves Ltd"], name: "BV-GateValve-4inch-CI", description: "4 inch gate valve cast iron", priceRange: "₹6,800 - ₹7,200", ourAdvantage: "Faster delivery (2 weeks vs 4)" },
    { competitorId: compMap["TechFlow Systems"], name: "TF-ControlValve-Pneumatic", description: "Pneumatic control valve", priceRange: "₹25,000 - ₹28,000", ourAdvantage: "Smart positioner, better accuracy" },
    { competitorId: compMap["TechFlow Systems"], name: "TF-SolenoidValve-Direct", description: "Direct acting solenoid valve", priceRange: "₹4,500 - ₹5,000", ourAdvantage: "Lower power consumption" },
    { competitorId: compMap["Southern Conveyors"], name: "SC-BeltConv-15m-Heavy", description: "15m belt conveyor heavy duty", priceRange: "₹3,50,000 - ₹3,80,000", ourAdvantage: "Better motor 7.5kW vs 5.5kW" },
    { competitorId: compMap["Southern Conveyors"], name: "SC-RollerConv-20m", description: "20m roller conveyor system", priceRange: "₹4,20,000 - ₹4,50,000", ourAdvantage: "Galvanized rollers vs painted" },
    { competitorId: compMap["PowerMax Electricals"], name: "PM-MCC-630A-IP54", description: "MCC panel 630A IP54", priceRange: "₹2,50,000 - ₹2,80,000", ourAdvantage: "Copper bus bars standard" },
    { competitorId: compMap["PowerMax Electricals"], name: "PM-APFC-250KVAR", description: "APFC panel 250 KVAR", priceRange: "₹1,80,000 - ₹2,00,000", ourAdvantage: "Harmonic filter included" },
    { competitorId: compMap["Precision Pumps India"], name: "PP-Centrifugal-5HP", description: "5HP centrifugal pump", priceRange: "₹45,000 - ₹50,000", ourAdvantage: "IE3 motor vs IE2" },
    { competitorId: compMap["Precision Pumps India"], name: "PP-Submersible-10HP", description: "10HP submersible pump", priceRange: "₹65,000 - ₹72,000", ourAdvantage: "Better seal design" },
    { competitorId: compMap["Metro Machinery"], name: "MM-HydraulicPress-100T", description: "100 ton hydraulic press", priceRange: "₹15,00,000 - ₹16,50,000", ourAdvantage: "PLC control vs manual" },
    { competitorId: compMap["Apex Automation"], name: "AA-PLC-Panel-Modular", description: "Modular PLC panel system", priceRange: "₹3,50,000 - ₹3,80,000", ourAdvantage: "Open architecture vs proprietary" },
    { competitorId: compMap["Apex Automation"], name: "AA-SCADA-System", description: "SCADA for plant monitoring", priceRange: "₹12,00,000 - ₹13,50,000", ourAdvantage: "Web-based vs desktop only" },
    { competitorId: compMap["QuickFit Fasteners"], name: "QF-HexBolt-M16-80", description: "M16 hex bolt 80mm grade 8.8", priceRange: "₹45 - ₹55 per piece", ourAdvantage: "Grade 10.9 available" },
    { competitorId: compMap["GreenTech Solutions"], name: "GT-SolarPump-2HP", description: "2HP solar-powered pump", priceRange: "₹55,000 - ₹60,000", ourAdvantage: "Higher efficiency 22% vs 18%" },
    { competitorId: compMap["Global Pipes & Fittings"], name: "GP-ERW-Pipe-6inch", description: "6 inch ERW pipe IS 2062", priceRange: "₹4,500 - ₹5,000 per meter", ourAdvantage: "Local stock available" },
  ];

  for (const cp of compProductsData) {
    try {
      if (!cp.competitorId) continue;
      const existing = await prisma.competitorProduct.findFirst({ where: { competitorId: cp.competitorId, name: cp.name } });
      if (!existing) await prisma.competitorProduct.create({ data: cp });
    } catch (e: any) { console.log(`⚠️  Product "${cp.name}" skipped`); }
  }
  console.log(`✅ Competitors: ${Object.keys(compMap).length}, Products: ${compProductsData.length}`);

  // ─── Lost Deal Analysis ───────────────────────────────────────────────────
  const lostDeals = deals.filter(d => d.status === "Lost");
  const compNames = Object.keys(compMap);
  const lrNames = Object.keys(lrMap);

  for (let i = 0; i < lostDeals.length; i++) {
    const ld = lostDeals[i];
    try {
      const existing = await prisma.lostDealAnalysis.findFirst({ where: { dealId: ld.id } });
      if (!existing) {
        await prisma.lostDealAnalysis.create({
          data: {
            dealId: ld.id,
            competitorId: compMap[compNames[i % compNames.length]],
            lossReasonId: lrMap[lrNames[i % lrNames.length]],
            competitorWonPrice: ld.dealValue * 0.85,
            ourFinalPrice: ld.dealValue,
            lessonsLearned: "Review pricing strategy and strengthen relationships",
            recordedById: salesExecs[0]?.id || salesManager.id,
            companyId,
          }
        });
      }
    } catch (e: any) { console.log(`⚠️  LostDealAnalysis skipped: ${e.message?.slice(0, 80)}`); }
  }
  console.log(`✅ Lost Deal Analysis: ${lostDeals.length}`);

  // ─── Territories ──────────────────────────────────────────────────────────
  const territoriesData = [
    { name: "South Chennai", region: "Chennai", states: "Tamil Nadu", assignedUserId: salesExecs[0]?.id, isActive: true, companyId },
    { name: "North Chennai", region: "Chennai", states: "Tamil Nadu", assignedUserId: salesExecs[1]?.id || salesExecs[0]?.id, isActive: true, companyId },
    { name: "Coimbatore Industrial", region: "Coimbatore", states: "Tamil Nadu", assignedUserId: salesExecs[0]?.id, isActive: true, companyId },
    { name: "Bengaluru B2B", region: "Bengaluru", states: "Karnataka", assignedUserId: salesExecs[1]?.id || salesExecs[0]?.id, isActive: true, companyId },
    { name: "Hyderabad Enterprise", region: "Hyderabad", states: "Telangana", assignedUserId: salesManager.id, isActive: true, companyId },
    { name: "Mumbai Commercial", region: "Mumbai", states: "Maharashtra", assignedUserId: salesManager.id, isActive: true, companyId },
  ];

  const terrMap: Record<string, string> = {};
  for (const t of territoriesData) {
    try {
      const existing = await prisma.territory.findFirst({ where: { companyId, name: t.name } });
      if (existing) { terrMap[t.name] = existing.id; }
      else { const terr = await prisma.territory.create({ data: t }); terrMap[t.name] = terr.id; }
    } catch (e: any) { console.log(`⚠️  Territory "${t.name}" skipped`); }
  }

  const terrNames = Object.keys(terrMap);
  for (let i = 0; i < customers.length; i++) {
    const terrName = terrNames[i % terrNames.length];
    try {
      const existing = await prisma.territoryAccount.findFirst({ where: { territoryId: terrMap[terrName], customerId: customers[i].id } });
      if (!existing) await prisma.territoryAccount.create({ data: { territoryId: terrMap[terrName], customerId: customers[i].id } });
    } catch (e: any) { }
  }
  console.log(`✅ Territories: ${Object.keys(terrMap).length}, Accounts: ${customers.length}`);

  // ─── Sales Targets ────────────────────────────────────────────────────────
  const now = new Date();
  const cm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lm = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;
  const cq = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
  const lq = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3) - 1 || 4}`;
  const cy = String(now.getFullYear());
  const ly = String(now.getFullYear() - 1);

  const targetsData = [
    { targetType: "Monthly", period: cm, targetAmount: 550000, achievedAmount: 234500, assignedUserId: salesExecs[0]?.id, territoryId: terrMap["South Chennai"], companyId },
    { targetType: "Monthly", period: cm, targetAmount: 480000, achievedAmount: 412000, assignedUserId: salesExecs[1]?.id || salesExecs[0]?.id, territoryId: terrMap["North Chennai"], companyId },
    { targetType: "Monthly", period: cm, targetAmount: 1100000, achievedAmount: 658500, assignedUserId: salesManager.id, companyId },
    { targetType: "Monthly", period: lm, targetAmount: 500000, achievedAmount: 535000, assignedUserId: salesExecs[0]?.id, territoryId: terrMap["South Chennai"], companyId },
    { targetType: "Monthly", period: lm, targetAmount: 450000, achievedAmount: 415000, assignedUserId: salesExecs[1]?.id || salesExecs[0]?.id, territoryId: terrMap["North Chennai"], companyId },
    { targetType: "Quarterly", period: cq, targetAmount: 1650000, achievedAmount: 925500, assignedUserId: salesExecs[0]?.id, territoryId: terrMap["South Chennai"], companyId },
    { targetType: "Quarterly", period: cq, targetAmount: 1440000, achievedAmount: 827000, assignedUserId: salesExecs[1]?.id || salesExecs[0]?.id, territoryId: terrMap["North Chennai"], companyId },
    { targetType: "Quarterly", period: cq, targetAmount: 3300000, achievedAmount: 1912500, assignedUserId: salesManager.id, companyId },
    { targetType: "Quarterly", period: lq, targetAmount: 1500000, achievedAmount: 1380000, assignedUserId: salesExecs[0]?.id, territoryId: terrMap["South Chennai"], companyId },
    { targetType: "Quarterly", period: lq, targetAmount: 1350000, achievedAmount: 1420000, assignedUserId: salesExecs[1]?.id || salesExecs[0]?.id, territoryId: terrMap["North Chennai"], companyId },
    { targetType: "Yearly", period: cy, targetAmount: 6600000, achievedAmount: 2265000, assignedUserId: salesExecs[0]?.id, territoryId: terrMap["South Chennai"], companyId },
    { targetType: "Yearly", period: cy, targetAmount: 5760000, achievedAmount: 2052000, assignedUserId: salesExecs[1]?.id || salesExecs[0]?.id, territoryId: terrMap["North Chennai"], companyId },
    { targetType: "Yearly", period: cy, targetAmount: 13200000, achievedAmount: 4317000, assignedUserId: salesManager.id, companyId },
    { targetType: "Yearly", period: ly, targetAmount: 5500000, achievedAmount: 5350000, assignedUserId: salesExecs[0]?.id, companyId },
    { targetType: "Yearly", period: ly, targetAmount: 4800000, achievedAmount: 5120000, assignedUserId: salesExecs[1]?.id || salesExecs[0]?.id, companyId },
  ];

  for (const t of targetsData) {
    try {
      const existing = await prisma.salesTarget.findFirst({
        where: { targetType: t.targetType, period: t.period, assignedUserId: t.assignedUserId, territoryId: t.territoryId ?? null, companyId }
      });
      if (!existing) await prisma.salesTarget.create({ data: t as any });
    } catch (e: any) { console.log(`⚠️  SalesTarget skipped: ${e.message?.slice(0, 80)}`); }
  }
  console.log(`✅ Sales Targets: ${targetsData.length}`);

  // ─── Key Accounts ─────────────────────────────────────────────────────────
  const kaData = [
    { customerId: customers[0]?.id, accountManagerId: salesExecs[0]?.id || salesManager.id, revenuePotential: 5500000, strategicImportance: "Critical", relationshipStatus: "Strong", nextReviewDate: new Date("2026-07-15"), notes: "Top revenue customer - automation pipeline", companyId },
    { customerId: customers[1]?.id, accountManagerId: salesExecs[0]?.id || salesManager.id, revenuePotential: 8200000, strategicImportance: "Critical", relationshipStatus: "Strong", nextReviewDate: new Date("2026-07-01"), notes: "Annual supply contract renewal", companyId },
    { customerId: customers[2]?.id, accountManagerId: salesExecs[1]?.id || salesManager.id, revenuePotential: 3800000, strategicImportance: "Critical", relationshipStatus: "Growing", nextReviewDate: new Date("2026-07-20"), notes: "System upgrade project", companyId },
    { customerId: customers[3]?.id, accountManagerId: salesExecs[1]?.id || salesManager.id, revenuePotential: 2800000, strategicImportance: "High", relationshipStatus: "Developing", nextReviewDate: new Date("2026-07-10"), notes: "High growth potential sector", companyId },
    { customerId: customers[4]?.id, accountManagerId: salesExecs[0]?.id || salesManager.id, revenuePotential: 4500000, strategicImportance: "High", relationshipStatus: "Strong", nextReviewDate: new Date("2026-07-25"), notes: "Manufacturing hub - regular orders", companyId },
    { customerId: customers[5]?.id, accountManagerId: salesManager.id, revenuePotential: 6200000, strategicImportance: "Critical", relationshipStatus: "Strong", nextReviewDate: new Date("2026-07-05"), notes: "Strategic partner - long-term agreement", companyId },
    { customerId: customers[6]?.id, accountManagerId: salesExecs[1]?.id || salesManager.id, revenuePotential: 2100000, strategicImportance: "Medium", relationshipStatus: "Developing", nextReviewDate: new Date("2026-07-30"), notes: "New customer onboarding", companyId },
    { customerId: customers[7]?.id, accountManagerId: salesExecs[0]?.id || salesManager.id, revenuePotential: 3200000, strategicImportance: "High", relationshipStatus: "Growing", nextReviewDate: new Date("2026-07-12"), notes: "Regional expansion opportunity", companyId },
    { customerId: customers[8]?.id, accountManagerId: salesManager.id, revenuePotential: 4800000, strategicImportance: "Critical", relationshipStatus: "Strong", nextReviewDate: new Date("2026-07-18"), notes: "Enterprise multi-year contract", companyId },
    { customerId: customers[9]?.id, accountManagerId: salesExecs[1]?.id || salesManager.id, revenuePotential: 1900000, strategicImportance: "Medium", relationshipStatus: "Stable", nextReviewDate: new Date("2026-08-01"), notes: "Steady orders - maintenance focus", companyId },
  ];

  for (const ka of kaData) {
    try {
      if (!ka.customerId) continue;
      const existing = await prisma.keyAccount.findFirst({ where: { customerId: ka.customerId, companyId } });
      if (!existing) await prisma.keyAccount.create({ data: ka as any });
    } catch (e: any) { console.log(`⚠️  KeyAccount skipped: ${e.message?.slice(0, 80)}`); }
  }
  console.log(`✅ Key Accounts: ${kaData.length}`);

  console.log("\n🎉 V4 seed for Suki Software Solutions complete!");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
