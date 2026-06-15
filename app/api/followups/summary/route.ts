import { NextResponse } from "next/server";
import { getFollowUpsSummaryAction } from "@/app/actions/followUps";

export async function GET(request: Request) {
  try {
    const result = await getFollowUpsSummaryAction();

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
