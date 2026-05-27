import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning up existing database records...");
  
  await prisma.auditLog.deleteMany({});
  await prisma.followUp.deleteMany({});
  await prisma.marketingVisit.deleteMany({});
  await prisma.customerVisit.deleteMany({});
  await prisma.visitor.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.user.deleteMany({});

  console.log("Seeding database with 10+ records for all modules...");

  const passwordHash = await bcrypt.hash("password123", 10);

  // 1. Users (12 Users)
  const usersData = [
    { email: "admin@sukisoftware.com", name: "System Admin", role: "Admin" },
    { email: "lead@sukisoftware.com", name: "Sarah Lead", role: "MarketingLead" },
    { email: "exec1@sukisoftware.com", name: "John Executive", role: "MarketingExecutive" },
    { email: "exec2@sukisoftware.com", name: "Emma Executive", role: "MarketingExecutive" },
    { email: "exec3@sukisoftware.com", name: "Michael Exec", role: "MarketingExecutive" },
    { email: "exec4@sukisoftware.com", name: "Sophia Exec", role: "MarketingExecutive" },
    { email: "customer1@techinnovators.com", name: "Tech Innovators Client", role: "Customer" },
    { email: "customer2@globalsolutions.com", name: "Global Solutions Client", role: "Customer" },
    { email: "customer3@alpharetail.com", name: "Alpha Retail Client", role: "Customer" },
    { email: "customer4@beta.com", name: "Beta Client", role: "Customer" },
    { email: "customer5@gamma.com", name: "Gamma Client", role: "Customer" },
    { email: "customer6@delta.com", name: "Delta Client", role: "Customer" },
  ];

  const createdUsers: Record<string, any> = {};
  for (const u of usersData) {
    createdUsers[u.email] = await prisma.user.create({
      data: {
        email: u.email,
        name: u.name,
        passwordHash,
        role: u.role as any,
        isActive: true,
        isFirstLogin: false,
      },
    });
  }

  const execs = [
    createdUsers["exec1@sukisoftware.com"],
    createdUsers["exec2@sukisoftware.com"],
    createdUsers["exec3@sukisoftware.com"],
    createdUsers["exec4@sukisoftware.com"]
  ];
  const admin = createdUsers["admin@sukisoftware.com"];
  const lead = createdUsers["lead@sukisoftware.com"];

  console.log("12 Users created.");

  // 2. Customers (12 Customers)
  const customersData = [
    { code: "CUST-001", name: "Tech Innovators Inc.", email: "customer1@techinnovators.com", city: "New York", status: "Active" },
    { code: "CUST-002", name: "Global Solutions LLC", email: "customer2@globalsolutions.com", city: "San Francisco", status: "Active" },
    { code: "CUST-003", name: "Alpha Retailers", email: "customer3@alpharetail.com", city: "Chicago", status: "Prospect" },
    { code: "CUST-004", name: "Beta Logistics", email: "customer4@beta.com", city: "Miami", status: "Active" },
    { code: "CUST-005", name: "Gamma Healthcare", email: "customer5@gamma.com", city: "Boston", status: "Active" },
    { code: "CUST-006", name: "Delta Manufacturing", email: "customer6@delta.com", city: "Seattle", status: "Prospect" },
    { code: "CUST-007", name: "Epsilon Edu", email: "contact@epsilon.com", city: "Austin", status: "Inactive" },
    { code: "CUST-008", name: "Zeta Finance", email: "contact@zeta.com", city: "Denver", status: "Active" },
    { code: "CUST-009", name: "Eta Real Estate", email: "contact@eta.com", city: "Atlanta", status: "Active" },
    { code: "CUST-010", name: "Theta Energy", email: "contact@theta.com", city: "Houston", status: "Prospect" },
    { code: "CUST-011", name: "Iota Consulting", email: "contact@iota.com", city: "Phoenix", status: "Active" },
    { code: "CUST-012", name: "Kappa Media", email: "contact@kappa.com", city: "Los Angeles", status: "Active" },
  ];

  const createdCustomers: any[] = [];
  for (let i = 0; i < customersData.length; i++) {
    const c = customersData[i];
    const exec = execs[i % execs.length];
    const cust = await prisma.customer.create({
      data: {
        customerCode: c.code,
        name: c.name,
        email: c.email,
        phone: `555-010${i.toString().padStart(2, '0')}`,
        city: c.city,
        status: c.status as any,
        assignedUserId: exec.id,
      },
    });
    createdCustomers.push(cust);
  }

  console.log("12 Customers created.");

  // 3. Subscriptions (15 Subscriptions)
  const subsData = [];
  for (let i = 0; i < 15; i++) {
    const customer = createdCustomers[i % createdCustomers.length];
    const isExpired = i % 4 === 0;
    const isPending = i % 5 === 0;
    
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - (isExpired ? 14 : Math.floor(Math.random() * 10) + 1));
    
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);

    subsData.push({
      customerId: customer.id,
      planName: i % 2 === 0 ? "Enterprise Plan" : "Standard Plan",
      startDate,
      endDate,
      status: isPending ? "Pending" : isExpired ? "Expired" : "Active",
      notes: `Subscription ${i + 1} notes.`,
    });
  }

  await prisma.subscription.createMany({ data: subsData });
  console.log("15 Subscriptions created.");

  // 4. Marketing Visits / Outbound (12 Visits)
  const mVisitsData = [];
  for (let i = 0; i < 12; i++) {
    const customer = createdCustomers[i % createdCustomers.length];
    const exec = execs[i % execs.length];
    const pastDays = Math.floor(Math.random() * 10) + 1;
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() - pastDays);
    const checkOut = new Date(checkIn.getTime() + (Math.floor(Math.random() * 120) + 30) * 60 * 1000);

    const outcomes = ["Interested", "Not Interested", "Follow-up Required", "Converted"];
    const decisions = ["APPROVED", "REJECTED", "PENDING"];

    mVisitsData.push({
      executiveId: exec.id,
      customerId: customer.id,
      checkIn,
      checkOut,
      purpose: i % 2 === 0 ? "Sales Pitch" : "Subscription Renewal",
      meetingDescription: `Detailed discussion for visit ${i + 1}`,
      outcome: outcomes[i % outcomes.length],
      customerDecision: decisions[i % decisions.length],
      status: "CHECKED_OUT",
    });
  }
  await prisma.marketingVisit.createMany({ data: mVisitsData });
  console.log("12 Marketing Visits created.");

  // 5. Customer Visits / Inbound (10 Visits)
  const cVisitsData = [];
  for (let i = 0; i < 10; i++) {
    const customer = createdCustomers[(i + 3) % createdCustomers.length];
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() - (i + 1));
    const checkOut = new Date(checkIn.getTime() + 45 * 60 * 1000);

    cVisitsData.push({
      customerId: customer.id,
      hostedBy: lead.id,
      purpose: "Support",
      checkInTime: checkIn,
      checkOutTime: checkOut,
      meetingSummary: `Inbound customer visit ${i + 1}`,
      outcome: i % 2 === 0 ? "Resolved" : "Follow-up Required",
      customerDecision: "APPROVED",
      status: "CHECKED_OUT",
    });
  }
  await prisma.customerVisit.createMany({ data: cVisitsData });
  console.log("10 Customer Visits created.");

  // 6. Visitors / General Walk-ins (10 Visitors)
  const visitorsData = [];
  for (let i = 0; i < 10; i++) {
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() - (i + 1));
    const checkOut = new Date(checkIn.getTime() + 60 * 60 * 1000);

    visitorsData.push({
      visitorName: `Guest Visitor ${i + 1}`,
      company: `Vendor Corp ${i + 1}`,
      visitorEmail: `guest${i + 1}@vendor.com`,
      visitorPhone: `555-800-${1000 + i}`,
      purpose: i % 2 === 0 ? "Vendor Meeting" : "Interview",
      hostUserId: admin.id,
      inTime: checkIn,
      outTime: checkOut,
    });
  }
  await prisma.visitor.createMany({ data: visitorsData });
  console.log("10 Visitors created.");

  // 7. Follow-ups (15 Follow-ups)
  const followUpsData = [];
  for (let i = 0; i < 15; i++) {
    const customer = createdCustomers[i % createdCustomers.length];
    const exec = execs[i % execs.length];
    
    let status = "Pending";
    const nextMeetingDate = new Date();
    
    if (i % 3 === 0) {
      status = "Completed";
      nextMeetingDate.setDate(nextMeetingDate.getDate() - 5);
    } else if (i % 3 === 1) {
      status = "Overdue";
      nextMeetingDate.setDate(nextMeetingDate.getDate() - 2);
    } else {
      nextMeetingDate.setDate(nextMeetingDate.getDate() + 3);
    }

    followUpsData.push({
      customerId: customer.id,
      assignedUserId: exec.id,
      nextMeetingDate,
      remarks: `Follow-up action item ${i + 1}`,
      status: status as any,
    });
  }
  await prisma.followUp.createMany({ data: followUpsData });
  console.log("15 Follow-ups created.");

  // 8. Audit Logs (20 Audit Logs)
  const auditLogsData = [];
  const modules = ["auth", "user", "customer", "subscription", "visit", "visitor", "follow-up"];
  const actions = ["login", "create", "update", "delete", "checkin", "checkout"];
  
  for (let i = 0; i < 20; i++) {
    const exec = execs[i % execs.length];
    const timestamp = new Date();
    timestamp.setHours(timestamp.getHours() - i);

    auditLogsData.push({
      userId: exec.id,
      module: modules[i % modules.length],
      action: actions[i % actions.length],
      details: `Generated audit log entry ${i + 1}`,
      timestamp,
    });
  }
  await prisma.auditLog.createMany({ data: auditLogsData });
  console.log("20 Audit Logs created.");

  console.log("Database seeded successfully with 10+ records for all side bar menus! 🎉");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
