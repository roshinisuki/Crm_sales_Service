import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

/**
 * GET /api/system-config/allow-direct-quotation
 *
 * Returns the allowDirectQuotationCreation flag for the authenticated user's company.
 * Key pattern: "allowDirectQuotationCreation:{companyId}"
 * Default when absent: false (locked -- RFQ costing lifecycle is enforced).
 *
 * To enable bypass for a company (e.g. for demo), run:
 *   INSERT INTO SystemConfig (key, value)
 *   VALUES ('allowDirectQuotationCreation:{companyId}', 'true')
 * or update the existing row to 'true'.
 */
export async function GET() {
  const user = await verifyAuth();
  if (!user)
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer")
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  if (user.role === "SuperAdmin" && (!user.supportMode || !user.companyId))
    return NextResponse.json(
      { success: false, message: "SuperAdmin must access business data via support/impersonation mode." },
      { status: 403 }
    );

  const companyId = user.companyId;
  if (!companyId) {
    // No company context -- default to locked
    return NextResponse.json({ success: true, value: false });
  }

  const config = await prisma.systemConfig.findUnique({
    where: { key: `allowDirectQuotationCreation:${companyId}` },
  });

  // Default false when key is absent
  const value = config?.value === "true";

  return NextResponse.json({ success: true, value });
}
