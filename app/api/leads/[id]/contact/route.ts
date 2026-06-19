import { NextResponse } from "next/server";
import { contactLeadAction } from "@/app/actions/leads";

/**
 * POST /api/leads/{id}/contact
 *
 * Unified backend endpoint for marking a lead as Contacted.
 * Both "Log First Call" and "Mark Contacted" UI entry points call
 * this single API/service. There are no separate APIs per button.
 *
 * MANDATORY CALL LOG: The request body MUST include call details
 * (content/direction/duration/status). The lead status is only updated
 * to "Contacted" AFTER the Call activity is created. No silent updates.
 *
 * Delegates to the shared server action `contactLeadAction`, which:
 *   - creates a Call CommunicationLog with user-provided details
 *   - updates status: "New" -> "Contacted"
 *   - triggers the same automations/workflows
 *   - applies the same validations and scope checks
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Lead ID is required." },
        { status: 400 }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body parsing failed — callData.content will be empty, action will reject
    }

    const callData = {
      content: body?.content ?? body?.callData?.content ?? "",
      direction: body?.direction ?? body?.callData?.direction,
      duration: body?.duration ?? body?.callData?.duration,
      status: body?.status ?? body?.callData?.status,
    };

    const result = await contactLeadAction(id, callData);

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (error: any) {
    console.error("Error in POST /api/leads/[id]/contact:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error", error: error.message },
      { status: 500 }
    );
  }
}
