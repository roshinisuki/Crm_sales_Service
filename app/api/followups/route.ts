import { NextResponse } from "next/server";
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
    const body = await request.json();
    const result = await createFollowUpAction(body);

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: result.message, data: result.data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
