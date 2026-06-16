import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID as uuidv4 } from "crypto";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();

  console.log("Cleaning up existing database records...");
  await prisma.callLog.deleteMany({});
  await prisma.leadOwnerHistory.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.dealStageHistory.deleteMany({});
  await prisma.opportunityDetail.deleteMany({});
  await prisma.proposal.deleteMany({});
  await prisma.approvalHistory.deleteMany({});
  await prisma.deal.deleteMany({});
  await prisma.communicationLog.deleteMany({});
  await prisma.note.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.contact.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.notificationPreference.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.followUp.deleteMany({});
  await prisma.marketingVisit.deleteMany({});
  await prisma.customerVisit.deleteMany({});
  await prisma.visitor.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.leadSource.deleteMany({});

  // ---- Lead Sources ----
  console.log("Seeding lead sources...");
  const defaultLeadSources = [
    "Website",
    "Referral",
    "Exhibition",
    "Cold Call",
    "LinkedIn",
    "WhatsApp",
    "Email Campaign",
  ];
  for (const name of defaultLeadSources) {
    await prisma.leadSource.create({
      data: {
        id: uuidv4(),
        name,
        isActive: true,
      },
    });
  }
  console.log("Default lead sources seeded.");

  // ---- Users ----
  console.log("Seeding users...");
  const passwordHash = await bcrypt.hash("password123", 10);
  const usersData = [
    { email: "admin@sukisoftware.com", name: "System Admin", role: "Admin" },
    { email: "lead@sukisoftware.com", name: "Sarah Lead", role: "SalesManager" },
    { email: "exec1@sukisoftware.com", name: "John Executive", role: "SalesExecutive" },
    { email: "exec2@sukisoftware.com", name: "Emma Executive", role: "SalesExecutive" },
    { email: "exec3@sukisoftware.com", name: "Michael Exec", role: "SalesExecutive" },
    { email: "exec4@sukisoftware.com", name: "Sophia Exec", role: "SalesExecutive" },
  ];
  const createdUsers: Record<string, any> = {};
  for (const u of usersData) {
    createdUsers[u.email] = await prisma.user.create({
      data: {
        id: uuidv4(),
        email: u.email,
        name: u.name,
        passwordHash,
        role: u.role,
        isActive: true,
        updatedAt: now,
      },
    });
  }
  const execs = [
    createdUsers["exec1@sukisoftware.com"],
    createdUsers["exec2@sukisoftware.com"],
    createdUsers["exec3@sukisoftware.com"],
    createdUsers["exec4@sukisoftware.com"],
  ];
  console.log(`${usersData.length} users created.`);

  // ---- Customers ----
  console.log("Seeding customers...");
  const customersData = [
    { code: "CUST-001", name: "Tech Innovators Inc.", email: "contact@techinnovators.com", phone: "555-1001", city: "New York", status: "Active" },
    { code: "CUST-002", name: "Global Solutions LLC", email: "contact@globalsolutions.com", phone: "555-1002", city: "San Francisco", status: "Active" },
    { code: "CUST-003", name: "Alpha Retailers", email: "contact@alpharetail.com", phone: "555-1003", city: "Chicago", status: "Active" },
    { code: "CUST-004", name: "Beta Logistics", email: "contact@beta.com", phone: "555-1004", city: "Miami", status: "Active" },
    { code: "CUST-005", name: "Gamma Healthcare", email: "contact@gamma.com", phone: "555-1005", city: "Boston", status: "Inactive" },
    { code: "CUST-006", name: "Delta Manufacturing", email: "contact@delta.com", phone: "555-1006", city: "Seattle", status: "Active" },
    { code: "CUST-007", name: "Epsilon Edu", email: "contact@epsilon.com", phone: "555-1007", city: "Austin", status: "Inactive" },
    { code: "CUST-008", name: "Zeta Finance", email: "contact@zeta.com", phone: "555-1008", city: "Denver", status: "Active" },
    { code: "CUST-009", name: "Eta Real Estate", email: "contact@eta.com", phone: "555-1009", city: "Atlanta", status: "Active" },
    { code: "CUST-010", name: "Theta Energy", email: "contact@theta.com", phone: "555-1010", city: "Houston", status: "Active" },
  ];
  const createdCustomers: any[] = [];
  for (const c of customersData) {
    const cust = await prisma.customer.create({
      data: {
        id: uuidv4(),
        customerCode: c.code,
        name: c.name,
        email: c.email,
        phone: c.phone,
        city: c.city,
        status: c.status,
        updatedAt: now,
      },
    });
    createdCustomers.push(cust);
  }
  console.log(`${createdCustomers.length} customers created.`);

  // ---- Subscriptions ----
  console.log("Seeding subscriptions...");
  const plans = ["Starter Plan", "Standard Plan", "Enterprise Plan"];
  const subStatuses = ["Active", "Expired", "Pending"];
  for (let i = 0; i < 12; i++) {
    const customer = createdCustomers[i % createdCustomers.length];
    const startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - (i + 1));
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);
    await prisma.subscription.create({
      data: {
        id: uuidv4(),
        customerId: customer.id,
        planName: plans[i % plans.length],
        startDate,
        endDate,
        status: subStatuses[i % subStatuses.length],
        notes: `Subscription ${i + 1} notes.`,
        updatedAt: now,
      },
    });
  }
  console.log("12 subscriptions created.");

  // ---- Customer Visits ----
  console.log("Seeding customer visits...");
  const visitPurposes = ["Product Demo", "Contract Renewal", "Support Visit", "Onboarding"];
  const visitOutcomes = ["Interested", "Needs Follow-up", "Closed Deal", "Declined"];
  for (let i = 0; i < 10; i++) {
    const customer = createdCustomers[i % createdCustomers.length];
    const exec = execs[i % execs.length];
    const checkIn = new Date(now);
    checkIn.setDate(checkIn.getDate() - i * 3);
    const checkOut = new Date(checkIn);
    checkOut.setHours(checkOut.getHours() + 2);
    await prisma.customerVisit.create({
      data: {
        id: uuidv4(),
        customerId: customer.id,
        hostedBy: exec.id,
        purpose: visitPurposes[i % visitPurposes.length],
        checkInTime: checkIn,
        checkOutTime: i < 8 ? checkOut : null,
        outcome: visitOutcomes[i % visitOutcomes.length],
        meetingSummary: `Discussed requirements and next steps for ${customer.name}.`,
        status: i < 8 ? "CHECKED_OUT" : "CHECKED_IN",
        updatedAt: now,
      },
    });
  }
  console.log("10 customer visits created.");

  // ---- Marketing Visits ----
  console.log("Seeding marketing visits...");
  for (let i = 0; i < 8; i++) {
    const customer = createdCustomers[i % createdCustomers.length];
    const exec = execs[i % execs.length];
    const checkIn = new Date(now);
    checkIn.setDate(checkIn.getDate() - i * 4);
    const checkOut = new Date(checkIn);
    checkOut.setHours(checkOut.getHours() + 1);
    await prisma.marketingVisit.create({
      data: {
        id: uuidv4(),
        customerId: customer.id,
        executiveId: exec.id,
        checkIn,
        checkOut: i < 7 ? checkOut : null,
        purpose: visitPurposes[i % visitPurposes.length],
        outcome: visitOutcomes[i % visitOutcomes.length],
        status: i < 7 ? "CHECKED_OUT" : "CHECKED_IN",
        updatedAt: now,
      },
    });
  }
  console.log("8 marketing visits created.");

  // ---- Follow-ups ----
  console.log("Seeding follow-ups...");
  const followUpStatuses = ["Pending", "Completed", "Overdue"];
  for (let i = 0; i < 10; i++) {
    const customer = createdCustomers[i % createdCustomers.length];
    const exec = execs[i % execs.length];
    const nextMeeting = new Date(now);
    nextMeeting.setDate(nextMeeting.getDate() + i * 5 - 10);
    await prisma.followUp.create({
      data: {
        id: uuidv4(),
        customerId: customer.id,
        assignedUserId: exec.id,
        nextMeetingDate: nextMeeting,
        remarks: `Follow up with ${customer.name} regarding proposal.`,
        status: followUpStatuses[i % followUpStatuses.length],
        updatedAt: now,
      },
    });
  }
  console.log("10 follow-ups created.");

  // ---- Visitors ----
  console.log("Seeding visitors...");
  const visitorNames = [
    "Rajesh Sharma", "Priya Patel", "Amit Verma", "Sneha Nair",
    "Vikram Mehta", "Ananya Singh", "Ravi Kumar", "Deepa Joshi",
  ];
  for (let i = 0; i < 8; i++) {
    const exec = execs[i % execs.length];
    const inTime = new Date(now);
    inTime.setDate(inTime.getDate() - i);
    await prisma.visitor.create({
      data: {
        id: uuidv4(),
        visitorName: visitorNames[i],
        company: `Visitor Corp ${i + 1}`,
        visitorPhone: `900000${i.toString().padStart(4, "0")}`,
        visitorEmail: `visitor${i + 1}@example.com`,
        purpose: visitPurposes[i % visitPurposes.length],
        inTime,
        outTime: i < 6 ? new Date(inTime.getTime() + 90 * 60 * 1000) : null,
        hostUserId: exec.id,
        updatedAt: now,
      },
    });
  }
  console.log("8 visitors created.");

  // ---- Notifications ----
  console.log("Seeding notifications...");
  const notifTypes = ["visit", "deal", "call", "system"];
  for (let i = 0; i < 8; i++) {
    const exec = execs[i % execs.length];
    await prisma.notification.create({
      data: {
        id: uuidv4(),
        userId: exec.id,
        title: `Notification ${i + 1}`,
        message: `This is a sample notification message #${i + 1}.`,
        type: notifTypes[i % notifTypes.length],
        isRead: i % 3 === 0,
      },
    });
  }
  console.log("8 notifications created.");

  // ---- Audit Logs ----
  console.log("Seeding audit logs...");
  const modules = ["Customer", "Visit", "FollowUp", "Subscription", "User"];
  const actions = ["CREATE", "UPDATE", "DELETE", "VIEW"];
  for (let i = 0; i < 10; i++) {
    const exec = execs[i % execs.length];
    await prisma.auditLog.create({
      data: {
        id: uuidv4(),
        userId: exec.id,
        module: modules[i % modules.length],
        action: actions[i % actions.length],
        details: `User performed ${actions[i % actions.length]} on ${modules[i % modules.length]} record.`,
      },
    });
  }
  console.log("10 audit logs created.");

  // ---- Contacts ----
  console.log("Seeding contacts...");
  const contactsData = [
    { name: "Alice Johnson", email: "alice.johnson@example.com", phone: "555-2001", company: "Tech Innovators Inc.", title: "CTO", status: "Active" },
    { name: "Bob Martinez", email: "bob.martinez@example.com", phone: "555-2002", company: "Global Solutions LLC", title: "VP Sales", status: "Active" },
    { name: "Carol White", email: "carol.white@example.com", phone: "555-2003", company: "Alpha Retailers", title: "Procurement Head", status: "Active" },
    { name: "David Brown", email: "david.brown@example.com", phone: "555-2004", company: "Beta Logistics", title: "Operations Manager", status: "Active" },
    { name: "Eve Davis", email: "eve.davis@example.com", phone: "555-2005", company: "Gamma Healthcare", title: "IT Director", status: "Inactive" },
    { name: "Frank Wilson", email: "frank.wilson@example.com", phone: "555-2006", company: "Delta Manufacturing", title: "Plant Manager", status: "Active" },
    { name: "Grace Lee", email: "grace.lee@example.com", phone: "555-2007", company: "Zeta Finance", title: "CFO", status: "Active" },
    { name: "Henry Taylor", email: "henry.taylor@example.com", phone: "555-2008", company: "Eta Real Estate", title: "Director", status: "Active" },
    { name: "Iris Anderson", email: "iris.anderson@example.com", phone: "555-2009", company: "Theta Energy", title: "Sustainability Lead", status: "Active" },
    { name: "Jack Thomas", email: "jack.thomas@example.com", phone: "555-2010", company: "Epsilon Edu", title: "Head of Learning", status: "Inactive" },
    { name: "Karen Jackson", email: "karen.jackson@example.com", phone: "555-2011", company: "Tech Innovators Inc.", title: "Product Manager", status: "Active" },
    { name: "Liam Harris", email: "liam.harris@example.com", phone: "555-2012", company: "Global Solutions LLC", title: "Senior Engineer", status: "Active" },
  ];
  const createdContacts: any[] = [];
  for (let i = 0; i < contactsData.length; i++) {
    const c = contactsData[i];
    const owner = execs[i % execs.length];
    const contact = await prisma.contact.create({
      data: {
        id: uuidv4(),
        contactCode: `CON-${String(i + 1).padStart(4, "0")}`,
        name: c.name,
        email: c.email,
        phone: c.phone,
        company: c.company,
        title: c.title,
        status: c.status,
        notes: `Contact added via initial seed for ${c.company}.`,
        ownerId: owner.id,
      },
    });
    createdContacts.push(contact);
  }
  console.log(`${createdContacts.length} contacts created.`);

  // ---- Tasks ----
  console.log("Seeding tasks...");
  const taskTitles = [
    "Send proposal to client",
    "Schedule demo call",
    "Follow up on contract",
    "Prepare quarterly report",
    "Update CRM records",
    "Review subscription renewal",
    "Onboarding call with new client",
    "Collect feedback from last visit",
    "Prepare product presentation",
    "Respond to support inquiry",
    "Coordinate with legal for NDA",
    "Set up next discovery meeting",
  ];
  const taskStatuses = ["Open", "In Progress", "Done"];
  const taskPriorities = ["Low", "Medium", "High"];
  for (let i = 0; i < 12; i++) {
    const exec = execs[i % execs.length];
    const contact = i < createdContacts.length ? createdContacts[i] : null;
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + (i * 3 - 6));
    await prisma.task.create({
      data: {
        id: uuidv4(),
        taskCode: `TSK-${String(i + 1).padStart(4, "0")}`,
        title: taskTitles[i],
        description: `Task details: ${taskTitles[i]}. Assigned to ${exec.name}.`,
        status: taskStatuses[i % taskStatuses.length],
        priority: taskPriorities[i % taskPriorities.length],
        dueDate,
        contactId: contact?.id ?? null,
        assignedTo: exec.id,
      },
    });
  }
  console.log("12 tasks created.");

  // ---- Leads ----
  console.log("Seeding leads...");
  const leadNames = [
    "Alice Johnson", "Bob Smith", "Charlie Brown", "Diana Prince",
    "Evan Wright", "Fiona Green", "George Hall", "Hannah Scott",
    "Ian Adams", "Julia Baker", "Kevin Clark", "Laura Davis"
  ];
  const leadStatuses = ["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Won", "Lost"];
  const leadSources = ["Website", "Referral", "SocialMedia", "Email", "Event", "ColdCall", "Partner", "Other"];
  for (let i = 0; i < leadNames.length; i++) {
    const exec = execs[i % execs.length];
    await prisma.lead.create({
      data: {
        id: uuidv4(),
        leadCode: `LEAD-${String(i + 1).padStart(4, "0")}`,
        name: leadNames[i],
        email: `lead${i + 1}@example.com`,
        phone: `555-300${i}`,
        city: ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix"][i % 5],
        status: leadStatuses[i % leadStatuses.length],
        assignedUserId: exec.id,
        leadSource: leadSources[i % leadSources.length],
        notes: `Sample lead created via seed script.`,
        slaStatus: "Pending",
      },
    });
  }
  console.log(`${leadNames.length} leads created.`);

  // ---- Deals ----
  console.log("Seeding deals...");
  const dealNames = [
    "Enterprise CRM License", "SaaS Subscription Annual", "Custom Integration Project",
    "Training & Consulting", "Support Contract Renewal", "Mobile App Development",
    "Data Migration Service", "API Gateway Setup", "Cloud Infrastructure Audit",
    "Security Compliance Review"
  ];
  const dealStatuses = ["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Won", "Lost"];
  for (let i = 0; i < dealNames.length; i++) {
    const exec = execs[i % execs.length];
    const customer = createdCustomers[i % createdCustomers.length];
    const closeDate = new Date(now);
    closeDate.setDate(closeDate.getDate() + 30 + i * 5);
    await prisma.deal.create({
      data: {
        id: uuidv4(),
        dealName: dealNames[i],
        customerId: customer.id,
        dealValue: 10000 + i * 2500,
        expectedCloseDate: closeDate,
        assignedUserId: exec.id,
        status: dealStatuses[i % dealStatuses.length],
        notes: `Sample deal created via seed script.`,
      },
    });
  }
  console.log(`${dealNames.length} deals created.`);

  console.log("\nDatabase seeded successfully! All models populated. ✓");
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
