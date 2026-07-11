# Deal Flow User Manual — From "Qualified" to "Won"

**Version:** 1.0  
**Audience:** Sales Team (Sales Executives, Sales Managers, Admins)  
**Verified against codebase:** `lib/module-status-config.ts`, `lib/dealService.ts`, `app/api/opportunities/[id]/stage-change/route.ts`, `app/api/opportunities/[id]/mark-won/route.ts`, `app/api/opportunities/[id]/mark-lost/route.ts`, `app/api/quotations/[id]/*`, `app/(dashboard)/sales-pipeline/[id]/opportunity-detail/page.tsx`, `app/(dashboard)/quotations/[id]/page.tsx`, `app/(dashboard)/negotiations/[id]/page.tsx`, `prisma/schema.prisma`

---

## Table of Contents

1. [Pipeline Stage Overview](#1-pipeline-stage-overview)
2. [Roles & Permissions](#2-roles--permissions)
3. [Stage 1 — Qualified](#stage-1--qualified)
4. [Stage 2 — Requirement Gathering](#stage-2--requirement-gathering)
5. [Stage 3 — Technical Discussion](#stage-3--technical-discussion)
6. [Stage 4 — Meeting Scheduled](#stage-4--meeting-scheduled)
7. [Stage 5 — Demo Conducted](#stage-5--demo-conducted)
8. [Stage 6 — Demo Accepted (RFQ + Quotation)](#stage-6--demo-accepted-rfq--quotation)
9. [Quotation Lifecycle](#7-quotation-lifecycle)
10. [Negotiation Flow](#8-negotiation-flow)
11. [Marking a Deal as Won](#9-marking-a-deal-as-won)
12. [Terminal Exits — Lost & Rejected](#10-terminal-exits--lost--rejected)
13. [Pipeline Overview Page (List View)](#11-pipeline-overview-page-list-view)

---

## 1. Pipeline Stage Overview

The deal pipeline has **10 stage values** defined as the single source of truth in `lib/module-status-config.ts`:

| Order | Stage Name           | Default Probability | Type       |
|-------|----------------------|---------------------|------------|
| 1     | Qualified            | 20%                 | Active     |
| 2     | RequirementGathering | 35%                 | Active     |
| 3     | TechnicalDiscussion  | 50%                 | Active     |
| 4     | MeetingScheduled     | 75%                 | Active     |
| 5     | DemoConducted        | 85%                 | Active     |
| 6     | DemoAccepted         | 100%                | Terminal   |
| 7     | Won                  | 100%                | Terminal   |
| 0     | OnHold               | 0%                  | Pause      |
| 0     | Rejected             | 0%                  | Terminal   |
| 0     | Lost                 | 0%                  | Terminal   |

**Forward progression rule:** You can only advance **one stage at a time** in sequence. Skipping stages is blocked by the API (`stage-change/route.ts`, line 116). Terminal exits (Lost, Rejected) can be triggered from any stage.

**Backward rollback rule:** Moving to a lower-ordered stage requires **SalesManager or Admin** role. SalesExecutives cannot roll back.

**Closed stages** (no further pipeline progression): `DemoAccepted`, `Won`, `Lost`, `Rejected`.

---

## 2. Roles & Permissions

| Action | SalesExecutive | SalesManager | Admin | SuperAdmin |
|--------|---------------|-------------|-------|------------|
| View opportunity | Only assigned deals | All company deals | All | Via support mode only |
| Edit stage details | Only assigned deals | All | All | Via support mode |
| Advance to next stage | Only assigned deals | All | All | Via support mode |
| Roll back stage | ❌ | ✅ | ✅ | Via support mode |
| Mark as Lost/Rejected | Only assigned deals | All | All | Via support mode |
| Mark as Won | Only assigned deals | All | All | Via support mode |

> **Source:** `canChangeStage()` function in `opportunity-detail/page.tsx` (line 182) and `stage-change/route.ts` (line 110).

---

## Stage 1 — Qualified

### Page/Route
`/sales-pipeline/[id]/opportunity-detail`

### What You See
The opportunity lands here automatically when created from a qualified lead. The deal's `status` field defaults to `"Qualified"` in the Prisma schema.

### UI Sections

1. **Sample Management Panel** (conditional — only if `requiresSamples` is set to `"yes"`)
   - **Field:** "Customer requires samples?" — Select: `Yes — route to sample management` / `No — proceed to requirement gathering`
   - If **Yes**: A sample request form appears with:
     - **Select Product** (dropdown, required)
     - **Quantity** (number, required)
     - **Specifications / Notes** (textarea)
     - **Button:** "Create Sample Request" → `POST /api/samples`
   - Once a sample exists, status flow buttons appear:
     - **"→ Under Review"** → `PUT /api/samples/[id]` with `{ status: "UnderReview" }`
     - **"✓ Approve Sample → Advance to RG"** → advances sample to "Approved" and moves deal to RequirementGathering
     - **"✗ Reject Sample → Move to Rejected"** → moves deal to Rejected terminal stage
   - **Blocking rule:** If `requiresSamples === "yes"` and `sampleStatus !== "approved"`, the "Advance to Requirement Gathering" button is disabled.

2. **Qualification Details Form**
   - **Budget discussed** (text input, auto-filled from lead if available)
   - **Timeline** (text input, auto-filled from lead if available)
   - **Lead is genuine (verified requirement)** (Select: Yes/No)
   - **Customer requires samples?** (Select: Yes/No — see above)
   - **Notes** (textarea)

### Buttons

| Button Label | Action | API Call | Enabled When |
|-------------|--------|----------|-------------|
| **Save Details** | Saves form data without changing stage | `PUT /api/opportunities/[id]/details` | User has edit permission |
| **Advance to Requirement Gathering** | Saves details and moves to next stage | `PUT /api/opportunities/[id]/details` then `POST /api/opportunities/[id]/stage-change` with `{ to_stage: "RequirementGathering" }` | No blocking reasons (sample approved if applicable) |

### Side Effects of Advancing
- `DealStageHistory` record created
- `probabilityPercent` updated to 35%
- Auto-follow-up created: "Schedule discovery call" (due in +2 days)
- Audit log entry
- Notification sent to assigned user (if changed by someone else)

---

## Stage 2 — Requirement Gathering

### Page/Route
`/sales-pipeline/[id]/opportunity-detail`

### What You See
A progress bar showing **8 mandatory fields** completion. Four collapsible sections:

1. **Customer Details** (auto-filled from lead/customer/contact where possible)
   - Contact Person *(mandatory)*
   - Email *(mandatory)*
   - Phone *(mandatory)*
   - Company Name
   - Industry
   - Employee Count
   - Approval Process
   - Buying Authority Notes

2. **Business Requirements**
   - Current Challenges *(mandatory)*
   - Business Need *(mandatory)*
   - Urgency / Priority *(mandatory)* — Select: Low/Medium/High/Critical
   - Expected Outcome
   - Current Vendor
   - Competitors Evaluated

3. **Commercial Information**
   - Expected Budget *(mandatory)*
   - Decision Maker *(mandatory)*
   - Budget Range
   - Final Discussed Budget
   - Procurement Process
   - Influencer
   - Budget Owner
   - Expected Go Live (date)
   - Payment Terms
   - Competitor Info

4. **Internal Notes**
   - Additional Notes
   - Internal Sales Notes

### Product Requirements Table
A `ProductRequirementTable` component lets you add product line items:
- Product Name
- Estimated Quantity
- Target Price (Min/Max)
- Material
- Required Delivery (date)
- Spec Notes
- Attachment URL

> **At least one product requirement item is required** to advance to Technical Discussion.

### Buttons

| Button Label | Action | API Call | Enabled When |
|-------------|--------|----------|-------------|
| **Save Details** | Saves form data | `PUT /api/opportunities/[id]/details` | User has edit permission |
| **Advance to Technical Discussion** | Saves and moves to next stage | `PUT /api/opportunities/[id]/details` then `POST /api/opportunities/[id]/stage-change` with `{ to_stage: "TechnicalDiscussion" }` | All 8 mandatory fields filled AND ≥1 product requirement item added |

### Stage Gate Validation (API-side)
The `stage-change/route.ts` (lines 125–153) enforces:
- **Mandatory fields:** `contactPerson`, `email`, `phone`, `currentChallenges`, `businessNeed`, `urgencyPriority`, `expectedBudget`, `decisionMaker`
- **Product requirements:** At least one `OpportunityRequirementItem` must exist
- If validation fails, API returns 400 with message listing missing fields

### Side Effects of Advancing
- `DealStageHistory` record created
- `probabilityPercent` updated to 50%
- Auto-follow-up: "Schedule technical discussion with engineering team" (+2 days)
- Audit log + notification

---

## Stage 3 — Technical Discussion

### Page/Route
`/sales-pipeline/[id]/opportunity-detail`

### What You See

1. **Follow-up Banner** (conditional — only if deal was reverted from DemoConducted with "Follow-up needed" outcome)
   - Shows attempt number, scheduled follow-up date, and feedback notes from the previous demo

2. **Discussion Header Details**
   - Discussion Date (date input)
   - Attendees (text input)
   - Assigned Engineer (dropdown — filtered to CostingEngineer, Admin, SalesManager roles)

3. **Product Feasibility Review** (`TechnicalFeasibilityTable` component)
   - For each product requirement item, you can set:
     - **Feasibility** — Select: `Feasible` / `FeasibleWithChanges` / `NotFeasible`
     - **Confirmed Spec** (text)
     - **Tooling Required** (text)
   - Each row has a save button: `POST /api/opportunities/[id]/requirement-items/[itemId]/technical-note`

### Buttons

| Button Label | Action | API Call | Enabled When |
|-------------|--------|----------|-------------|
| **Save Details** | Saves form data | `PUT /api/opportunities/[id]/details` | User has edit permission |
| **Advance to Meeting Scheduled** | Saves and moves to next stage | `PUT /api/opportunities/[id]/details` then `POST /api/opportunities/[id]/stage-change` with `{ to_stage: "MeetingScheduled" }` | All product rows have feasibility set AND no product is "NotFeasible" (unless forced by Manager/Admin) |

### Stage Gate Validation (API-side)
The `stage-change/route.ts` (lines 158–189) enforces:
- Every `OpportunityRequirementItem` must have a `technicalNote.feasibility` value
- If any item is `NotFeasible`, the API blocks advancement unless `force=true` is passed (Manager/Admin only)
- API returns 400 with names of items missing feasibility or marked NotFeasible

### Side Effects of Advancing
- `DealStageHistory` record created
- `probabilityPercent` updated to 75%
- Auto-follow-up: "Confirm attendee list and meeting agenda" (+2 days)
- Audit log + notification

---

## Stage 4 — Meeting Scheduled

### Page/Route
`/sales-pipeline/[id]/opportunity-detail`

### What You See

**State: Scheduled** (meeting not yet conducted)

1. **Scheduling Summary Banner** — Shows: Assigned To, Meeting Type, Mode, Date

2. **Schedule Meeting Form** (editable)
   - **Meeting Type** *(required)* — Select: Discovery Call / Technical Discussion / Site Visit / Solution Review
   - **Meeting Date** *(required)* — Date picker (shows relative day indicator: "Today", "In X days", etc.)
   - **Meeting Mode** — Select: Zoom / Customer site visit / Direct visit / Call
   - **Assigned Executive** *(required)* — Dropdown of sales-role users

3. **Additional Meeting Details (Optional)** — Collapsible section
   - Duration (minutes)
   - Location
   - Participants
   - Agenda

### Buttons

| Button Label | Action | API Call | Enabled When |
|-------------|--------|----------|-------------|
| **Save Details** | Saves meeting form data | `PUT /api/opportunities/[id]/details` | User has edit permission |
| **Mark as Conducted →** | Saves details and advances to DemoConducted | `PUT /api/opportunities/[id]/details` then `POST /api/opportunities/[id]/stage-change` with `{ to_stage: "DemoConducted" }` | Meeting Type + Meeting Date filled AND Assigned Executive set AND meeting date has been reached |

> **Important:** If the meeting date has not yet arrived, a warning message is shown: "📅 Meeting scheduled for [date]. Come back on that day to mark as conducted." The button is still technically clickable but the user is warned.

### Stage Gate Validation (API-side)
The `stage-change/route.ts` (lines 193–204) enforces:
- A `MeetingLog` with `conductedAt = null` must exist with a `meetingDate` set
- If no pending meeting log or no meeting date, API returns 400: "Cannot advance. Please schedule a meeting date first."

### Side Effects of Advancing
- The pending `MeetingLog` is marked as conducted (`conductedAt` set to now)
- `DealStageHistory` record created
- `probabilityPercent` updated to 85%
- Auto-follow-up: "Follow up on demo outcome and next steps" (+2 days)
- Audit log + notification

---

## Stage 5 — Demo Conducted

### Page/Route
`/sales-pipeline/[id]/opportunity-detail`

### What You See

1. **Demo Summary Banner** (read-only) — Shows: Demo Type, Date, Mode, Conducted By, and outcome badge if set

2. **Next Steps Panel** — Depends on `deal.demoOutcome`:

#### If `demoOutcome` is NOT set (initial entry from MeetingScheduled):

A **"Record Demo Outcome"** panel appears with **four toggle buttons**:

| Toggle Button | Selection Value | What Happens Next |
|--------------|----------------|-------------------|
| **Demo Accepted** | `"Accepted"` | Shows outcome notes textarea + "Accept & Proceed" button |
| **Follow-up Needed** | `"Follow-up needed"` | Shows follow-up date picker + outcome notes + "Set Follow-up Date" button |
| **Reschedule Demo** | `"Reschedule"` | Shows new date picker + reschedule reason + "Confirm Reschedule & Revert Stage" button |
| **Demo Rejected** | `"Rejected"` | Shows rejection reason dropdown + remarks + outcome notes + "Reject & Close" button |

##### Button Details:

**"Accept & Proceed"** (green):
- API: `POST /api/opportunities/[id]/stage-change` with `{ to_stage: "DemoAccepted", demoOutcome: "Accepted" }`
- **Side effects:** Deal moves to DemoAccepted, RFQ auto-created with line items from requirement items, probability set to 100%

**"Set Follow-up Date"** (amber):
- Requires a follow-up date to be set
- API: `POST /api/opportunities/[id]/stage-change` with `{ to_stage: "TechnicalDiscussion", demoOutcome: "Follow-up needed", demoFollowUpDate: "YYYY-MM-DD" }`
- **Side effects:** Deal reverts to TechnicalDiscussion, a new MeetingLog is created with incremented attempt number and the follow-up date, previous meeting log outcome set to "Follow-up needed"

**"Confirm Reschedule & Revert Stage"** (blue):
- Requires a new rescheduled date
- API: `POST /api/opportunities/[id]/stage-change` with `{ to_stage: "MeetingScheduled", demoFollowUpDate: "YYYY-MM-DD" }`
- **Side effects:** Deal reverts to MeetingScheduled, meeting log updated with new date

**"Reject & Close"** (rose):
- Requires a rejection reason from dropdown
- API: `POST /api/opportunities/[id]/stage-change` with `{ to_stage: "Rejected", demoOutcome: "Rejected", rejectedReason: "..." }`
- **Side effects:** Deal moves to Rejected (terminal), probability set to 0%

#### If `demoOutcome === "Accepted"`:
- **RFQ Summary Card** is shown with product line items
- **Button:** "Create Quotation" → navigates to `/quotations/new?opportunityId=[id]`
- **Button (in RFQSummaryCard):** Auto-populate RFQ → `POST /api/opportunities/[id]/stage-change` with `{ to_stage: "DemoAccepted", demoOutcome: "Accepted" }` (creates/heals RFQ)

#### If `demoOutcome === "Follow-up needed"`:
- Amber panel showing follow-up date
- **Before follow-up date:** Waiting message — "Accept/Reject options will be available on that day."
- **On/after follow-up date:** Two buttons appear:
  - **"Mark as Accepted"** (green) → advances to DemoAccepted with `demoOutcome: "Accepted"`
  - **"Mark as Rejected"** (orange) → requires rejection reason, moves to Rejected

#### If `demoOutcome === "Rejected"`:
- Terminal state panel showing rejection reason and remarks (read-only)

### API Validation (stage-change/route.ts, lines 207–221)
When leaving DemoConducted stage, `demoOutcome` is **required** and must be one of: `"Accepted"`, `"Rejected"`, `"Follow-up needed"`.

### Side Effects of Advancing to DemoAccepted
- `MeetingLog.outcome` set to the demo outcome
- If "Follow-up needed": new `MeetingLog` created with incremented attempt number
- `DealStageHistory` record created
- `probabilityPercent` updated to 100%
- **RFQ auto-created** via `createOrHealRFQ()` — maps requirement items to RFQ line items, auto-links products by name/code match
- Auto-follow-up: "Create and review RFQ" (+2 days)
- Audit log + notification

---

## Stage 6 — Demo Accepted (RFQ + Quotation)

### Page/Route
`/sales-pipeline/[id]/opportunity-detail`

### What You See
The deal is now in a **terminal/closed stage**. Details are read-only. A summary card shows Deal Value, Customer, Expected Close, and Assigned To.

### Buttons

| Button Label | Action | Navigation | Condition |
|-------------|--------|-----------|-----------|
| **View RFQ →** or **Create RFQ →** | Navigate to RFQ detail or creation | `/rfq/[rfqId]` or `/rfq/new?opportunityId=[id]` | Always visible in DemoAccepted |
| **Direct Quotation** | Navigate to quotation creation | `/quotations/new?opportunityId=[id]` | Always visible in DemoAccepted |

### Quotation Status Sidebar
A sidebar panel shows the current quotation status:
- **No quotation created yet** (amber) — if no linked quotations
- **✅ Quotation Accepted** (emerald) — if any linked quotation has status "Accepted"
- **⏳ Awaiting Customer Response** (blue) — if any linked quotation has status "Sent"
- **📋 N quotation(s) — Draft** — fallback for Draft/PendingApproval/UnderReview quotations

### What Happens Next
From DemoAccepted, the flow continues through the **Quotation Lifecycle** (see below). Once a quotation is accepted by the customer, the **"Mark Deal as Won"** button becomes available.

---

## 7. Quotation Lifecycle

### Quotation Detail Page
`/quotations/[id]`

### Quotation Statuses
`Draft` → `PendingApproval` → `Approved` → `Sent` → `UnderReview` → `Accepted` or `Rejected` or `Expired`

### Button Visibility by Status

| Button | Visible When Status Is | API Call | Notes |
|--------|----------------------|----------|-------|
| **Edit** | Draft only | (inline edit mode) | Edit line items, prices, discounts |
| **Request Approval** | Draft AND approval triggers exist | `POST /api/quotations/[id]/request-approval` | Triggers: blended discount > threshold (default 5%), line-item discount > threshold, margin < floor (default 15%) |
| **Send** | Draft or Approved | `POST /api/quotations/[id]/send` | Requires ≥1 line item, valid-until date not passed. If approval triggers exist and no approved approval, non-Admin users get 402 error |
| **Negotiate** | Sent or UnderReview | `POST /api/quotations/[id]/negotiate` | Moves quotation to UnderReview, creates/reuses Negotiation record |
| **Propose Revision** | When linked negotiation is Active or PriceRevision | Navigates to `/negotiations/[negotiationId]` | Redirects to negotiation detail page |
| **Accept** | Sent or UnderReview | `POST /api/quotations/[id]/accept` | Marks quotation as Accepted |
| **Reject** | Sent or UnderReview | `POST /api/quotations/[id]/reject` | Requires rejection reason ID + text |
| **Create PO** | Accepted only | `POST /api/quotations/[id]/create-po` | Creates Purchase Order |
| **Clone & Revise** | Rejected, Expired, or negotiation in PriceRevision | `POST /api/quotations/[id]/clone` | Creates a new revision quotation |
| **PDF** | Always | Opens printable view | |
| **Generate PDF** | Always | `POST /api/quotations/[id]/generate-pdf` | Stores PDF document |
| **Delete** | Draft only | `DELETE /api/quotations/[id]` | Soft-deletes quotation |

### Approval Workflow
- **Triggers:** Blended discount > threshold (default 5%), max line-item discount > threshold, any line margin < floor (default 15%)
- If triggers exist and no approved approval, non-Admin users **cannot send** — API returns 402 with `requires_approval: true`
- Admin users can bypass approval and send directly
- Approval decisions made via `PUT /api/quotations/[id]/approval` with `{ decision: "Approved" | "Rejected" }`

### Quotation Accept Side Effects
When `POST /api/quotations/[id]/accept` is called:
1. Quotation status → `Accepted`, `acceptedAt` set
2. `QuotationStatusHistory` record created
3. Active negotiations closed as `Closed-Success` with outcome `Won`
4. If no linked deal: auto-creates a Deal at `DemoAccepted` stage
5. If customer is `Prospect` and no linked deal: customer status → `Active`
6. Linked RFQ (if any) → status `Closed`
7. Pending follow-ups for customer → `Cancelled`
8. Notifications sent to: SalesManagers ("Deal Won!"), quotation creator ("Quotation Accepted!"), Admin/CostingEngineer ("New Order")
9. Audit log entry

### In-Opportunity Quotation Panel
On the opportunity detail page, a `ProposalQuotationGuide` component (defined but quotation status is shown in the sidebar) displays contextual banners based on linked quotation status:
- **No quotation:** "Create Quotation" button
- **Draft quotation:** "View Quotation" + "Send to Customer →" buttons
- **PendingApproval:** "View Quotation" button only
- **Approved:** "View Quotation" + "Send to Customer" buttons
- **Sent:** "View Quotation" + "Mark as Accepted ✓" + "Negotiate Changes" buttons
- **UnderReview:** "View Quotation" + "Mark as Accepted ✓" buttons
- **Accepted:** "🏆 Mark Deal as Won" button (green)

---

## 8. Negotiation Flow

### Negotiation Detail Page
`/negotiations/[id]`

### How Negotiations Are Created
- **From Quotation:** Click "Negotiate" on a Sent/UnderReview quotation → `POST /api/quotations/[id]/negotiate`
- This creates a `Negotiation` record with status `Active` and links it to the quotation
- If a deal is linked, the deal status is updated to `"Negotiation"` (a non-pipeline status used for tracking)

### Negotiation Status Flow (Sequential)

```
Active → PriceRevision → CommercialDiscussion → PendingApproval → Closed-Success
   |          |                  |                      |
   |          |                  |                      └── Closed-Failure
   |          |                  └── PriceRevision (loop back)
   |          └── Closed-Success / Closed-Failure
   └── Closed-Success / Closed-Failure
```

**Allowed transitions** (enforced by `STATUS_FLOW` in the UI):
- `Active` → `PriceRevision`, `Closed-Success`, `Closed-Failure`
- `PriceRevision` → `CommercialDiscussion`, `Closed-Success`, `Closed-Failure`
- `CommercialDiscussion` → `PendingApproval`, `PriceRevision`, `Closed-Success`, `Closed-Failure`
- `PendingApproval` → `Closed-Success`, `Closed-Failure`

### Price Revisions
- **"Add Revision"** button — visible when negotiation is `Active` or `PriceRevision`
- Form fields: Proposed Amount (required, cannot exceed current amount), Discount % (auto-calculated), Reason
- API: `POST /api/negotiations/[id]/revisions`
- Each revision has status: `Proposed` → `Approved` / `Rejected` / `Pending`

### Discount Approval Workflow
- **Threshold** (default 5%): Discounts at or below this are auto-approved
- **Escalation threshold** (default 15%): Discounts above this require higher-level approval
- When discount > threshold, a "Request Approval" action is available in `CommercialDiscussion` status
- Approval requests create `NegotiationRevision` with status `Pending`

### Negotiation Closure
- **Closed-Success:** Sets `finalAmount`, `outcome = "Won"`, `closedAt`
- **Closed-Failure:** Terminal, no further actions
- Confirmation dialog appears before closing

### Post-Closure Actions
- **Closed-Success:** "Create Purchase Order" button appears → navigates to `/purchase-orders/new?customerId=...&negotiationId=...&quotationId=...`

### Key Clarification: Two-Step vs Bundled
The negotiation flow is **multi-step**, not bundled:
1. Sales exec proposes a price revision (reduces amount)
2. If discount exceeds threshold, it routes to `CommercialDiscussion` then `PendingApproval`
3. Manager approves/rejects the revision
4. Once approved, quotation can be re-sent or accepted
5. Negotiation is closed as `Closed-Success` (either manually or automatically when quotation is accepted)

---

## 9. Marking a Deal as Won

### Prerequisites
1. At least one **Accepted** quotation must be linked to the deal
2. The deal must not already be in a terminal stage (Won, Lost, Rejected)

### How to Trigger
There are **two ways** to mark a deal as Won:

#### Method 1: From the Opportunity Detail Page
- When a linked quotation has status `Accepted`, the `ProposalQuotationGuide` component shows a green banner: "Quotation accepted — ready to mark deal as Won!"
- **Button:** "🏆 Mark Deal as Won"
- API: `POST /api/opportunities/[id]/mark-won`

#### Method 2: From the Quotation Detail Page
- The quotation "Accept" button (`POST /api/quotations/[id]/accept`) does NOT directly mark the deal as Won
- It sets the quotation to Accepted and performs cascading updates
- The user must then go to the opportunity and click "Mark Deal as Won"

### API: `POST /api/opportunities/[id]/mark-won`
**File:** `app/api/opportunities/[id]/mark-won/route.ts`

**Validation:**
- User must be authenticated and have role: SalesExecutive, SalesManager, Admin, or SuperAdmin
- SalesExecutive can only mark their own assigned deals
- **Must have at least one Accepted quotation** linked to the deal (API returns 400 if none)

**Side Effects:**
1. `probabilityPercent` set to 100
2. `transitionDealStatus` called with target `"Won"` — which:
   - Verifies accepted quotation exists (unless `skipQuotationGate` is set — but mark-won does NOT skip it)
   - Creates `DealStageHistory` record
   - Syncs customer status to `"ActiveCustomer"`
   - Creates `AccountStatusHistory` for the customer
   - Sends notifications
3. Audit log: `"Marked opportunity [name] as Won"`
4. Notification to assigned user: "Deal Won!"

### What Happens If You Try to Mark Won Without Accepted Quotation
- The `handleSaveAndMove` function in the UI catches the error and shows a toast with a "Create Quotation →" link button
- The API (`stage-change/route.ts` via `transitionDealStatus`) throws: "An accepted quotation is required before marking this opportunity as Won"

---

## 10. Terminal Exits — Lost & Rejected

### Mark as Lost

**Button:** "Mark Lost" (visible in the opportunity header for non-terminal deals, when user has `canChangeStage` permission)

**Modal fields:**
- **Loss Reason** (required — dropdown from `LossReason` table)
- **Competitor** (optional — dropdown)
- **Notes** (optional)

**API:** `POST /api/opportunities/[id]/mark-lost` with `{ lost_reason_id, competitor_id?, notes? }`

**Side Effects:**
1. `probabilityPercent` set to 0
2. `lostReasonRefId` and `lostReason` fields set on deal
3. `transitionDealStatus` called with `"Lost"`
4. All pending/overdue follow-ups for the customer → `Cancelled`
5. Audit log (severity: HIGH)
6. Notification to assigned user: "Deal Lost"

### Mark as Rejected

**Button:** "Mark Rejected" (visible in the opportunity header)

**Modal fields:**
- **Rejection Reason** (required — text input)
- **Notes** (optional)

**API:** `POST /api/opportunities/[id]/stage-change` with `{ to_stage: "Rejected", rejectedReason: "...", notes: "..." }`

**API Validation:** `rejectedReason` is required when moving to Rejected (line 224–229 of stage-change/route.ts)

**Side Effects:**
1. `rejectedReason` set on deal
2. `transitionDealStatus` called with `"Rejected"`
3. `DealStageHistory` record created
4. Auto-follow-up: "Internal review: understand rejection reasons and lessons learned" (+2 days)
5. Audit log + notification

### Rejection from Demo Conducted Stage
When a demo is rejected via the "Reject & Close" button in the DemoConducted stage:
- `demoOutcome` is set to `"Rejected"`
- `rejectedReason` is set from the dropdown selection
- Deal moves directly to `Rejected` terminal stage
- The `MeetingLog` outcome is set to `"Rejected"` with the rejection reason

---

## 11. Pipeline Overview Page (List View)

### Route
`/sales-pipeline/pipeline-list` (the old `/sales-pipeline` page redirects here)

### Tab Filters
The `StatusFilterBar` component uses `PIPELINE_STATUS` from `module-status-config.ts`:

| Tab Label | Filter Value | Behavior |
|-----------|-------------|----------|
| Overview | `""` (empty) | Shows all deals (no stage filter) |
| Qualified | `Qualified` | Filters by `status = "Qualified"` |
| Req. gathering | `RequirementGathering` | Filters by `status = "RequirementGathering"` |
| Tech. discussion | `TechnicalDiscussion` | Filters by `status = "TechnicalDiscussion"` |
| Meeting scheduled | `MeetingScheduled` | Filters by `status = "MeetingScheduled"` |
| Demo conducted | `DemoConducted` | Filters by `status = "DemoConducted"` |
| Demo accepted | `DemoAccepted` | Filters by `status = "DemoAccepted"` |
| Overdue | `overdue` | Filters by overdue criteria (see below) |
| Rejected | `Rejected` | Filters by `status = "Rejected"` |
| Lost | `Lost` | Filters by `status = "Lost"` |

### API Call
`GET /api/opportunities?stage=[value]&search=[query]`

When `stage=overdue`, the API receives `overdue=true` instead.

### Overdue Criteria
A deal is considered overdue if:
- The `expectedCloseDate` has passed, OR
- The deal has been in any open stage (`Qualified`, `RequirementGathering`, `TechnicalDiscussion`, `MeetingScheduled`, `DemoConducted`) for more than 15 days
- AND the deal is not `Lost` or `Rejected`

### List View Columns
Each deal row shows:
- **Opportunity Code** + **Deal Name**
- **Account** (customer name)
- **Stage** — displayed as a colored pill badge using `STAGE_LABELS` mapping
- **Deal Value** (formatted currency)
- **Probability** — visual progress bar (green for Won, rose for Lost, primary color otherwise)
- **Expected Close Date**
- **Assigned To**
- **Overdue indicator**

### KPIs (top of page)
- **Total Open Deals** — count of deals excluding Lost and Won
- **Total Open Value** — sum of deal values excluding Lost and Won
- **Overdue Count** — count of deals where `isOverdue` is true

### Export
- **Export CSV** button — downloads all filtered deals as CSV with columns: Code, Name, Account, Stage, Value, Probability, Close Date, Assigned To, Overdue

### Search
- Text search filters by deal name or customer name (case-insensitive)

---

## Appendix A: Stage Transition State Machine

```
Qualified
  │
  ▼
RequirementGathering ──(gate: 8 mandatory fields + ≥1 product requirement)──►
  │
  ▼
TechnicalDiscussion ──(gate: all products have feasibility, none NotFeasible)──►
  │
  ▼
MeetingScheduled ──(gate: pending MeetingLog with date, meeting date reached)──►
  │
  ▼
DemoConducted ──(requires demoOutcome: Accepted / Rejected / Follow-up needed)──►
  │                    │                    │
  │ (Accepted)         │ (Follow-up)        │ (Rejected)
  ▼                    ▼                    ▼
DemoAccepted    TechnicalDiscussion     Rejected (terminal)
  │               (revert + new
  │                MeetingLog)
  ▼
Won (requires Accepted quotation)
```

## Appendix B: API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/opportunities/[id]` | GET | Fetch deal details |
| `/api/opportunities/[id]` | PUT | Update deal fields (not status) |
| `/api/opportunities/[id]/details` | PUT | Save stage form data |
| `/api/opportunities/[id]/stage-change` | POST | Change deal stage (with gates) |
| `/api/opportunities/[id]/mark-won` | POST | Mark deal as Won (requires Accepted quotation) |
| `/api/opportunities/[id]/mark-lost` | POST | Mark deal as Lost (requires loss reason) |
| `/api/opportunities/[id]/quotations` | GET | List linked quotations |
| `/api/quotations/[id]` | GET | Fetch quotation detail |
| `/api/quotations/[id]/send` | POST | Send quotation to customer |
| `/api/quotations/[id]/accept` | POST | Mark quotation accepted |
| `/api/quotations/[id]/reject` | POST | Mark quotation rejected |
| `/api/quotations/[id]/negotiate` | POST | Move quotation to negotiation |
| `/api/quotations/[id]/clone` | POST | Clone & revise quotation |
| `/api/quotations/[id]/request-approval` | POST | Request manager approval |
| `/api/quotations/[id]/approval` | PUT | Approve/reject approval request |
| `/api/quotations/[id]/create-po` | POST | Create purchase order |
| `/api/negotiations/[id]` | GET/PUT | Fetch/update negotiation |
| `/api/negotiations/[id]/revisions` | POST | Create price revision |
| `/api/samples` | POST | Create sample request |
| `/api/samples/[id]` | PUT | Update sample status |

---

*This manual is verified against the codebase as of the current commit. All button labels, API calls, validation rules, and side effects are traced to actual source code. Any future code changes may require updating this document.*
