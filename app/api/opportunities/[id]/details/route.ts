import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

// PUT /api/opportunities/[id]/details
// Upserts OpportunityDetail for a deal (requirement gathering data)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  // SuperAdmin must use support/impersonation mode
  if (user.role === "SuperAdmin" && (!user.supportMode || !user.companyId)) {
    return NextResponse.json({ success: false, message: "SuperAdmin must access business data via support/impersonation mode." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const deal = await prisma.deal.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!deal) return NextResponse.json({ success: false, message: "Opportunity not found" }, { status: 404 });

  // Row-level scope check
  if (user.role === "SalesExecutive" && deal.assignedUserId !== user.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  // stage_context is provided by the frontend when editing a completed stage
  // so the audit log can record which stage was edited. It is intentionally
  // NOT used to change deal.status; only the stage-change endpoint does that.
  const stageContext = body?.stage_context;

  // Whitelist allowed fields from the OpportunityDetail model
  const allowedFields = [
    "currentChallenges", "painPoints", "painPointsList",
    "requiredFeatures", "modulesRequired",
    "deploymentType", "integrationsRequired",
    "userCountSales", "userCountManagers", "userCountAdmins",
    "budgetRange", "timeline", "procurementProcess",
    "decisionMaker", "influencer", "budgetOwner", "expectedGoLive",
    "currentVendor", "competitorsEvaluated",
    "businessNeed", "expectedOutcome", "requiredDepartments",
    "numberOfUsers", "urgencyPriority", "businessGoals", "successCriteria",
    "existingSoftwareStack", "securityCompliance", "userRolesPermissions",
    "reportingRequirements", "dataMigrationRequired", "customizationNeeded",
    "apiThirdPartyReqs", "technicalConstraints", "itTeamNotes",
    "expectedBudget", "finalDiscussedBudget", "pricingModel", "licenseCount",
    "paymentTerms", "billingCycle", "competitorInfo", "commercialRisks",
    "discountRequested", "proposalValue", "negotiationNotes", "probability",
    "internalSalesNotes", "presalesNotes", "objections",
    "followUpSummary", "risksBlockers", "nextSteps", "managementNotes",
    "companyName", "industry", "contactPerson", "email", "phone",
    "employeeCount", "approvalProcess", "buyingAuthorityNotes",
    "requirementCompletedAt",
    // Meeting Scheduled
    "meetingType", "meetingMode", "meetingDate", "meetingStatus", "meetingDuration",
    "meetingParticipants", "meetingLocation", "meetingAgenda", "meetingOutcome", "nextFollowUpDate",
    // Demo Conducted
    "demoType", "demoDate", "demoPresenter", "demoDuration", "demoAttendees",
    "demoCustomerRating", "demoInterestLevel", "demoQuestionsRaised",
    "demoRejectionReason", "demoRejectionRemarks", "demoCompetitorName",
    "demoFollowUpDate",
    // Proposal Sent
    "proposedSolution", "scopeClassification", "estimatedDuration", "developmentEffort",
    "implementationEffort", "supportRequirements",
    // V2: Sample management + technical discussion
    "requiresSamples", "sampleStatus",
    "techDiscussionDate", "techDiscussionAttendees", "techDiscussionQuestions", "techDiscussionConfirmed",
    // V5: Manufacturing pipeline fields
    "leadVerified", "tdDiscussionDate", "tdAttendees", "tdEngineerId", "additionalNotes",
  ];

  const data: Record<string, any> = {};
  for (const key of allowedFields) {
    if (body[key] !== undefined) {
      // Parse numeric fields
      if (["userCountSales", "userCountManagers", "userCountAdmins", "numberOfUsers", "licenseCount", "probability", "employeeCount", "meetingDuration", "demoDuration"].includes(key)) {
        data[key] = body[key] !== null && body[key] !== "" ? parseInt(body[key]) || null : null;
      } else if (["expectedBudget", "finalDiscussedBudget", "discountRequested", "proposalValue"].includes(key)) {
        data[key] = body[key] !== null && body[key] !== "" ? parseFloat(body[key]) || null : null;
      } else if (["expectedGoLive", "meetingDate", "demoDate", "nextFollowUpDate", "requirementCompletedAt", "techDiscussionDate", "demoFollowUpDate", "tdDiscussionDate"].includes(key)) {
        data[key] = body[key] ? new Date(body[key]) : null;
      } else if (["techDiscussionConfirmed", "leadVerified"].includes(key)) {
        data[key] = Boolean(body[key]);
      } else {
        data[key] = body[key];
      }
    }
  }

  let detail;
  try {
    detail = await prisma.$transaction(async (tx) => {
      const upserted = await tx.opportunityDetail.upsert({
        where: { dealId: id },
        update: data,
        create: { dealId: id, ...data },
      });

      if (body.syncToProfile === true) {
        if (deal.customerId) {
          await tx.customer.update({
            where: { id: deal.customerId },
            data: {
              ...(body.companyName ? { name: body.companyName } : {}),
              ...(body.email ? { email: body.email } : {}),
              ...(body.phone ? { phone: body.phone } : {}),
              ...(body.industry ? { industryType: body.industry } : {}),
            },
          });

          if (body.contactPerson) {
            const primaryContact = await tx.contact.findFirst({
              where: { customerId: deal.customerId, isPrimary: true },
            });
            if (primaryContact) {
              await tx.contact.update({
                where: { id: primaryContact.id },
                data: {
                  name: body.contactPerson,
                  ...(body.email ? { email: body.email } : {}),
                  ...(body.phone ? { phone: body.phone } : {}),
                },
              });
            } else {
              await tx.contact.create({
                data: {
                  customerId: deal.customerId,
                  name: body.contactPerson,
                  email: body.email || null,
                  phone: body.phone || null,
                  isPrimary: true,
                  ownerId: user.id,
                  companyId: user.companyId || null,
                },
              });
            }
          }
        }

        const associatedLead = await tx.lead.findFirst({
          where: { convertedOpportunityId: id },
        });
        if (associatedLead) {
          await tx.lead.update({
            where: { id: associatedLead.id },
            data: {
              ...(body.contactPerson ? { name: body.contactPerson } : {}),
              ...(body.companyName ? { companyName: body.companyName } : {}),
              ...(body.email ? { email: body.email } : {}),
              ...(body.phone ? { phone: body.phone } : {}),
              ...(body.industry ? { industryType: body.industry } : {}),
            },
          });
        }
      }

      return upserted;
    });
  } catch (error: any) {
    console.error("[RG Details Save Error]", error?.message || error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to save requirement gathering details" },
      { status: 500 }
    );
  }

  await logAudit(
    user.id,
    "Opportunity",
    "UpdateDetails",
    stageContext
      ? `Updated ${stageContext} stage details for opportunity "${deal.dealName}"`
      : `Updated requirement gathering details for opportunity "${deal.dealName}"`,
    {
      resourceId: id,
      context: extractAuditContext(request),
      severity: "INFO",
    }
  );

  return NextResponse.json({ success: true, data: detail });
}
