"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, computeDiff } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { buildScope, checkRecordScope } from "@/lib/scopes";


export async function getProposalsAction(params?: { search?: string; status?: string }) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return { success: false, message: "Unauthorized" };
    if (userPayload.role === "Customer") return { success: false, message: "Unauthorized" };
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support mode." };
    }

    const { search = "", status = "" } = params || {};
    const scope = buildScope(userPayload, "Proposal");

    const proposals = await prisma.proposal.findMany({
      where: {
        ...scope,
        AND: [
          status ? { status } : {},
          search ? {
            OR: [
              { title: { contains: search } },
              { proposalNumber: { contains: search } },
              { customer: { name: { contains: search } } }
            ]
          } : {}
        ]
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        deal: { select: { id: true, dealName: true } }
      },
      orderBy: { updatedAt: "desc" }
    });

    const serialized = proposals.map(p => ({
      ...p,
      validUntil: p.validUntil.toISOString(),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));

    return { success: true, data: serialized };
  } catch (error) {
    console.error("GET Proposals Error:", error);
    return { success: false, message: "Failed to fetch proposals" };
  }
}

export async function getProposalByIdAction(id: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role === "Customer") return { success: false, message: "Unauthorized" };

    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: {
        customer: true,
        deal: true,
        versions: {
          include: { changedBy: { select: { name: true } } },
          orderBy: { versionNumber: "desc" }
        }
      }
    });

    if (!proposal) return { success: false, message: "Proposal not found" };
    if (!checkRecordScope(userPayload, proposal, "Proposal")) return { success: false, message: "Access denied" };
    if (proposal.deletedAt && !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Proposal deleted." };
    }

    const serialized = {
      ...proposal,
      validUntil: proposal.validUntil.toISOString(),
      createdAt: proposal.createdAt.toISOString(),
      updatedAt: proposal.updatedAt.toISOString(),
      customer: proposal.customer ? {
        ...proposal.customer,
        createdAt: proposal.customer.createdAt.toISOString(),
        updatedAt: proposal.customer.updatedAt.toISOString(),
      } : null,
      deal: proposal.deal ? {
        ...proposal.deal,
        expectedCloseDate: proposal.deal.expectedCloseDate.toISOString(),
        createdAt: proposal.deal.createdAt.toISOString(),
        updatedAt: proposal.deal.updatedAt.toISOString(),
      } : null,
      versions: proposal.versions.map(v => ({
        ...v,
        validUntil: v.validUntil.toISOString(),
        createdAt: v.createdAt.toISOString(),
      }))
    };

    return { success: true, data: serialized };
  } catch (error) {
    console.error("GET Proposal By ID Error:", error);
    return { success: false, message: "Failed to fetch proposal details" };
  }
}

export async function createProposalAction(data: {
  customerId: string;
  dealId?: string;
  title: string;
  description?: string;
  value: number;
  validUntil: string;
  proposalPdfUrl?: string;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role === "Customer") return { success: false, message: "Unauthorized" };
    if (!userPayload.companyId) return { success: false, message: "Tenant configuration missing" };

    const proposalNumber = `PROP-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const proposal = await prisma.proposal.create({
      data: {
        proposalNumber,
        customerId: data.customerId,
        dealId: data.dealId || null,
        title: data.title,
        description: data.description,
        value: data.value,
        validUntil: new Date(data.validUntil),
        proposalPdfUrl: data.proposalPdfUrl,
        status: "Draft",
        companyId: userPayload.companyId,
        versions: {
          create: {
            versionNumber: 1,
            title: data.title,
            description: data.description,
            value: data.value,
            validUntil: new Date(data.validUntil),
            proposalPdfUrl: data.proposalPdfUrl,
            status: "Draft",
            changedById: userPayload.id
          }
        }
      }
    });

    await logAudit(userPayload.id, "PROPOSALS", "CREATE_PROPOSAL", `Created proposal: ${proposal.title}`, { resourceId: proposal.id, newState: proposal });
    revalidatePath("/proposals");
    return { success: true, data: proposal };
  } catch (error) {
    console.error("Create Proposal Error:", error);
    return { success: false, message: "Failed to create proposal" };
  }
}

export async function updateProposalAction(data: {
  id: string;
  title: string;
  description?: string;
  value: number;
  validUntil: string;
  proposalPdfUrl?: string;
  status?: string;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role === "Customer") return { success: false, message: "Unauthorized" };

    const existing = await prisma.proposal.findUnique({
      where: { id: data.id },
      include: { versions: true }
    });

    if (!existing) return { success: false, message: "Not found" };
    if (!checkRecordScope(userPayload, existing, "Proposal")) return { success: false, message: "Access denied" };

    // Prevent modification if already Accepted or Rejected unless Admin
    if (["Accepted", "Rejected"].includes(existing.status) && !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: `Cannot modify a proposal that is ${existing.status}` };
    }

    const isMajorChange = 
      existing.value !== data.value || 
      existing.title !== data.title || 
      existing.description !== data.description ||
      (data.status && existing.status !== data.status);

    const nextVersionNumber = isMajorChange ? (existing.versions.length + 1) : existing.versions.length;

    const updated = await prisma.proposal.update({
      where: { id: data.id },
      data: {
        title: data.title,
        description: data.description,
        value: data.value,
        validUntil: new Date(data.validUntil),
        proposalPdfUrl: data.proposalPdfUrl,
        status: data.status || existing.status,
        ...(isMajorChange && {
          versions: {
            create: {
              versionNumber: nextVersionNumber,
              title: data.title,
              description: data.description,
              value: data.value,
              validUntil: new Date(data.validUntil),
              proposalPdfUrl: data.proposalPdfUrl,
              status: data.status || existing.status,
              changedById: userPayload.id
            }
          }
        })
      }
    });

    const diff = computeDiff(existing, updated);
    if (Object.keys(diff).length > 0) {
      await logAudit(userPayload.id, "PROPOSALS", "UPDATE_PROPOSAL", `Updated proposal: ${updated.title}`, { resourceId: updated.id, previousState: existing, newState: updated });
    }

    revalidatePath("/proposals");
    revalidatePath(`/proposals/${data.id}`);
    return { success: true, data: updated };
  } catch (error) {
    console.error("Update Proposal Error:", error);
    return { success: false, message: "Failed to update proposal" };
  }
}

export async function advanceProposalStatusAction(id: string, newStatus: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role === "Customer") return { success: false, message: "Unauthorized" };

    const existing = await prisma.proposal.findUnique({
      where: { id },
      include: { versions: true }
    });

    if (!existing) return { success: false, message: "Not found" };
    if (!checkRecordScope(userPayload, existing, "Proposal")) return { success: false, message: "Access denied" };

    if (existing.status === newStatus) return { success: true, message: "Already in this status." };

    const updated = await prisma.proposal.update({
      where: { id },
      data: {
        status: newStatus,
        versions: {
          create: {
            versionNumber: existing.versions.length + 1,
            title: existing.title,
            description: existing.description,
            value: existing.value,
            validUntil: existing.validUntil,
            proposalPdfUrl: existing.proposalPdfUrl,
            status: newStatus,
            changedById: userPayload.id
          }
        }
      }
    });

    await logAudit(userPayload.id, "PROPOSALS", "UPDATE_PROPOSAL", `Advanced status to ${newStatus}`, { resourceId: updated.id, previousState: existing, newState: updated });
    revalidatePath(`/proposals`);
    revalidatePath(`/proposals/${id}`);
    
    return { success: true, message: `Proposal moved to ${newStatus}` };
  } catch (error) {
    console.error("Advance Proposal Status Error:", error);
    return { success: false, message: "Failed to advance proposal status" };
  }
}

export async function deleteProposalAction(id: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SalesManager", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized: Only Admins or Managers can delete proposals." };
    }

    const proposal = await prisma.proposal.findUnique({ where: { id } });
    if (!proposal) return { success: false, message: "Not found" };
    if (!checkRecordScope(userPayload, proposal, "Proposal")) return { success: false, message: "Access denied" };

    await prisma.proposal.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: userPayload.id
      }
    });

    await logAudit(userPayload.id, "PROPOSALS", "DELETE_PROPOSAL", `Deleted proposal: ${proposal.title}`, { resourceId: id, previousState: proposal });
    revalidatePath("/proposals");
    return { success: true, message: "Proposal deleted." };
  } catch (error) {
    console.error("Delete Proposal Error:", error);
    return { success: false, message: "Failed to delete proposal" };
  }
}
