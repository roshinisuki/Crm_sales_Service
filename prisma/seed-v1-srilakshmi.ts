/**
 * SUKI CRM — Seed Data Script V1 for Sri Lakshmi Enterprises
 * Core CRM: Customers, Deals
 *
 * Run: npx ts-node prisma/seed-v1-srilakshmi.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting V1 seed for Sri Lakshmi Enterprises...\n");

  const company = await prisma.company.findUnique({
    where: { name: "Sri Lakshmi Enterprises" }
  });
  if (!company) {
    throw new Error("Sri Lakshmi Enterprises not found. Create it first via V1 seed or manually.");
  }
  console.log(`✅ Company: ${company.name} (Variant ${company.variant})`);

  // Get users
  const users = await prisma.user.findMany({
    where: { companyId: company.id },
    select: { id: true, name: true, email: true, role: true }
  });
  
  const salesManager = users.find(u => u.role === "SalesManager");
  const salesExecs = users.filter(u => u.role === "SalesExecutive");
  
  if (!salesManager || salesExecs.length < 2) {
    throw new Error("Required users not found. Need SalesManager and 2 SalesExecutives.");
  }
  
  console.log(`✅ Users: ${users.length} (SalesManager: ${salesManager.name}, SalesExecs: ${salesExecs.length})`);

  // ─── Customers (15) ────────────────────────────────────────────────────
  const customersData = [
    { customerCode: "CUST-0001", name: "Chennai Petrochemicals Ltd", email: "procurement@chennaipetro.com", phone: "+91-44-2543-5678", city: "Chennai", status: "Active", companyId: company.id },
    { customerCode: "CUST-0002", name: "Bangalore Tech Solutions", email: "purchasing@bangaloretech.com", phone: "+91-80-2345-6789", city: "Bengaluru", status: "Active", companyId: company.id },
    { customerCode: "CUST-0003", name: "Coimbatore Textiles Pvt Ltd", email: "purchase@coimbatoretextiles.com", phone: "+91-422-2345-678", city: "Coimbatore", status: "Active", companyId: company.id },
    { customerCode: "CUST-0004", name: "Hyderabad Pharmaceuticals", email: "procurement@hyderabadpharma.com", phone: "+91-40-2345-6789", city: "Hyderabad", status: "Active", companyId: company.id },
    { customerCode: "CUST-0005", name: "Mumbai Industrial Equipments", email: "sales@mumbaiindustrial.com", phone: "+91-22-2345-6789", city: "Mumbai", status: "Active", companyId: company.id },
    { customerCode: "CUST-0006", name: "Delhi Energy Systems", email: "energy@delhisystems.com", phone: "+91-11-2345-6789", city: "Delhi", status: "Active", companyId: company.id },
    { customerCode: "CUST-0007", name: "Pune Auto Components", email: "purchasing@puneauto.com", phone: "+91-20-2345-6789", city: "Pune", status: "Active", companyId: company.id },
    { customerCode: "CUST-0008", name: "Kolkata Engineering Works", email: "purchase@kolkataeng.com", phone: "+91-33-2345-6789", city: "Kolkata", status: "Active", companyId: company.id },
    { customerCode: "CUST-0009", name: "Ahmedabad Chemical Industries", email: "procurement@ahmedabadchem.com", phone: "+91-79-2345-6789", city: "Ahmedabad", status: "Active", companyId: company.id },
    { customerCode: "CUST-0010", name: "Jaipur Metal Fabricators", email: "sales@jaipurmetals.com", phone: "+91-141-2345-6789", city: "Jaipur", status: "Active", companyId: company.id },
    { customerCode: "CUST-0011", name: "Lucknow Food Processing", email: "purchase@lucknowfood.com", phone: "+91-522-2345-6789", city: "Lucknow", status: "Active", companyId: company.id },
    { customerCode: "CUST-0012", name: "Indore Power Distribution", email: "power@indorepower.com", phone: "+91-731-2345-6789", city: "Indore", status: "Active", companyId: company.id },
    { customerCode: "CUST-0013", name: "Bhubaneswar Steel Plants", email: "steel@bhubaneswarsteel.com", phone: "+91-674-2345-6789", city: "Bhubaneswar", status: "Active", companyId: company.id },
    { customerCode: "CUST-0014", name: "Kochi Marine Services", email: "marine@kochimarine.com", phone: "+91-484-2345-6789", city: "Kochi", status: "Active", companyId: company.id },
    { customerCode: "CUST-0015", name: "Guwahati Tea Estates", email: "tea@guwahatitea.com", phone: "+91-361-2345-6789", city: "Guwahati", status: "Active", companyId: company.id },
    { customerCode: "CUST-0016", name: "Nagpur Construction", email: "construction@nagpurconst.com", phone: "+91-712-2345-6789", city: "Nagpur", status: "Active", companyId: company.id },
  ];

  const custMap: Record<string, string> = {};
  for (const c of customersData) {
    try {
      const existing = await prisma.customer.findFirst({
        where: { companyId: company.id, customerCode: c.customerCode }
      });
      if (existing) {
        custMap[c.customerCode] = existing.id;
      } else {
        const customer = await prisma.customer.create({ data: c });
        custMap[c.customerCode] = customer.id;
      }
    } catch (e: any) {
      console.log(`⚠️  Customer "${c.customerCode}" skipped: ${e.message?.slice(0, 80)}`);
    }
  }
  console.log(`✅ Customers: ${Object.keys(custMap).length}`);

  // ─── Deals (25) ───────────────────────────────────────────────────────
  const dealStatuses = ["Active", "Active", "Active", "Active", "Active", "Won", "Won", "Won", "Lost", "Lost", "Lost", "Lost", "On Hold", "On Hold", "On Hold", "On Hold", "Active", "Active", "Active", "Active", "Active", "Active", "Active", "Active", "Active"];
  const dealValues = [250000, 450000, 180000, 320000, 550000, 780000, 620000, 890000, 410000, 375000, 520000, 280000, 195000, 420000, 330000, 580000, 720000, 910000, 480000, 390000, 670000, 540000, 820000, 760000, 440000];
  
  const dealsData: any[] = [];
  Object.keys(custMap).forEach((custCode, idx) => {
    dealsData.push({
      dealName: `${custCode.replace("CUST-", "")}-Deal-${idx + 1}`,
      customerId: custMap[custCode],
      dealValue: dealValues[idx % dealValues.length],
      expectedCloseDate: new Date(2026, 7 + Math.floor(idx / 3), 15),
      status: dealStatuses[idx],
      companyId: company.id
    });
  });

  for (const deal of dealsData) {
    try {
      await prisma.deal.create({ data: deal });
    } catch (e: any) {
      console.log(`⚠️  Deal "${deal.dealName}" skipped: ${e.message?.slice(0, 80)}`);
    }
  }
  console.log(`✅ Deals: ${dealsData.length}`);

  console.log("\n🎉 V1 seed for Sri Lakshmi Enterprises complete!");
  console.log("\n📋 Summary:");
  console.log(`   - Customers: ${Object.keys(custMap).length}`);
  console.log(`   - Deals: ${dealsData.length}`);
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
