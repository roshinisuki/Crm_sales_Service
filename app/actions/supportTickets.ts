"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { TicketPriority, TicketStatus } from "@prisma/client";

/**
 * Create a new support ticket. Can be submitted by Customers or Employees.
 */
export async function createSupportTicketAction(data: {
  customerId?: string; // Optional if submitted by the logged-in customer user
  title: string;
  description: string;
  priority?: TicketPriority;
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

    let resolvedCustomerId = data.customerId;

    // If logged-in user is a customer, resolve their customer record automatically
    if (userPayload.role === "Customer") {
      const customer = await prisma.customer.findFirst({
        where: { email: userPayload.email, companyId: userPayload.companyId }
      });
      if (!customer) {
        return { success: false, message: "Customer profile not found for logged-in user." };
      }
      resolvedCustomerId = customer.id;
    }

    if (!resolvedCustomerId) {
      return { success: false, message: "Customer ID is required." };
    }
    if (!data.title || !data.description) {
      return { success: false, message: "Title and description are required." };
    }

    // Verify customer belongs to the tenant
    const targetCustomer = await prisma.customer.findUnique({
      where: { id: resolvedCustomerId }
    });
    if (!targetCustomer || targetCustomer.companyId !== userPayload.companyId) {
      return { success: false, message: "Customer not found or access denied." };
    }

    const ticketNumber = `TKT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber,
        customerId: resolvedCustomerId,
        title: data.title,
        description: data.description,
        priority: data.priority || "Medium",
        status: "Open"
      }
    });

    await logAudit(
      userPayload.id,
      "TICKETS",
      "CREATE_TICKET",
      `Created support ticket: ${ticketNumber} (${data.title})`
    );

    revalidatePath("/support-tickets");
    revalidatePath(`/customers/${resolvedCustomerId}`);

    return { success: true, message: "Support ticket created successfully", data: ticket };
  } catch (error) {
    console.error("Create Support Ticket Error:", error);
    return { success: false, message: "Failed to create support ticket." };
  }
}

/**
 * Retrieve support tickets.
 */
export async function getSupportTicketsAction(filters?: {
  customerId?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
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
      ...(filters?.priority ? { priority: filters.priority } : {}),
      customer: {
        companyId: userPayload.companyId
      }
    };

    // Customer can only view their own tickets
    if (userPayload.role === "Customer") {
      const customer = await prisma.customer.findFirst({
        where: { email: userPayload.email, companyId: userPayload.companyId }
      });
      if (!customer) {
        return { success: true, data: [] };
      }
      whereClause.customerId = customer.id;
    } else {
      // Employees can filter by customer
      if (filters?.customerId) {
        whereClause.customerId = filters.customerId;
      }

      // SalesExecutive can only see assigned tickets or tickets for their assigned customers
      if (userPayload.role === "SalesExecutive") {
        whereClause.OR = [
          { assignedUserId: userPayload.id },
          { customer: { assignedUserId: userPayload.id, companyId: userPayload.companyId } }
        ];
      }
    }

    const tickets = await prisma.supportTicket.findMany({
      where: whereClause,
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        assignedUser: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return { success: true, data: tickets };
  } catch (error) {
    console.error("Get Support Tickets Error:", error);
    return { success: false, message: "Failed to fetch support tickets." };
  }
}

/**
 * Update support ticket status.
 */
export async function updateSupportTicketStatusAction(
  id: string,
  status: TicketStatus,
  remarks?: string
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

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: { customer: true }
    });
    if (!ticket || ticket.customer.companyId !== userPayload.companyId) {
      return { success: false, message: "Ticket not found or access denied." };
    }

    // SalesExecutive can only update their assigned tickets or tickets for their assigned customers
    if (userPayload.role === "SalesExecutive" && ticket.assignedUserId !== userPayload.id && ticket.customer.assignedUserId !== userPayload.id) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    const updated = await prisma.supportTicket.update({
      where: { id },
      data: { status }
    });

    await logAudit(
      userPayload.id,
      "TICKETS",
      "UPDATE_STATUS",
      `Updated ticket ${ticket.ticketNumber} status to ${status}. Remarks: ${remarks || "None"}`
    );

    revalidatePath("/support-tickets");
    revalidatePath(`/customers/${ticket.customerId}`);

    return { success: true, message: "Ticket status updated successfully", data: updated };
  } catch (error) {
    console.error("Update Support Ticket Error:", error);
    return { success: false, message: "Failed to update ticket status." };
  }
}

/**
 * Assign ticket to a support executive.
 */
export async function assignSupportTicketAction(id: string, assignedUserId: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["SalesManager", "Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized: Admins/Leads only." };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: { customer: true }
    });
    if (!ticket || ticket.customer.companyId !== userPayload.companyId) {
      return { success: false, message: "Ticket not found or access denied." };
    }

    const user = await prisma.user.findUnique({ where: { id: assignedUserId } });
    if (!user || user.companyId !== userPayload.companyId) {
      return { success: false, message: "Assigned user not found or belongs to a different company." };
    }

    const updated = await prisma.supportTicket.update({
      where: { id },
      data: { assignedUserId }
    });

    await logAudit(
      userPayload.id,
      "TICKETS",
      "ASSIGN_TICKET",
      `Assigned ticket ${ticket.ticketNumber} to ${user.name}`
    );

    revalidatePath("/support-tickets");
    revalidatePath(`/customers/${ticket.customerId}`);

    return { success: true, message: `Ticket assigned to ${user.name} successfully`, data: updated };
  } catch (error) {
    console.error("Assign Support Ticket Error:", error);
    return { success: false, message: "Failed to assign ticket." };
  }
}
