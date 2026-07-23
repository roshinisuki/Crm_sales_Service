import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET /api/visits/key-account-compliance
// Returns key accounts with their last visit date and days since visit
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.CUSTOMER_VISITS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/visits/key-account-compliance");
  if (guard) return guard;
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  // Fetch key accounts
  const keyAccounts = await prisma.customer.findMany({
    where: {
      isKeyAccountV2: true,
      deletedAt: null,
      companyId: user.companyId,
    },
    select: {
      id: true,
      name: true,
      customerCode: true,
      city: true,
      assignedUserId: true,
      assignedUser: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  // Fetch last completed visit for each key account
  const accountIds = keyAccounts.map((a) => a.id);
  const lastVisits = await prisma.customerVisit.findMany({
    where: {
      customerId: { in: accountIds },
      status: "COMPLETED",
      deletedAt: null,
    },
    select: {
      customerId: true,
      plannedDate: true,
      checkInTime: true,
    },
    orderBy: { checkInTime: "desc" },
  });

  // Build a map of last visit per customer
  const lastVisitMap = new Map<string, Date>();
  for (const v of lastVisits) {
    const date = v.checkInTime || v.plannedDate;
    if (date) {
      const existing = lastVisitMap.get(v.customerId);
      if (!existing || new Date(date) > new Date(existing)) {
        lastVisitMap.set(v.customerId, new Date(date));
      }
    }
  }

  const now = new Date();
  const compliance = keyAccounts.map((account) => {
    const lastVisit = lastVisitMap.get(account.id);
    const daysSinceVisit = lastVisit
      ? Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      accountId: account.id,
      accountName: account.name,
      customerCode: account.customerCode,
      city: account.city,
      salesOwner: account.assignedUser?.name || "Unassigned",
      salesOwnerId: account.assignedUserId,
      lastVisitDate: lastVisit || null,
      daysSinceVisit,
    };
  });

  // Sort by days since visit descending (most overdue first)
  compliance.sort((a, b) => {
    if (a.daysSinceVisit == null) return -1;
    if (b.daysSinceVisit == null) return 1;
    return b.daysSinceVisit - a.daysSinceVisit;
  });

  return NextResponse.json({ success: true, data: compliance });
}
