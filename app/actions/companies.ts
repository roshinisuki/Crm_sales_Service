/**
 * companies.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Company management actions for SuperAdmin.
 * Only SuperAdmin can create, update, or delete companies.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

/**
 * Create a new company (SuperAdmin only)
 */
export async function createCompanyAction(data: {
  name: string;
  variant?: number;
  baseCurrency?: string;
  domain?: string;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role !== "SuperAdmin") {
      return { success: false, message: "Unauthorized: SuperAdmin only" };
    }

    const { name, variant = 1, baseCurrency = "INR", domain } = data;

    if (!name) {
      return { success: false, message: "Company name is required" };
    }

    // Check for duplicate name
    const existing = await prisma.company.findFirst({
      where: { name: name.trim() }
    });
    if (existing) {
      return { success: false, message: "A company with this name already exists" };
    }

    // Check for duplicate domain if provided
    if (domain) {
      const existingDomain = await prisma.company.findFirst({
        where: { domain: domain.trim().toLowerCase() }
      });
      if (existingDomain) {
        return { success: false, message: "A company with this domain already exists" };
      }
    }

    const company = await prisma.company.create({
      data: {
        name: name.trim(),
        variant,
        baseCurrency,
        domain: domain ? domain.trim().toLowerCase() : null,
      },
    });

    await logAudit(
      userPayload.id,
      "Company",
      "Create",
      `Created company "${company.name}" (Variant ${company.variant}, Currency: ${company.baseCurrency})${domain ? `, Domain: ${company.domain}` : ""})`
    );

    return {
      success: true,
      data: {
        ...company,
        createdAt: company.createdAt.toISOString(),
        updatedAt: company.updatedAt.toISOString(),
      },
      message: "Company created successfully",
    };
  } catch (error) {
    console.error("createCompanyAction error:", error);
    return { success: false, message: "Failed to create company" };
  }
}

/**
 * Update company details (SuperAdmin only)
 */
export async function updateCompanyAction(companyId: string, data: {
  name?: string;
  variant?: number;
  baseCurrency?: string;
  domain?: string;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role !== "SuperAdmin") {
      return { success: false, message: "Unauthorized: SuperAdmin only" };
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      return { success: false, message: "Company not found" };
    }

    const { name, variant, baseCurrency, domain } = data;
    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (variant !== undefined) updateData.variant = variant;
    if (baseCurrency) updateData.baseCurrency = baseCurrency;
    if (domain !== undefined) updateData.domain = domain ? domain.trim().toLowerCase() : null;

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: updateData,
    });

    await logAudit(
      userPayload.id,
      "Company",
      "Update",
      `Updated company "${updated.name}" (ID: ${companyId})`
    );

    return {
      success: true,
      data: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
      message: "Company updated successfully",
    };
  } catch (error) {
    console.error("updateCompanyAction error:", error);
    return { success: false, message: "Failed to update company" };
  }
}

/**
 * Delete a company (SuperAdmin only)
 * This is a hard delete - all associated data will be cascade deleted
 */
export async function deleteCompanyAction(companyId: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role !== "SuperAdmin") {
      return { success: false, message: "Unauthorized: SuperAdmin only" };
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        _count: {
          select: { users: true, customers: true, deals: true },
        },
      },
    });
    if (!company) {
      return { success: false, message: "Company not found" };
    }

    const userCount = company._count.users;
    const customerCount = company._count.customers;
    const dealCount = company._count.deals;

    if (userCount > 0 || customerCount > 0 || dealCount > 0) {
      return {
        success: false,
        message: `Cannot delete company with existing data (${userCount} users, ${customerCount} customers, ${dealCount} deals)`,
      };
    }

    await prisma.company.delete({
      where: { id: companyId },
    });

    await logAudit(
      userPayload.id,
      "Company",
      "Delete",
      `Deleted company "${company.name}" (ID: ${companyId})`
    );

    return { success: true, message: "Company deleted successfully" };
  } catch (error) {
    console.error("deleteCompanyAction error:", error);
    return { success: false, message: "Failed to delete company" };
  }
}
