import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

const VALID_ROLES = [
  "Decision Maker",
  "Technical Evaluator",
  "Influencer",
  "Gatekeeper",
  "Finance Approver",
];

// GET /api/opportunities/[id]/contacts — list stakeholders
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  // SuperAdmin must use support/impersonation mode
  if (user.role === "SuperAdmin" && (!user.supportMode || !user.companyId)) {
    return NextResponse.json({ success: false, message: "SuperAdmin must access business data via support/impersonation mode." }, { status: 403 });
  }

  const { id } = await params;

  const stakeholders = await prisma.opportunityContact.findMany({
    where: { dealId: id },
    include: {
      contact: {
        select: { id: true, name: true, designation: true, email: true, phone: true, company: true },
      },
    },
    orderBy: { isPrimary: "desc" },
  });

  return NextResponse.json({ success: true, data: stakeholders });
}

// POST /api/opportunities/[id]/contacts — add stakeholder
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  // SuperAdmin must use support/impersonation mode
  if (user.role === "SuperAdmin" && (!user.supportMode || !user.companyId)) {
    return NextResponse.json({ success: false, message: "SuperAdmin must access business data via support/impersonation mode." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { contact_id, stakeholder_role, is_primary } = body;

  if (!contact_id) {
    return NextResponse.json({ success: false, message: "contact_id is required" }, { status: 400 });
  }

  const role = stakeholder_role || "Influencer";
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json(
      { success: false, message: `Invalid stakeholder_role. Valid roles: ${VALID_ROLES.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate the deal exists and belongs to tenant
  const deal = await prisma.deal.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!deal) return NextResponse.json({ success: false, message: "Opportunity not found" }, { status: 404 });

  // Validate the contact exists
  const contact = await prisma.contact.findUnique({ where: { id: contact_id } });
  if (!contact) return NextResponse.json({ success: false, message: "Contact not found" }, { status: 404 });

  // If is_primary, unset any existing primary
  if (is_primary) {
    await prisma.opportunityContact.updateMany({
      where: { dealId: id, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  // Check for existing mapping (upsert)
  const existing = await prisma.opportunityContact.findFirst({
    where: { dealId: id, contactId: contact_id },
  });

  let stakeholder;
  if (existing) {
    stakeholder = await prisma.opportunityContact.update({
      where: { id: existing.id },
      data: { stakeholderRole: role, isPrimary: is_primary || false },
      include: { contact: { select: { id: true, name: true, designation: true, email: true, phone: true } } },
    });
  } else {
    stakeholder = await prisma.opportunityContact.create({
      data: {
        dealId: id,
        contactId: contact_id,
        stakeholderRole: role,
        isPrimary: is_primary || false,
      },
      include: { contact: { select: { id: true, name: true, designation: true, email: true, phone: true } } },
    });
  }

  await logAudit(user.id, "Opportunity", "AddStakeholder", `Added stakeholder ${contact.name} (${role}) to opportunity "${deal.dealName}"`, {
    resourceId: id,
    newState: { contactId: contact_id, stakeholderRole: role, isPrimary: is_primary || false },
    context: extractAuditContext(request),
    severity: "INFO",
  });

  return NextResponse.json({ success: true, data: stakeholder }, { status: 201 });
}

// DELETE /api/opportunities/[id]/contacts?contactId=xxx — remove stakeholder
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const stakeholderId = searchParams.get("stakeholderId");
  const contactId = searchParams.get("contactId");

  if (!stakeholderId && !contactId) {
    return NextResponse.json({ success: false, message: "stakeholderId or contactId query param is required" }, { status: 400 });
  }

  const where: any = { dealId: id };
  if (stakeholderId) where.id = stakeholderId;
  if (contactId) where.contactId = contactId;

  const existing = await prisma.opportunityContact.findFirst({ where });
  if (!existing) return NextResponse.json({ success: false, message: "Stakeholder not found" }, { status: 404 });

  await prisma.opportunityContact.delete({ where: { id: existing.id } });

  await logAudit(user.id, "Opportunity", "RemoveStakeholder", `Removed stakeholder from opportunity ${id}`, {
    resourceId: id,
    previousState: { contactId: existing.contactId, stakeholderRole: existing.stakeholderRole },
    context: extractAuditContext(request),
    severity: "WARN",
  });

  return NextResponse.json({ success: true, message: "Stakeholder removed" });
}
