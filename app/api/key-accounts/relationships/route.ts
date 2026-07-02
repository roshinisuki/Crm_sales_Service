import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(_request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const keyAccounts = await prisma.keyAccount.findMany({
    where: { companyId: user.companyId },
    include: {
      customer: {
        select: { id: true, name: true, city: true, phone: true, email: true },
      },
      accountManager: { select: { id: true, name: true, email: true } },
    },
    orderBy: { strategicImportance: "desc" },
  });

  // Get contacts for all customers
  const customerIds = keyAccounts.map(ka => ka.customerId);
  const contacts = await prisma.contact.findMany({
    where: { customerId: { in: customerIds }, status: "Active", deletedAt: null },
    select: { id: true, name: true, email: true, phone: true, contactType: true, designation: true, isPrimary: true, customerId: true },
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
  });

  const data = keyAccounts.map(ka => {
    const customerContacts = contacts.filter(c => c.customerId === ka.customerId);
    return {
      id: ka.id,
      customerName: ka.customer.name,
      accountManager: ka.accountManager?.name || "—",
      revenuePotential: ka.revenuePotential,
      strategicImportance: ka.strategicImportance,
      relationshipStatus: ka.relationshipStatus,
      contacts: customerContacts.reduce((acc: Record<string, any[]>, contact) => {
        const type = contact.contactType || "Other";
        if (!acc[type]) acc[type] = [];
        acc[type].push(contact);
        return acc;
      }, {} as Record<string, any[]>),
    };
  });

  return NextResponse.json({ success: true, data });
}
