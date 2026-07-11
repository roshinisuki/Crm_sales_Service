import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { validateNotInPast } from "@/lib/date-validation";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const existing = await prisma.followUp.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Follow-up not found" }, { status: 404 });
    }

    if (userPayload.role === "SalesExecutive" && existing.assignedUserId !== userPayload.id) {
      return NextResponse.json({ success: false, message: "Unauthorized: You do not own this follow-up" }, { status: 403 });
    }

    const data: any = {};
    if (body.nextMeetingDate !== undefined) {
      const validationError = validateNotInPast(body.nextMeetingDate, "Follow-up date");
      if (validationError) {
        return NextResponse.json({ success: false, message: validationError }, { status: 400 });
      }
      data.nextMeetingDate = new Date(body.nextMeetingDate);
      data.dueDate = data.nextMeetingDate;
    }
    if (body.remarks !== undefined) data.remarks = body.remarks;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.reminderAt !== undefined) data.reminderAt = body.reminderAt ? new Date(body.reminderAt) : null;
    if (body.status !== undefined) data.status = body.status;

    if (body.assignedUserId !== undefined) {
      if (userPayload.role === "SalesExecutive" && body.assignedUserId !== userPayload.id) {
        return NextResponse.json({ success: false, message: "Executives can only assign to themselves" }, { status: 400 });
      }
      data.assignedUserId = body.assignedUserId;
    }

    const updated = await prisma.followUp.update({
      where: { id },
      data,
    });

    await logAudit(userPayload.id, "follow-up", "update", `Follow-up ${id} updated via API`);

    revalidatePath("/dashboard");
    revalidatePath("/follow-up");
    if (updated.customerId) {
      revalidatePath(`/customers/${updated.customerId}`);
      revalidatePath(`/customer-master/${updated.customerId}`);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const existing = await prisma.followUp.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Follow-up not found" }, { status: 404 });
    }

    if (userPayload.role === "SalesExecutive" && existing.assignedUserId !== userPayload.id) {
      return NextResponse.json({ success: false, message: "Unauthorized: You do not own this follow-up" }, { status: 403 });
    }

    const { action } = body;

    if (action === "complete" || body.status === "Completed") {
      // Mark Complete
      const updated = await prisma.followUp.update({
        where: { id },
        data: {
          status: "Completed",
          completedAt: new Date(),
          completedById: userPayload.id,
          completionNotes: body.completionNotes || body.remarks || null,
          notes: body.notes || body.remarks || null,
        },
      });

      await logAudit(userPayload.id, "follow-up", "complete", `Follow-up ${id} marked complete via PUT API`);
      revalidatePath("/dashboard");
      revalidatePath("/followups");
      revalidatePath("/follow-up");
      return NextResponse.json({ success: true, data: updated });
    } else if (action === "reschedule" || body.nextMeetingDate) {
      // Reschedule
      const validationError = validateNotInPast(body.nextMeetingDate, "Follow-up date");
      if (validationError) {
        return NextResponse.json({ success: false, message: validationError }, { status: 400 });
      }
      const targetDate = new Date(body.nextMeetingDate);
      const now = new Date();
      const isFuture = targetDate > now;

      const updated = await prisma.followUp.update({
        where: { id },
        data: {
          nextMeetingDate: targetDate,
          dueDate: targetDate,
          status: isFuture ? "Pending" : "Overdue",
          remarks: body.remarks || body.notes || null,
          notes: body.remarks || body.notes || null,
        },
      });

      await logAudit(userPayload.id, "follow-up", "reschedule", `Follow-up ${id} rescheduled via PUT API`);
      revalidatePath("/dashboard");
      revalidatePath("/followups");
      revalidatePath("/follow-up");
      return NextResponse.json({ success: true, data: updated });
    } else {
      // General update
      const data: any = {};
      if (body.nextMeetingDate !== undefined) {
        const validationError = validateNotInPast(body.nextMeetingDate, "Follow-up date");
        if (validationError) {
          return NextResponse.json({ success: false, message: validationError }, { status: 400 });
        }
        data.nextMeetingDate = new Date(body.nextMeetingDate);
        data.dueDate = data.nextMeetingDate;
      }
      if (body.remarks !== undefined) data.remarks = body.remarks;
      if (body.notes !== undefined) data.notes = body.notes;
      if (body.priority !== undefined) data.priority = body.priority;
      if (body.status !== undefined) data.status = body.status;

      const updated = await prisma.followUp.update({
        where: { id },
        data,
      });

      await logAudit(userPayload.id, "follow-up", "update", `Follow-up ${id} updated via PUT API`);
      revalidatePath("/dashboard");
      revalidatePath("/followups");
      revalidatePath("/follow-up");
      return NextResponse.json({ success: true, data: updated });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
