/**
 * SUKI CRM — V4 Demo Seed for Sri Lakshmi Enterprises
 * Enterprise: Competitors, Territories, Targets, Key Accounts, Loss Reasons
 *
 * Run: npx ts-node prisma/seed-v4-srilakshmi.ts
 * Tenant: Sri Lakshmi Enterprises (Variant 4)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting V4 seed for Sri Lakshmi Enterprises...\n");

  // Get the V4 demo tenant
  const company = await prisma.company.findUnique({
    where: { name: "Sri Lakshmi Enterprises" }
  });
  if (!company) {
    throw new Error("Sri Lakshmi Enterprises not found. Run V1 seed first.");
  }
  console.log(`✅ Company: ${company.name} (Variant ${company.variant})`);

  // Get existing users
  const users = await prisma.user.findMany({
    where: { companyId: company.id },
    select: { id: true, name: true, email: true, role: true }
  });
  
  const admin = users.find(u => u.role === "Admin");
  const salesManager = users.find(u => u.role === "SalesManager");
  const salesExecs = users.filter(u => u.role === "SalesExecutive");
  
  if (!admin || !salesManager || salesExecs.length < 2) {
    throw new Error("Required users not found. Need Admin, SalesManager, and 2 SalesExecutives.");
  }
  
  console.log(`✅ Users: ${users.length} (Admin: ${admin.name}, SalesManager: ${salesManager.name}, SalesExecs: ${salesExecs.length})`);

  // Get existing customers
  const customers = await prisma.customer.findMany({
    where: { companyId: company.id },
    select: { id: true, customerCode: true, name: true, city: true }
  });
  
  const cust = (code: string) => customers.find((c) => c.customerCode === code);
  console.log(`✅ Customers: ${customers.length}`);

  // Get existing deals
  const deals = await prisma.deal.findMany({
    where: { companyId: company.id },
    select: { id: true, dealName: true, status: true, dealValue: true, customerId: true }
  });
  console.log(`✅ Deals: ${deals.length}`);

  // ─── Loss Reasons (9) ────────────────────────────────────────────────────
  const lossReasonsData = [
    { name: "Price Too High", isActive: true, companyId: company.id },
    { name: "Competitor Relationship Stronger", isActive: true, companyId: company.id },
    { name: "Missing Feature", isActive: true, companyId: company.id },
    { name: "Delayed Response", isActive: true, companyId: company.id },
    { name: "No Decision", isActive: true, companyId: company.id },
    { name: "Budget Issue", isActive: true, companyId: company.id },
    { name: "Technical Mismatch", isActive: true, companyId: company.id },
    { name: "Existing Vendor Retained", isActive: true, companyId: company.id },
    { name: "Quality Concerns", isActive: true, companyId: company.id },
  ];

  const lrMap: Record<string, string> = {};
  for (const lr of lossReasonsData) {
    try {
      const existing = await prisma.lossReason.findFirst({
        where: { companyId: company.id, name: lr.name }
      });
      if (existing) {
        lrMap[lr.name] = existing.id;
      } else {
        const reason = await prisma.lossReason.create({ data: lr });
        lrMap[lr.name] = reason.id;
      }
    } catch (e: any) {
      console.log(`⚠️  LossReason "${lr.name}" skipped: ${e.message?.slice(0, 80)}`);
    }
  }
  console.log(`✅ Loss Reasons: ${Object.keys(lrMap).length}`);

  // ─── Competitors (10) with products ───────────────────────────────────────
  const competitorsData = [
    { 
      name: "Bharat Valves Ltd", 
      website: "https://bharatvalves.com", 
      description: "Leading manufacturer of industrial valves in South India", 
      strengths: "Wide distribution network, competitive pricing, local support", 
      weaknesses: "Limited product range, slower R&D", 
      isActive: true, 
      companyId: company.id 
    },
    { 
      name: "TechFlow Systems", 
      website: "https://techflow.in", 
      description: "Specialist in fluid control and automation systems", 
      strengths: "Strong technical expertise, custom solutions, good after-sales", 
      weaknesses: "Higher price point, limited brand recognition", 
      isActive: true, 
      companyId: company.id 
    },
    { 
      name: "Southern Conveyors", 
      website: "https://southernconveyors.co.in", 
      description: "Material handling and conveyor systems manufacturer", 
      strengths: "Fast delivery, good quality, competitive pricing", 
      weaknesses: "Limited customization, smaller production capacity", 
      isActive: true, 
      companyId: company.id 
    },
    { 
      name: "PowerMax Electricals", 
      website: "https://powermaxelectricals.com", 
      description: "Electrical panels and switchgear manufacturer", 
      strengths: "Certified products, good brand reputation, standard offerings", 
      weaknesses: "Long lead times, limited custom options", 
      isActive: true, 
      companyId: company.id 
    },
    { 
      name: "Precision Pumps India", 
      website: "https://precisionpumps.in", 
      description: "Industrial pumps and pumping systems", 
      strengths: "Energy-efficient products, good warranty, technical support", 
      weaknesses: "Higher cost, limited dealer network", 
      isActive: true, 
      companyId: company.id 
    },
    { 
      name: "Metro Machinery", 
      website: "https://metromachinery.com", 
      description: "Heavy machinery and equipment supplier", 
      strengths: "Wide product range, financing options, established brand", 
      weaknesses: "Older technology, slower innovation", 
      isActive: true, 
      companyId: company.id 
    },
    { 
      name: "Apex Automation", 
      website: "https://apexautomation.co.in", 
      description: "Industrial automation and control systems", 
      strengths: "Advanced technology, integration expertise, premium quality", 
      weaknesses: "Very high pricing, complex implementation", 
      isActive: true, 
      companyId: company.id 
    },
    { 
      name: "QuickFit Fasteners", 
      website: "https://quickfitfasteners.com", 
      description: "Industrial fasteners and hardware supplier", 
      strengths: "Huge inventory, fast delivery, competitive pricing", 
      weaknesses: "Limited premium options, inconsistent quality", 
      isActive: true, 
      companyId: company.id 
    },
    { 
      name: "GreenTech Solutions", 
      website: "https://greentechsolutions.in", 
      description: "Sustainable and energy-efficient industrial products", 
      strengths: "Eco-friendly products, government certifications, niche market", 
      weaknesses: "Limited product range, higher costs, new market entrant", 
      isActive: true, 
      companyId: company.id 
    },
    { 
      name: "Global Pipes & Fittings", 
      website: "https://globalpipes.com", 
      description: "International pipes and fittings manufacturer", 
      strengths: "Global standards, wide range, competitive imports", 
      weaknesses: "Import delays, limited local support", 
      isActive: true, 
      companyId: company.id 
    },
  ];

  const compMap: Record<string, string> = {};
  for (const c of competitorsData) {
    try {
      const existing = await prisma.competitor.findFirst({
        where: { companyId: company.id, name: c.name }
      });
      if (existing) {
        compMap[c.name] = existing.id;
      } else {
        const comp = await prisma.competitor.create({ data: c });
        compMap[c.name] = comp.id;
      }
    } catch (e: any) {
      console.log(`⚠️  Competitor "${c.name}" skipped: ${e.message?.slice(0, 80)}`);
    }
  }

  // Competitor products (3-4 per competitor)
  const compProductsData = [
    // Bharat Valves
    { competitorId: compMap["Bharat Valves Ltd"], name: "BV-BallValve-2inch-SS304", description: "2 inch ball valve - SS304 standard", priceRange: "₹3,500 - ₹3,800", ourAdvantage: "SS316 material, better corrosion resistance" },
    { competitorId: compMap["Bharat Valves Ltd"], name: "BV-GateValve-4inch-CI", description: "4 inch gate valve - cast iron", priceRange: "₹6,800 - ₹7,200", ourAdvantage: "Faster delivery (2 weeks vs 4)" },
    { competitorId: compMap["Bharat Valves Ltd"], name: "BV-CheckValve-1inch", description: "1 inch check valve - brass", priceRange: "₹1,200 - ₹1,400", ourAdvantage: "Spring-loaded design, better performance" },
    { competitorId: compMap["Bharat Valves Ltd"], name: "BV-ButterflyValve-6inch", description: "6 inch butterfly valve - wafer type", priceRange: "₹12,000 - ₹13,500", ourAdvantage: "EPDM seat vs their Nitrile" },
    // TechFlow Systems
    { competitorId: compMap["TechFlow Systems"], name: "TF-ControlValve-Pneumatic", description: "Pneumatic control valve with positioner", priceRange: "₹25,000 - ₹28,000", ourAdvantage: "Smart positioner, better accuracy" },
    { competitorId: compMap["TechFlow Systems"], name: "TF-SolenoidValve-Direct", description: "Direct acting solenoid valve", priceRange: "₹4,500 - ₹5,000", ourAdvantage: "Lower power consumption" },
    { competitorId: compMap["TechFlow Systems"], name: "TF-PressureRegulator", description: "Pressure reducing regulator", priceRange: "₹8,000 - ₹9,000", ourAdvantage: "Wider adjustment range" },
    // Southern Conveyors
    { competitorId: compMap["Southern Conveyors"], name: "SC-BeltConv-15m-Heavy", description: "15m belt conveyor - heavy duty", priceRange: "₹3,50,000 - ₹3,80,000", ourAdvantage: "Better motor (7.5kW vs 5.5kW)" },
    { competitorId: compMap["Southern Conveyors"], name: "SC-RollerConv-20m", description: "20m roller conveyor system", priceRange: "₹4,20,000 - ₹4,50,000", ourAdvantage: "Galvanized rollers vs painted" },
    { competitorId: compMap["Southern Conveyors"], name: "SC-ChainConv-10m", description: "10m chain conveyor", priceRange: "₹2,80,000 - ₹3,00,000", ourAdvantage: "Double pitch chain for smoother operation" },
    // PowerMax Electricals
    { competitorId: compMap["PowerMax Electricals"], name: "PM-MCC-630A-IP54", description: "MCC panel 630A with IP54", priceRange: "₹2,50,000 - ₹2,80,000", ourAdvantage: "Copper bus bars standard" },
    { competitorId: compMap["PowerMax Electricals"], name: "PM-APFC-250KVAR", description: "APFC panel 250 KVAR", priceRange: "₹1,80,000 - ₹2,00,000", ourAdvantage: "Harmonic filter included" },
    { competitorId: compMap["PowerMax Electricals"], name: "PM-DB-1000A", description: "Distribution board 1000A", priceRange: "₹85,000 - ₹95,000", ourAdvantage: "Higher short-circuit rating" },
    // Precision Pumps
    { competitorId: compMap["Precision Pumps India"], name: "PP-Centrifugal-5HP", description: "5HP centrifugal pump", priceRange: "₹45,000 - ₹50,000", ourAdvantage: "IE3 motor vs their IE2" },
    { competitorId: compMap["Precision Pumps India"], name: "PP-Submersible-10HP", description: "10HP submersible pump", priceRange: "₹65,000 - ₹72,000", ourAdvantage: "Better seal design" },
    // Metro Machinery
    { competitorId: compMap["Metro Machinery"], name: "MM-HydraulicPress-100T", description: "100 ton hydraulic press", priceRange: "₹15,00,000 - ₹16,50,000", ourAdvantage: "PLC control vs manual" },
    { competitorId: compMap["Metro Machinery"], name: "MM-Lathe-8ft", description: "8ft lathe machine", priceRange: "₹8,50,000 - ₹9,20,000", ourAdvantage: "Digital readout included" },
    // Apex Automation
    { competitorId: compMap["Apex Automation"], name: "AA-PLC-Panel-Modular", description: "Modular PLC panel system", priceRange: "₹3,50,000 - ₹3,80,000", ourAdvantage: "Open architecture vs proprietary" },
    { competitorId: compMap["Apex Automation"], name: "AA-SCADA-System", description: "SCADA system for plant monitoring", priceRange: "₹12,00,000 - ₹13,50,000", ourAdvantage: "Web-based access vs desktop only" },
    // QuickFit Fasteners
    { competitorId: compMap["QuickFit Fasteners"], name: "QF-HexBolt-M16-80", description: "M16 hex bolt 80mm - grade 8.8", priceRange: "₹45 - ₹55 per piece", ourAdvantage: "Grade 10.9 available" },
    { competitorId: compMap["QuickFit Fasteners"], name: "QF-Nut-M16", description: "M16 hex nut - grade 8.8", priceRange: "₹25 - ₹30 per piece", ourAdvantage: "Nyloc nut option" },
    // GreenTech Solutions
    { competitorId: compMap["GreenTech Solutions"], name: "GT-SolarPump-2HP", description: "2HP solar-powered pump", priceRange: "₹55,000 - ₹60,000", ourAdvantage: "Higher efficiency (22% vs 18%)" },
    { competitorId: compMap["GreenTech Solutions"], name: "GT-VFD-15KW", description: "15KW variable frequency drive", priceRange: "₹1,20,000 - ₹1,35,000", ourAdvantage: "Regenerative braking" },
    // Global Pipes
    { competitorId: compMap["Global Pipes & Fittings"], name: "GP-ERW-Pipe-6inch", description: "6 inch ERW pipe - IS 2062", priceRange: "₹4,500 - ₹5,000 per meter", ourAdvantage: "Local stock available" },
    { competitorId: compMap["Global Pipes & Fittings"], name: "GP-Elbow-6inch", description: "6 inch elbow - 90 degree", priceRange: "₹850 - ₹950 per piece", ourAdvantage: "Seamless vs welded" },
  ];

  for (const cp of compProductsData) {
    try {
      const existing = await prisma.competitorProduct.findFirst({
        where: { 
          competitorId: cp.competitorId, 
          name: cp.name 
        }
      });
      if (!existing) {
        await prisma.competitorProduct.create({ data: cp });
      }
    } catch (e: any) {
      console.log(`⚠️  CompetitorProduct "${cp.name}" skipped: ${e.message?.slice(0, 80)}`);
    }
  }
  console.log(`✅ Competitors: ${Object.keys(compMap).length}, Products: ${compProductsData.length}`);

  // ─── Lost Deal Analysis ──────────────────────────────────────────────────
  const lostDeals = deals.filter(d => d.status === "Lost");
  for (const lostDeal of lostDeals.slice(0, 5)) {
    const competitorNames = Object.keys(compMap);
    const randomCompetitor = competitorNames[Math.floor(Math.random() * competitorNames.length)];
    const lossReasonNames = Object.keys(lrMap);
    const randomReason = lossReasonNames[Math.floor(Math.random() * lossReasonNames.length)];
    
    try {
      const existing = await prisma.lostDealAnalysis.findFirst({
        where: { dealId: lostDeal.id }
      });
      if (!existing) {
        await prisma.lostDealAnalysis.create({
          data: {
            dealId: lostDeal.id,
            competitorId: compMap[randomCompetitor],
            lossReasonId: lrMap[randomReason],
            competitorWonPrice: lostDeal.dealValue * 0.85,
            ourFinalPrice: lostDeal.dealValue,
            lessonsLearned: "Review pricing strategy and competitor positioning",
            recordedById: salesExecs[0].id,
            companyId: company.id,
          }
        });
      }
    } catch (e: any) {
      console.log(`⚠️  LostDealAnalysis for deal "${lostDeal.dealName}" skipped: ${e.message?.slice(0, 80)}`);
    }
  }
  console.log(`✅ Lost Deal Analysis: ${lostDeals.slice(0, 5).length}`);

  // ─── Territories (6) ─────────────────────────────────────────────────────
  const territoriesData = [
    { name: "South Chennai", region: "Chennai", states: "Tamil Nadu", assignedUserId: salesExecs[0].id, isActive: true, companyId: company.id },
    { name: "North Chennai", region: "Chennai", states: "Tamil Nadu", assignedUserId: salesExecs[1].id, isActive: true, companyId: company.id },
    { name: "Coimbatore Industrial", region: "Coimbatore", states: "Tamil Nadu", assignedUserId: salesExecs[0].id, isActive: true, companyId: company.id },
    { name: "Bengaluru B2B", region: "Bengaluru", states: "Karnataka", assignedUserId: salesExecs[1].id, isActive: true, companyId: company.id },
    { name: "Hyderabad Enterprise", region: "Hyderabad", states: "Telangana", assignedUserId: salesManager.id, isActive: true, companyId: company.id },
    { name: "Mumbai Commercial", region: "Mumbai", states: "Maharashtra", assignedUserId: salesManager.id, isActive: true, companyId: company.id },
  ];

  const terrMap: Record<string, string> = {};
  for (const t of territoriesData) {
    try {
      const existing = await prisma.territory.findFirst({
        where: { companyId: company.id, name: t.name }
      });
      if (existing) {
        terrMap[t.name] = existing.id;
      } else {
        const terr = await prisma.territory.create({ data: t });
        terrMap[t.name] = terr.id;
      }
    } catch (e: any) {
      console.log(`⚠️  Territory "${t.name}" skipped: ${e.message?.slice(0, 80)}`);
    }
  }

  // Territory accounts - assign customers to territories
  const terrAccountsData: { territoryId: string; customerId: string }[] = [];
  const territoryNames = Object.keys(terrMap);
  customers.forEach((customer, idx) => {
    const territoryName = territoryNames[idx % territoryNames.length];
    terrAccountsData.push({
      territoryId: terrMap[territoryName],
      customerId: customer.id
    });
  });

  for (const ta of terrAccountsData) {
    try {
      const existing = await prisma.territoryAccount.findFirst({
        where: { 
          territoryId: ta.territoryId, 
          customerId: ta.customerId 
        }
      });
      if (!existing) {
        await prisma.territoryAccount.create({ data: ta });
      }
    } catch (e: any) {
      console.log(`⚠️  TerritoryAccount skipped: ${e.message?.slice(0, 80)}`);
    }
  }
  console.log(`✅ Territories: ${Object.keys(terrMap).length}, Accounts: ${terrAccountsData.length}`);

  // ─── Sales Targets (18) ──────────────────────────────────────────────────
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;
  const currentQuarter = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
  const lastQuarter = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3) - 1 || 4}`;
  const currentYear = String(now.getFullYear());
  const lastYear = String(now.getFullYear() - 1);

  const targetsData = [
    // Monthly targets - current month
    { targetType: "Monthly", period: currentMonth, targetAmount: 550000, achievedAmount: 234500, assignedUserId: salesExecs[0].id, territoryId: terrMap["South Chennai"], notes: `Monthly target - ${currentMonth}`, companyId: company.id },
    { targetType: "Monthly", period: currentMonth, targetAmount: 480000, achievedAmount: 412000, assignedUserId: salesExecs[1].id, territoryId: terrMap["North Chennai"], notes: `Monthly target - ${currentMonth}`, companyId: company.id },
    { targetType: "Monthly", period: currentMonth, targetAmount: 520000, achievedAmount: 285000, assignedUserId: salesExecs[0].id, territoryId: terrMap["Coimbatore Industrial"], notes: `Monthly target - ${currentMonth}`, companyId: company.id },
    { targetType: "Monthly", period: currentMonth, targetAmount: 600000, achievedAmount: 345000, assignedUserId: salesExecs[1].id, territoryId: terrMap["Bengaluru B2B"], notes: `Monthly target - ${currentMonth}`, companyId: company.id },
    { targetType: "Monthly", period: currentMonth, targetAmount: 1100000, achievedAmount: 658500, assignedUserId: salesManager.id, notes: `Team monthly target - ${currentMonth}`, companyId: company.id },
    // Monthly targets - last month
    { targetType: "Monthly", period: lastMonth, targetAmount: 500000, achievedAmount: 535000, assignedUserId: salesExecs[0].id, territoryId: terrMap["South Chennai"], notes: `Monthly target - ${lastMonth} - exceeded`, companyId: company.id },
    { targetType: "Monthly", period: lastMonth, targetAmount: 450000, achievedAmount: 415000, assignedUserId: salesExecs[1].id, territoryId: terrMap["North Chennai"], notes: `Monthly target - ${lastMonth} - behind`, companyId: company.id },
    // Quarterly targets - current quarter
    { targetType: "Quarterly", period: currentQuarter, targetAmount: 1650000, achievedAmount: 925500, assignedUserId: salesExecs[0].id, territoryId: terrMap["South Chennai"], notes: `Quarterly target - ${currentQuarter}`, companyId: company.id },
    { targetType: "Quarterly", period: currentQuarter, targetAmount: 1440000, achievedAmount: 827000, assignedUserId: salesExecs[1].id, territoryId: terrMap["North Chennai"], notes: `Quarterly target - ${currentQuarter}`, companyId: company.id },
    { targetType: "Quarterly", period: currentQuarter, targetAmount: 1560000, achievedAmount: 855000, assignedUserId: salesExecs[0].id, territoryId: terrMap["Coimbatore Industrial"], notes: `Quarterly target - ${currentQuarter}`, companyId: company.id },
    { targetType: "Quarterly", period: currentQuarter, targetAmount: 1800000, achievedAmount: 1035000, assignedUserId: salesExecs[1].id, territoryId: terrMap["Bengaluru B2B"], notes: `Quarterly target - ${currentQuarter}`, companyId: company.id },
    { targetType: "Quarterly", period: currentQuarter, targetAmount: 3300000, achievedAmount: 1912500, assignedUserId: salesManager.id, notes: `Team quarterly target - ${currentQuarter}`, companyId: company.id },
    // Quarterly targets - last quarter
    { targetType: "Quarterly", period: lastQuarter, targetAmount: 1500000, achievedAmount: 1380000, assignedUserId: salesExecs[0].id, territoryId: terrMap["South Chennai"], notes: `Quarterly target - ${lastQuarter}`, companyId: company.id },
    { targetType: "Quarterly", period: lastQuarter, targetAmount: 1350000, achievedAmount: 1420000, assignedUserId: salesExecs[1].id, territoryId: terrMap["North Chennai"], notes: `Quarterly target - ${lastQuarter} - exceeded`, companyId: company.id },
    // Yearly targets - current year
    { targetType: "Yearly", period: currentYear, targetAmount: 6600000, achievedAmount: 2265000, assignedUserId: salesExecs[0].id, territoryId: terrMap["South Chennai"], notes: `Yearly target - ${currentYear}`, companyId: company.id },
    { targetType: "Yearly", period: currentYear, targetAmount: 5760000, achievedAmount: 2052000, assignedUserId: salesExecs[1].id, territoryId: terrMap["North Chennai"], notes: `Yearly target - ${currentYear}`, companyId: company.id },
    { targetType: "Yearly", period: currentYear, targetAmount: 13200000, achievedAmount: 4317000, assignedUserId: salesManager.id, notes: `Team yearly target - ${currentYear}`, companyId: company.id },
    // Yearly targets - last year
    { targetType: "Yearly", period: lastYear, targetAmount: 5500000, achievedAmount: 5350000, assignedUserId: salesExecs[0].id, notes: `Yearly target - ${lastYear} - near achieved`, companyId: company.id },
    { targetType: "Yearly", period: lastYear, targetAmount: 4800000, achievedAmount: 5120000, assignedUserId: salesExecs[1].id, notes: `Yearly target - ${lastYear} - exceeded`, companyId: company.id },
  ];

  for (const t of targetsData) {
    try {
      const existing = await prisma.salesTarget.findFirst({
        where: {
          targetType: t.targetType,
          period: t.period,
          assignedUserId: t.assignedUserId,
          territoryId: t.territoryId,
          companyId: t.companyId
        }
      });
      if (!existing) {
        await prisma.salesTarget.create({ data: t });
      }
    } catch (e: any) {
      console.log(`⚠️  SalesTarget skipped: ${e.message?.slice(0, 80)}`);
    }
  }
  console.log(`✅ Sales Targets: ${targetsData.length}`);

  // ─── Key Accounts (12) ────────────────────────────────────────────────────
  const keyAccountsData = [
    { customerId: cust("CUST-0001")?.id, accountManagerId: salesExecs[0].id, revenuePotential: 5500000, strategicImportance: "Critical", relationshipStatus: "Strong", nextReviewDate: new Date("2026-07-15"), notes: "Top revenue customer - automation project pipeline", companyId: company.id },
    { customerId: cust("CUST-0002")?.id, accountManagerId: salesExecs[0].id, revenuePotential: 8200000, strategicImportance: "Critical", relationshipStatus: "Strong", nextReviewDate: new Date("2026-07-01"), notes: "Annual supply contract - renewal in progress", companyId: company.id },
    { customerId: cust("CUST-0003")?.id, accountManagerId: salesExecs[1].id, revenuePotential: 3800000, strategicImportance: "Critical", relationshipStatus: "Growing", nextReviewDate: new Date("2026-07-20"), notes: "Expanding relationship - system upgrade project", companyId: company.id },
    { customerId: cust("CUST-0004")?.id, accountManagerId: salesExecs[1].id, revenuePotential: 2800000, strategicImportance: "High", relationshipStatus: "Developing", nextReviewDate: new Date("2026-07-10"), notes: "Green energy sector - high growth potential", companyId: company.id },
    { customerId: cust("CUST-0005")?.id, accountManagerId: salesExecs[0].id, revenuePotential: 4500000, strategicImportance: "High", relationshipStatus: "Strong", nextReviewDate: new Date("2026-07-25"), notes: "Manufacturing hub - regular orders", companyId: company.id },
    { customerId: cust("CUST-0006")?.id, accountManagerId: salesManager.id, revenuePotential: 6200000, strategicImportance: "Critical", relationshipStatus: "Strong", nextReviewDate: new Date("2026-07-05"), notes: "Strategic partner - long-term agreement", companyId: company.id },
    { customerId: cust("CUST-0007")?.id, accountManagerId: salesExecs[1].id, revenuePotential: 2100000, strategicImportance: "Medium", relationshipStatus: "Developing", nextReviewDate: new Date("2026-07-30"), notes: "New customer - onboarding phase", companyId: company.id },
    { customerId: cust("CUST-0008")?.id, accountManagerId: salesExecs[0].id, revenuePotential: 3200000, strategicImportance: "High", relationshipStatus: "Growing", nextReviewDate: new Date("2026-07-12"), notes: "Regional expansion opportunity", companyId: company.id },
    { customerId: cust("CUST-0009")?.id, accountManagerId: salesManager.id, revenuePotential: 4800000, strategicImportance: "Critical", relationshipStatus: "Strong", nextReviewDate: new Date("2026-07-18"), notes: "Enterprise account - multi-year contract", companyId: company.id },
    { customerId: cust("CUST-0010")?.id, accountManagerId: salesExecs[1].id, revenuePotential: 1900000, strategicImportance: "Medium", relationshipStatus: "Stable", nextReviewDate: new Date("2026-08-01"), notes: "Steady orders - maintenance focus", companyId: company.id },
    { customerId: cust("CUST-0011")?.id, accountManagerId: salesExecs[0].id, revenuePotential: 2500000, strategicImportance: "High", relationshipStatus: "Developing", nextReviewDate: new Date("2026-07-22"), notes: "Project-based customer - potential for recurring", companyId: company.id },
    { customerId: cust("CUST-0012")?.id, accountManagerId: salesExecs[1].id, revenuePotential: 3600000, strategicImportance: "High", relationshipStatus: "Growing", nextReviewDate: new Date("2026-07-08"), notes: "Technology adoption leader in their sector", companyId: company.id },
  ];

  for (const ka of keyAccountsData) {
    try {
      if (ka.customerId) {
        const existing = await prisma.keyAccount.findFirst({
          where: { customerId: ka.customerId, companyId: company.id }
        });
        if (!existing) {
          await prisma.keyAccount.create({ data: ka as any });
        }
      }
    } catch (e: any) {
      console.log(`⚠️  KeyAccount skipped: ${e.message?.slice(0, 80)}`);
    }
  }
  console.log(`✅ Key Accounts: ${keyAccountsData.length}`);

  console.log("\n🎉 V4 seed for Sri Lakshmi Enterprises complete!");
  console.log("\n📋 Summary:");
  console.log(`   - Loss Reasons: ${Object.keys(lrMap).length}`);
  console.log(`   - Competitors: ${Object.keys(compMap).length}`);
  console.log(`   - Competitor Products: ${compProductsData.length}`);
  console.log(`   - Lost Deal Analysis: ${lostDeals.slice(0, 5).length}`);
  console.log(`   - Territories: ${Object.keys(terrMap).length}`);
  console.log(`   - Territory Accounts: ${terrAccountsData.length}`);
  console.log(`   - Sales Targets: ${targetsData.length}`);
  console.log(`   - Key Accounts: ${keyAccountsData.length}`);
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
