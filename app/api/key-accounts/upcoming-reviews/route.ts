import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(_request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.KEY_ACCOUNTS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/key-accounts/upcoming-reviews");
  if (guard) return guard;

  const today = new Date();
  const twoWeeksFromNow = new Date(today);
  twoWeeksFromNow.setDate(today.getDate() + 14);

  const keyAccounts = await prisma.keyAccount.findMany({
    where: {
      companyId: user.companyId,
      nextReviewDate: {
        gte: today,
        lte: twoWeeksFromNow,
      },
    },
    include: {
      customer: {
        select: { id: true, name: true, city: true, phone: true, email: true },
      },
      accountManager: { select: { id: true, name: true, email: true } },
    },
    orderBy: { nextReviewDate: "asc" },
  });

  return NextResponse.json({ success: true, data: keyAccounts });
}
