import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET /api/opportunities/[id]/quotation-context
// Returns context needed to pre-fill a new quotation from an opportunity
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

  const dealRaw = await prisma.deal.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      customer: {
        include: { contacts: { orderBy: { createdAt: "asc" } } },
      },
      opportunityContacts: {
        include: { contact: true },
        orderBy: { addedAt: "asc" },
      },
      opportunityDetail: true,
      rfqs: { take: 1 },
      quotations: { where: { status: "Accepted" }, take: 1 },
    },
  } as any);

  const deal = dealRaw as any;

  if (!deal) return NextResponse.json({ success: false, message: "Opportunity not found" }, { status: 404 });

  // Row-level scope check
  if (user.role === "SalesExecutive" && deal.assignedUserId !== user.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const stakeholderContacts = deal.opportunityContacts.map((oc: any) => ({
    id: oc.contact.id,
    name: oc.contact.name,
    designation: oc.contact.designation || "",
    email: oc.contact.email || "",
    phone: oc.contact.phone || "",
    isPrimary: oc.isPrimary,
  }));

  const primaryAccountContact = deal.customer.contacts.find((c: any) => c.isPrimary) || deal.customer.contacts[0];

  const contacts =
    stakeholderContacts.length > 0
      ? stakeholderContacts
      : primaryAccountContact
      ? [
          {
            id: primaryAccountContact.id,
            name: primaryAccountContact.name,
            designation: primaryAccountContact.designation || "",
            email: primaryAccountContact.email || "",
            phone: primaryAccountContact.phone || "",
            isPrimary: true,
          },
        ]
      : [];

  return NextResponse.json({
    success: true,
    data: {
      opportunityId: deal.id,
      opportunityCode: deal.opportunityCode || deal.id,
      dealTitle: deal.dealName,
      estimatedValue: deal.dealValue,
      accountId: deal.customer.id,
      accountName: deal.customer.name,
      accountGstin: deal.customer.gstin || null,
      primaryContactId: contacts.find((c: any) => c.isPrimary)?.id || contacts[0]?.id || null,
      primaryContactName: contacts.find((c: any) => c.isPrimary)?.name || contacts[0]?.name || null,
      contacts,
      linkedRfqId: deal.rfqs?.[0]?.id || null,
      hasAcceptedQuotation: deal.quotations?.length > 0,
    },
  });
}
