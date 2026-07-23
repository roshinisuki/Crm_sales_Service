import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.KEY_ACCOUNTS, "GET /api/key-accounts");
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const importance = searchParams.get("importance");
  const view = searchParams.get("view");
  const q = searchParams.get("q");

  const where: any = { companyId: user.companyId };
  if (importance && importance !== "All") where.strategicImportance = importance;
  if (q) where.customer = { name: { contains: q } };

  const keyAccounts = await prisma.keyAccount.findMany({
    where,
    orderBy: view === "revenue" ? { revenuePotential: "desc" } : { updatedAt: "desc" },
    include: {
      customer: {
        select: { id: true, name: true, city: true, phone: true, email: true, customerCode: true,
          assignedUser: { select: { id: true, name: true } },
          deals: { where: { status: "Won" }, select: { dealValue: true } },
          contacts: { where: { status: "Active", deletedAt: null }, select: { id: true, name: true, contactType: true, designation: true, isPrimary: true } },
        },
      },
      accountManager: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  // Add achieved revenue + contacts count
  const data = keyAccounts.map(ka => ({
    ...ka,
    achievedRevenue: ka.customer.deals?.reduce((s, d) => s + d.dealValue, 0) ?? 0,
    contactsCount: ka.customer.contacts?.length ?? 0,
  }));

  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!["Admin", "SalesManager"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }
  const guard = enforceModuleGuard(user, MODULE_KEYS.KEY_ACCOUNTS, "POST /api/key-accounts");
  if (guard) return guard;

  const body = await request.json();
  if (!body.customerId) return NextResponse.json({ success: false, message: "Customer is required" }, { status: 400 });
  if (!body.accountManagerId) return NextResponse.json({ success: false, message: "Account Manager is required" }, { status: 400 });

  // Check if already a key account
  const existing = await prisma.keyAccount.findFirst({
    where: { customerId: body.customerId, companyId: user.companyId },
  });
  if (existing) return NextResponse.json({ success: false, message: "Customer is already a key account" }, { status: 400 });

  const keyAccount = await prisma.keyAccount.create({
    data: {
      customerId: body.customerId,
      accountManagerId: body.accountManagerId,
      revenuePotential: body.revenuePotential ? parseFloat(body.revenuePotential) : null,
      strategicImportance: body.strategicImportance || "High",
      relationshipStatus: body.relationshipStatus || null,
      nextReviewDate: body.nextReviewDate ? new Date(body.nextReviewDate) : null,
      notes: body.notes || null,
      companyId: user.companyId,
    },
  });

  return NextResponse.json({ success: true, data: keyAccount });
}
