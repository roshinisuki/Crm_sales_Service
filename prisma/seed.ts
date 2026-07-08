import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID as uuidv4 } from "crypto";
import { seedServiceWorkspace } from "./seeds/serviceWorkspaceSeed";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();

  console.log("Cleaning up existing database records...");
  // Delete Service Workspace records first (due to foreign key dependencies on Customer and User)
  await prisma.customerAsset.deleteMany({});
  await prisma.serviceEngineer.deleteMany({});
  await prisma.serviceTeam.deleteMany({});
  await prisma.serviceStatus.deleteMany({});
  await prisma.priorityLevel.deleteMany({});
  await prisma.defectType.deleteMany({});
  await prisma.complaintType.deleteMany({});
  await prisma.serviceCategory.deleteMany({});

  // Delete in dependency order (children first, parents last)
  await prisma.callLog.deleteMany({});
  await prisma.communicationLog.deleteMany({});
  await prisma.note.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.negotiation.deleteMany({});
  await prisma.quotation.deleteMany({});
  await prisma.sampleRequest.deleteMany({});
  await prisma.contact.deleteMany({});
  await prisma.followUp.deleteMany({});        // references Lead & Customer
  await prisma.dealStageHistory.deleteMany({});
  await prisma.opportunityDetail.deleteMany({});
  await prisma.proposal.deleteMany({});
  await prisma.approvalHistory.deleteMany({});
  await prisma.deal.deleteMany({});            // references Customer
  await prisma.leadOwnerHistory.deleteMany({});
  await prisma.lead.deleteMany({});            // referenced by FollowUp
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
  await prisma.rFQ.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.supportTicket.deleteMany({});
  await prisma.lostDealAnalysis.deleteMany({});
  await prisma.lossReason.deleteMany({});
  await prisma.competitorProduct.deleteMany({});
  await prisma.competitor.deleteMany({});
  await prisma.forecastEntry.deleteMany({});
  await prisma.customer.deleteMany({});        // referenced by Deal, FollowUp, Visit
  await prisma.cRMDocument.deleteMany({});
  await prisma.approvalRequest.deleteMany({});
  await prisma.productSpecification.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.productCategory.deleteMany({});
  await prisma.quotationItem.deleteMany({});
  await prisma.negotiationRevision.deleteMany({});
  await prisma.purchaseOrderItem.deleteMany({});
  await prisma.proposalVersion.deleteMany({});
  await prisma.pipelineStage.deleteMany({});
  await prisma.exchangeRate.deleteMany({});
  await prisma.emailTemplate.deleteMany({});
  await prisma.whatsAppTemplate.deleteMany({});
  await prisma.leadSource.deleteMany({});
  await prisma.user.deleteMany({});            // referenced by almost everything, but references Company
  await prisma.company.deleteMany({});
  await prisma.systemConfig.deleteMany({});

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

  // ---- Company ----
  console.log("Seeding default company...");
  const defaultCompany = await prisma.company.create({
    data: {
      id: uuidv4(),
      name: "Suki Software Solutions Pvt. Ltd.",
    },
  });
  console.log("Default company created.");

  // ---- Users ----
  console.log("Seeding users...");
  const passwordHash = await bcrypt.hash("password123", 10);
  const usersData = [
    { email: "admin@sukisoftware.com", name: "System Admin", role: "Admin" },
    { email: "lead@sukisoftware.com", name: "Vikram Iyer", role: "SalesManager" },
    { email: "exec1@sukisoftware.com", name: "Arjun Mehta", role: "SalesExecutive" },
    { email: "exec2@sukisoftware.com", name: "Priya Nair", role: "SalesExecutive" },
    { email: "exec3@sukisoftware.com", name: "Karthik Reddy", role: "SalesExecutive" },
    { email: "exec4@sukisoftware.com", name: "Deepa Krishnan", role: "SalesExecutive" },
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
        companyId: defaultCompany.id,
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
    { code: "CUST-001", name: "Tata Motors Ltd.", email: "procurement@tatamotors.com", phone: "+91-9876501001", city: "Pune", status: "Active" },
    { code: "CUST-002", name: "Ashok Leyland Industries", email: "supply@ashokleyland.com", phone: "+91-9845501002", city: "Chennai", status: "Active" },
    { code: "CUST-003", name: "L&T Heavy Engineering", email: "vendor@larsentoubro.com", phone: "+91-9823501003", city: "Mumbai", status: "Active" },
    { code: "CUST-004", name: "JSW Steel Ltd.", email: "ops@jswsteel.com", phone: "+91-9912501004", city: "Bangalore", status: "Active" },
    { code: "CUST-005", name: "TVS Motor Company", email: "procurement@tvsmotors.com", phone: "+91-9898501005", city: "Hosur", status: "Inactive" },
    { code: "CUST-006", name: "Bharat Forge Ltd.", email: "supply@bharatforge.com", phone: "+91-9867501006", city: "Pune", status: "Active" },
    { code: "CUST-007", name: "Amara Raja Batteries", email: "contact@amararaja.com", phone: "+91-9876501007", city: "Hyderabad", status: "Inactive" },
    { code: "CUST-008", name: "Bosch India Pvt. Ltd.", email: "vendor@boschindia.com", phone: "+91-9845501008", city: "Bangalore", status: "Active" },
    { code: "CUST-009", name: "Mahindra & Mahindra", email: "procurement@mahindra.com", phone: "+91-9823501009", city: "Mumbai", status: "Active" },
    { code: "CUST-010", name: "Kirloskar Electric Co.", email: "supply@kirloskar.com", phone: "+91-9912501010", city: "Bangalore", status: "Active" },
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
        companyId: defaultCompany.id,
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
        companyId: defaultCompany.id,
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
        companyId: defaultCompany.id,
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
        companyId: defaultCompany.id,
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
        companyId: defaultCompany.id,
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
    { name: "Rajesh Sharma", email: "rajesh.sharma@tatamotors.com", phone: "+91-9876502001", company: "Tata Motors Ltd.", title: "VP Procurement", status: "Active" },
    { name: "Anita Desai", email: "anita.desai@ashokleyland.com", phone: "+91-9845502002", company: "Ashok Leyland Industries", title: "Supply Chain Head", status: "Active" },
    { name: "Sunil Nair", email: "sunil.nair@larsentoubro.com", phone: "+91-9823502003", company: "L&T Heavy Engineering", title: "Technical Director", status: "Active" },
    { name: "Meenakshi Pillai", email: "meenakshi@jswsteel.com", phone: "+91-9912502004", company: "JSW Steel Ltd.", title: "Operations Manager", status: "Active" },
    { name: "Ganesh Iyer", email: "ganesh.iyer@tvsmotors.com", phone: "+91-9898502005", company: "TVS Motor Company", title: "Purchase Manager", status: "Inactive" },
    { name: "Kavitha Rajan", email: "kavitha@bharatforge.com", phone: "+91-9867502006", company: "Bharat Forge Ltd.", title: "Plant Manager", status: "Active" },
    { name: "Mohan Krishnan", email: "mohan@amararaja.com", phone: "+91-9876502007", company: "Amara Raja Batteries", title: "R&D Head", status: "Active" },
    { name: "Sunita Kapoor", email: "sunita.kapoor@boschindia.com", phone: "+91-9845502008", company: "Bosch India Pvt. Ltd.", title: "Quality Director", status: "Active" },
    { name: "Prakash Rao", email: "prakash.rao@mahindra.com", phone: "+91-9823502009", company: "Mahindra & Mahindra", title: "CFO", status: "Active" },
    { name: "Divya Menon", email: "divya.menon@kirloskar.com", phone: "+91-9912502010", company: "Kirloskar Electric Co.", title: "Sales Director", status: "Active" },
    { name: "Ramesh Patel", email: "ramesh.patel@tatamotors.com", phone: "+91-9876502011", company: "Tata Motors Ltd.", title: "IT Manager", status: "Active" },
    { name: "Lakshmi Venkat", email: "lakshmi.v@jswsteel.com", phone: "+91-9845502012", company: "JSW Steel Ltd.", title: "Senior Engineer", status: "Active" },
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
  const leadsData = [
    { name: "Ravi Kumar",     email: "ravi.kumar@tatamotors.com",       phone: "+91-9876543210", city: "Pune",        source: "Exhibition",     notes: "Interested in hydraulic press maintenance contract. Met at IMTEX 2026." },
    { name: "Suresh Reddy",   email: "suresh.reddy@ashokleyland.com",   phone: "+91-9845123456", city: "Chennai",     source: "Referral",      notes: "Enquiry for CNC machine parts supply — referred by Bosch India account." },
    { name: "Anita Sharma",   email: "anita.sharma@larsen.com",         phone: "+91-9823456789", city: "Mumbai",     source: "Cold Call",     notes: "Requires custom steel fabrication for auto components — urgent requirement Q3." },
    { name: "Vikram Singh",   email: "vikram.singh@jswsteel.com",       phone: "+91-9912345678", city: "Bangalore",  source: "LinkedIn",      notes: "Looking for industrial automation vendor. Currently evaluating 3 suppliers." },
    { name: "Priya Nair",     email: "priya.nair@tvsmotors.com",        phone: "+91-9898765432", city: "Hosur",      source: "Website",       notes: "Submitted RFQ for 500 units of precision-machined components per month." },
    { name: "Arun Kumar",     email: "arun.kumar@bharatforge.com",      phone: "+91-9867890123", city: "Pune",        source: "WhatsApp",      notes: "Forging process upgrade enquiry. Wants technical demo at plant." },
    { name: "Karthik Iyer",   email: "karthik.iyer@amararaja.com",      phone: "+91-9876012345", city: "Hyderabad",  source: "Email Campaign",notes: "Battery assembly line equipment requirement — timeline: 6 months." },
    { name: "Deepa Menon",    email: "deepa.menon@boschindia.com",      phone: "+91-9845234567", city: "Bangalore",  source: "Referral",      notes: "Quality control system upgrade for fuel injector line. Budget pre-approved." },
    { name: "Rajesh Patel",   email: "rajesh.patel@mahindra.com",       phone: "+91-9823678901", city: "Mumbai",     source: "Exhibition",     notes: "Tractor transmission component sourcing. Visited stall at Auto Expo 2026." },
    { name: "Sunita Kapoor",  email: "sunita.kapoor@kirloskar.com",     phone: "+91-9912456789", city: "Bangalore",  source: "Cold Call",     notes: "Motor winding upgrade project. Technical evaluation stage." },
    { name: "Mohit Jain",     email: "mohit.jain@cummins.co.in",        phone: "+91-9867012345", city: "Pune",        source: "LinkedIn",      notes: "Generator set components — annual contract potential ₹45L." },
    { name: "Kavitha Rajan",  email: "kavitha.rajan@thermax.com",       phone: "+91-9876789012", city: "Pune",        source: "Website",       notes: "Boiler maintenance services RFQ. Decision expected by end of month." },
  ];
  const leadStatuses = ["New", "Contacted", "FollowUpDue", "SQL", "Qualified", "Converted", "Lost"];
  const createdLeads: { id: string; name: string }[] = [];
  for (let i = 0; i < leadsData.length; i++) {
    const exec = execs[i % execs.length];
    const ld = leadsData[i];
    const leadId = uuidv4();
    await prisma.lead.create({
      data: {
        id: leadId,
        leadCode: `LEAD-${String(i + 1).padStart(4, "0")}`,
        name: ld.name,
        email: ld.email,
        phone: ld.phone,
        city: ld.city,
        status: leadStatuses[i % leadStatuses.length],
        assignedUserId: exec.id,
        leadSource: ld.source,
        notes: ld.notes,
        slaStatus: "Pending",
        companyId: defaultCompany.id,
      },
    });
    createdLeads.push({ id: leadId, name: ld.name });
  }
  console.log(`${leadsData.length} leads created.`);

  // ---- Lead Follow-ups (time-distributed for correct filter behaviour) ----
  console.log("Seeding lead follow-ups...");
  // daysOffset > 0 → future (shows in Follow-up Due filter)
  // daysOffset = 0 → today  (shows in Follow-up Due filter)
  // daysOffset < 0 → past   (Pending = Overdue; Completed = ignored by filters)
  const leadFuData = [
    // ── FUTURE / TODAY → Follow-Up Due ──
    { idx: 0, days:  1, status: "Pending",   remarks: "Call to finalise hydraulic press maintenance scope at Tata Motors." },
    { idx: 1, days:  2, status: "Pending",   remarks: "Site visit at Ashok Leyland Chennai — CNC parts spec discussion." },
    { idx: 2, days:  5, status: "Pending",   remarks: "Follow up on steel fabrication quotation sent to L&T Mumbai." },
    { idx: 4, days:  3, status: "Pending",   remarks: "Demo call for precision-machined components — TVS Hosur plant." },
    { idx: 6, days:  0, status: "Pending",   remarks: "TODAY: Battery assembly line equipment call — Amara Raja." },
    // ── PAST + Pending → Overdue ──
    { idx: 3, days: -3, status: "Pending",   remarks: "OVERDUE: Industrial automation shortlist — JSW Bangalore not responded." },
    { idx: 5, days: -5, status: "Pending",   remarks: "OVERDUE: Forging demo at Bharat Forge Pune — needs urgent reschedule." },
    { idx: 7, days: -1, status: "Pending",   remarks: "OVERDUE: QC system callback for Bosch Bangalore fuel injector line." },
    // ── PAST + Completed → should NOT appear in Due or Overdue ──
    { idx: 8, days: -7, status: "Completed", remarks: "DONE: Auto Expo follow-up with Mahindra Mumbai — positive outcome." },
    { idx: 9, days: -2, status: "Completed", remarks: "DONE: Kirloskar motor winding initial call — quote sent." },
    { idx: 10, days: -4, status: "Completed", remarks: "DONE: Cummins Pune generator specs confirmed — proposal stage." },
  ];
  for (const fu of leadFuData) {
    const lead = createdLeads[fu.idx];
    if (!lead) continue;
    const exec = execs[fu.idx % execs.length];
    const meetingDate = new Date(now);
    meetingDate.setDate(meetingDate.getDate() + fu.days);
    await prisma.followUp.create({
      data: {
        id: uuidv4(),
        leadId: lead.id,
        assignedUserId: exec.id,
        nextMeetingDate: meetingDate,
        remarks: fu.remarks,
        status: fu.status,
        companyId: defaultCompany.id,
        updatedAt: now,
      },
    });
  }
  console.log(`${leadFuData.length} lead follow-ups created.`);

  // ---- Deals ----
  console.log("Seeding deals...");
  const dealNames = [
    "CNC Machine Parts Supply — Tata Motors", "Hydraulic Press Maintenance Contract", "Precision Components Annual AMC",
    "Steel Fabrication Q3 Order — L&T", "Industrial Automation Pilot — JSW", "Forging Equipment Upgrade — Bharat Forge",
    "Battery Assembly Line Equipment", "Quality Control System — Bosch", "Tractor Component Sourcing — Mahindra",
    "Generator Set Components — Cummins Annual"
  ];
  const dealStatuses = ["SalesOpportunity", "Won", "Lost"];
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
        companyId: defaultCompany.id,
      },
    });
  }
  console.log(`${dealNames.length} deals created.`);

  // ---- Communication Logs (Calls, Meetings, Notes, Emails) ----
  console.log("Seeding communication logs (activities)...");
  const commLogs = [
    // Calls
    { channel: "Call", direction: "Outbound", status: "Completed", content: "Initial discussion with client about project requirements and timeline.", duration: 15, outcome: "Interested — requested proposal" },
    { channel: "Call", direction: "Inbound", status: "Completed", content: "Client called to enquire about pricing for annual maintenance contract.", duration: 8, outcome: "Quote requested" },
    { channel: "Call", direction: "Outbound", status: "NoAnswer", content: "Follow-up call regarding hydraulic press demo scheduling.", duration: 0, outcome: "No answer — will retry tomorrow" },
    { channel: "Call", direction: "Outbound", status: "Completed", content: "Contract renewal discussion with existing client.", duration: 22, outcome: "Renewal confirmed for Q3" },
    // Meetings
    { channel: "Meeting", direction: "Outbound", status: "Completed", content: "Product demo session for CNC machine parts supply.", duration: 45, location: "Client office, Pune", mode: "In-person", outcome: "Positive — moving to proposal stage" },
    { channel: "Meeting", direction: "Outbound", status: "Scheduled", content: "Quarterly review meeting with key accounts.", duration: 60, location: "Virtual", mode: "Virtual", outcome: null },
    { channel: "Meeting", direction: "Inbound", status: "Completed", content: "Onboarding session for new enterprise client.", duration: 90, location: "Client HQ, Bangalore", mode: "In-person", outcome: "Successfully onboarded" },
    // Notes
    { channel: "Note", direction: "Outbound", status: "Completed", content: "Internal note: Client prefers email communication over calls. Update preference in CRM." },
    { channel: "Note", direction: "Outbound", status: "Completed", content: "Competitor analysis completed. Pricing is 12% lower — need management approval for discount." },
    { channel: "Note", direction: "Outbound", status: "Completed", content: "Site visit observations: Plant capacity at 85%. Expansion planned for Q4." },
    // Emails
    { channel: "Email", direction: "Outbound", status: "Delivered", content: "Proposal sent for precision components annual AMC. Attached: quote_v2.pdf" },
    { channel: "Email", direction: "Outbound", status: "Delivered", content: "Reminder: Demo scheduled for tomorrow at 11:00 AM IST. Meeting link attached." },
    { channel: "Email", direction: "Inbound", status: "Delivered", content: "Client confirmed receipt of proposal. Will review internally and respond by Friday." },
  ];
  for (let i = 0; i < commLogs.length; i++) {
    const log = commLogs[i];
    const customer = createdCustomers[i % createdCustomers.length];
    const lead = createdLeads[i % createdLeads.length];
    const exec = execs[i % execs.length];
    const sentAt = new Date(now);
    sentAt.setDate(sentAt.getDate() - (i % 7));
    await prisma.communicationLog.create({
      data: {
        id: uuidv4(),
        customerId: customer.id,
        leadId: lead.id,
        channel: log.channel,
        direction: log.direction,
        status: log.status,
        content: log.content,
        sentByUserId: exec.id,
        sentAt,
        duration: log.duration ?? null,
        location: log.location ?? null,
        mode: log.mode ?? null,
        outcome: log.outcome ?? null,
        companyId: defaultCompany.id,
      },
    });
  }
  console.log(`${commLogs.length} communication logs created.`);

  // ---- Notes (for Leads, Contacts, Deals) ----
  console.log("Seeding notes...");
  const notesData = [
    { entityType: "LEAD", content: "Lead came through website enquiry. Interested in enterprise plan. Budget approved.", createdByIdx: 0 },
    { entityType: "LEAD", content: "Follow-up required next week. Decision maker is on leave until Monday.", createdByIdx: 1 },
    { entityType: "CONTACT", content: "Prefers morning calls before 10 AM. Do not call on weekends.", createdByIdx: 2 },
    { entityType: "CONTACT", content: "Key influencer in procurement committee. Maintain relationship.", createdByIdx: 3 },
    { entityType: "LEAD", content: "Met at Auto Expo 2026. Strong interest in automation solutions.", createdByIdx: 2 },
    { entityType: "CONTACT", content: "Technical evaluation in progress. Waiting for pilot approval.", createdByIdx: 3 },
  ];
  for (let i = 0; i < notesData.length; i++) {
    const note = notesData[i];
    const exec = execs[note.createdByIdx % execs.length];
    let entityId = "";
    if (note.entityType === "LEAD") entityId = createdLeads[i % createdLeads.length].id;
    else if (note.entityType === "CONTACT") entityId = createdContacts[i % createdContacts.length].id;
    await prisma.note.create({
      data: {
        id: uuidv4(),
        content: note.content,
        createdById: exec.id,
        entityType: note.entityType,
        entityId,
        companyId: defaultCompany.id,
      },
    });
  }
  console.log(`${notesData.length} notes created.`);

  // ---- Additional Follow-ups (realistic mix for filter testing) ----
  console.log("Seeding additional follow-ups...");
  const extraFollowUps = [
    // Pending — future dates
    { customerIdx: 0, days: 2, status: "Pending", remarks: "Call to confirm demo slot for hydraulic press maintenance." },
    { customerIdx: 2, days: 5, status: "Pending", remarks: "Follow up on steel fabrication quotation — client reviewing internally." },
    { customerIdx: 4, days: 1, status: "Pending", remarks: "Check TVS Hosur plant visit availability for precision components demo." },
    { customerIdx: 6, days: 7, status: "Pending", remarks: "Amara Raja battery assembly line — waiting for technical specs from client." },
    // Overdue — past dates with Pending status
    { customerIdx: 1, days: -3, status: "Pending", remarks: "OVERDUE: Ashok Leyland CNC parts follow-up — no response after 3 attempts." },
    { customerIdx: 3, days: -5, status: "Pending", remarks: "OVERDUE: JSW Steel industrial automation — client delayed decision." },
    { customerIdx: 5, days: -2, status: "Pending", remarks: "OVERDUE: Bharat Forge forging demo — executive unavailable, needs reschedule." },
    { customerIdx: 7, days: -4, status: "Pending", remarks: "OVERDUE: Bosch India QC system — budget approval pending from finance." },
    // Completed — past dates with Completed status
    { customerIdx: 8, days: -1, status: "Completed", remarks: "DONE: Mahindra tractor component sourcing — proposal accepted." },
    { customerIdx: 9, days: -6, status: "Completed", remarks: "DONE: Kirloskar motor winding — initial technical call completed, quote sent." },
  ];
  for (const fu of extraFollowUps) {
    const customer = createdCustomers[fu.customerIdx % createdCustomers.length];
    const exec = execs[fu.customerIdx % execs.length];
    const meetingDate = new Date(now);
    meetingDate.setDate(meetingDate.getDate() + fu.days);
    await prisma.followUp.create({
      data: {
        id: uuidv4(),
        customerId: customer.id,
        assignedUserId: exec.id,
        nextMeetingDate: meetingDate,
        remarks: fu.remarks,
        status: fu.status,
        companyId: defaultCompany.id,
        updatedAt: now,
      },
    });
  }
  console.log(`${extraFollowUps.length} additional follow-ups created.`);

  // ---- Additional Tasks (with overdue, pending, completed mix) ----
  console.log("Seeding additional tasks...");
  const extraTasks = [
    { title: "Prepare proposal for Tata Motors AMC", status: "Pending", priority: "High", days: 2 },
    { title: "Client follow-up call — Ashok Leyland", status: "Pending", priority: "High", days: -1 },
    { title: "Update CRM data for Q2 leads", status: "Completed", priority: "Medium", days: -3 },
    { title: "Schedule demo for JSW Steel automation", status: "Pending", priority: "Medium", days: 5 },
    { title: "Contract review with legal — Bosch India", status: "Pending", priority: "High", days: 1 },
    { title: "Collect feedback from Bharat Forge visit", status: "Completed", priority: "Low", days: -2 },
    { title: "Prepare quarterly sales report", status: "Pending", priority: "Medium", days: 7 },
    { title: "Onboarding documentation for new client", status: "Pending", priority: "Low", days: 3 },
    { title: "Respond to RFQ from Kirloskar Electric", status: "Overdue", priority: "High", days: -2 },
    { title: "Update product catalogue with new SKUs", status: "Completed", priority: "Low", days: -5 },
  ];
  for (let i = 0; i < extraTasks.length; i++) {
    const t = extraTasks[i];
    const exec = execs[i % execs.length];
    const contact = i < createdContacts.length ? createdContacts[i] : null;
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + t.days);
    await prisma.task.create({
      data: {
        id: uuidv4(),
        taskCode: `TSK-${String(13 + i).padStart(4, "0")}`,
        title: t.title,
        description: t.title,
        status: t.status,
        priority: t.priority,
        dueDate,
        contactId: contact?.id ?? null,
        assignedTo: exec.id,
        companyId: defaultCompany.id,
      },
    });
  }
  console.log(`${extraTasks.length} additional tasks created.`);

  // ---- Pipeline Stages (Variant 2) ----
  console.log("Seeding default pipeline stages...");
  const defaultStages = [
    { name: 'New Lead', order: 1, color: '#378ADD' },
    { name: 'Qualified', order: 2, color: '#10B981' },
    { name: 'Requirement Gathering', order: 3, color: '#F59E0B' },
    { name: 'Technical Discussion', order: 4, color: '#8B5CF6' },
    { name: 'Meeting Scheduled', order: 5, color: '#EC4899' },
    { name: 'Demo Conducted', order: 6, color: '#06B6D4' },
    { name: 'Proposal Sent', order: 7, color: '#84CC16' },
    { name: 'Won', order: 8, color: '#22C55E' },
    { name: 'Lost', order: 9, color: '#EF4444' },
  ];
  
  // Get all companies (should be just one in this setup, but we'll handle multiple)
  const companies = await prisma.company.findMany();
  for (const company of companies) {
    for (const stage of defaultStages) {
      await prisma.pipelineStage.create({
        data: {
          id: uuidv4(),
          name: stage.name,
          order: stage.order,
          color: stage.color,
          isActive: true,
          companyId: company.id,
        },
      });
    }
  }
  console.log(`${defaultStages.length} pipeline stages seeded for ${companies.length} company/companies.`);

  // ---- Service Workspace Seeding ----
  await seedServiceWorkspace(prisma);

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
