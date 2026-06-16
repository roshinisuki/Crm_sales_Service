"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
type InvoiceStatus = "Unpaid" | "Paid" | "Overdue" | "Cancelled";

/**
 * Create a new invoice.
 */
export async function createInvoiceAction(data: {
  customerId: string;
  amount: number;
  dueDate: string | Date;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { customerId, amount, dueDate } = data;

    if (!customerId || amount <= 0 || !dueDate) {
      return { success: false, message: "Customer ID, positive amount, and due date are required." };
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || customer.companyId !== userPayload.companyId) {
      return { success: false, message: "Customer not found or access denied." };
    }

    const invoiceNumber = `INV-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        customerId,
        amount,
        dueDate: new Date(dueDate),
        status: "Unpaid"
      }
    });

    await logAudit(
      userPayload.id,
      "INVOICES",
      "CREATE_INVOICE",
      `Issued invoice: ${invoiceNumber} to ${customer.name} (Amount: INR ${amount})`
    );

    revalidatePath("/invoices");
    revalidatePath(`/customers/${customerId}`);

    return { success: true, message: "Invoice created successfully", data: invoice };
  } catch (error) {
    console.error("Create Invoice Error:", error);
    return { success: false, message: "Failed to create invoice." };
  }
}

/**
 * Retrieve invoices.
 */
export async function getInvoicesAction(filters?: {
  customerId?: string;
  status?: InvoiceStatus;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const whereClause: any = {
      ...(filters?.status ? { status: filters.status } : {}),
      customer: {
        companyId: userPayload.companyId
      }
    };

    // Customer can only view their own invoices
    if (userPayload.role === "Customer") {
      const customer = await prisma.customer.findFirst({
        where: { email: userPayload.email, companyId: userPayload.companyId }
      });
      if (!customer) {
        return { success: true, data: [] };
      }
      whereClause.customerId = customer.id;
    } else {
      if (filters?.customerId) {
        whereClause.customerId = filters.customerId;
      }
      // SalesExecutive can only see invoices of their assigned customers
      if (userPayload.role === "SalesExecutive") {
        whereClause.customer.assignedUserId = userPayload.id;
      }
    }

    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      include: {
        customer: { select: { id: true, name: true, customerCode: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return { success: true, data: invoices };
  } catch (error) {
    console.error("Get Invoices Error:", error);
    return { success: false, message: "Failed to fetch invoices." };
  }
}

/**
 * Update invoice status.
 */
export async function updateInvoiceStatusAction(
  id: string,
  status: InvoiceStatus
) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { customer: true }
    });
    if (!invoice || invoice.customer.companyId !== userPayload.companyId) {
      return { success: false, message: "Invoice not found or access denied." };
    }

    // SalesExecutive can only update status of invoices for their assigned customers
    if (userPayload.role === "SalesExecutive" && invoice.customer.assignedUserId !== userPayload.id) {
      return { success: false, message: "Unauthorized: You do not own this customer's invoice." };
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status,
        paidAt: status === "Paid" ? new Date() : null
      }
    });

    await logAudit(
      userPayload.id,
      "INVOICES",
      "UPDATE_STATUS",
      `Invoice ${invoice.invoiceNumber} status updated to ${status}`
    );

    revalidatePath("/invoices");
    revalidatePath(`/customers/${invoice.customerId}`);

    return { success: true, message: `Invoice marked as ${status} successfully`, data: updated };
  } catch (error) {
    console.error("Update Invoice Error:", error);
    return { success: false, message: "Failed to update invoice status." };
  }
}
