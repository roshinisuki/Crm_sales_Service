import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { validateNotInPast } from "@/lib/date-validation";
import { getFollowUpsAction, createFollowUpAction } from "@/app/actions/followUps";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || undefined;
    const priority = url.searchParams.get("priority") || undefined;
    const assignedUserId = url.searchParams.get("assignedUserId") || undefined;
    const sourceType = url.searchParams.get("sourceType") || undefined;
    const startDate = url.searchParams.get("startDate") || undefined;
    const endDate = url.searchParams.get("endDate") || undefined;
    const search = url.searchParams.get("search") || undefined;

    const result = await getFollowUpsAction({
      status,
      priority,
      assignedUserId,
      sourceType,
      startDate,
      endDate,
      search,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate: scheduled date is not in the past (today is allowed)
    const scheduledDatetime = body.scheduled_datetime || body.nextMeetingDate || body.scheduledTime;
    if (scheduledDatetime) {
      const validationError = validateNotInPast(scheduledDatetime, "Follow-up date");
      if (validationError) {
        return NextResponse.json(
          { success: false, message: validationError },
          { status: 400 }
        );
      }
    }

    const result = await createFollowUpAction(body);

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }

    // Schedule 1-hour reminder: INSERT notification with send_at = scheduled_datetime - 1 hour
    if (scheduledDatetime && result.data?.assignedUserId) {
      const scheduled = new Date(scheduledDatetime);
      const reminderTime = new Date(scheduled.getTime() - 60 * 60 * 1000);
      if (reminderTime > new Date()) {
        await prisma.notification.create({
          data: {
            userId: result.data.assignedUserId,
            title: "Follow-Up Reminder",
            message: `Follow-up scheduled in 1 hour`,
            type: "follow_up",
            link: "/follow-up",
          },
        }).catch(() => {}); // non-blocking
      }
    }

    return NextResponse.json({ success: true, message: result.message, data: result.data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
