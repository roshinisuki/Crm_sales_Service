# Phase 3 — Deal (Opportunity) & Negotiation

## Lead → Deal conversion

Three separate atomic-transaction actions exist in `app/actions/leads.ts` that turn a Lead into
a Customer + Deal. They are not the same code path and produce slightly different records:

| Action | Lines | Creates | Deal starting status |
|---|---|---|---|
| `convertLeadToCustomerAction` | `1015-1116` | Customer only (no Deal) | n/a |
| `convertLeadToDealAction` (legacy/V1) | `1121-1271` | Customer (if not already converted) + Contact + Deal + `OpportunityDetail` | `"Qualified"` |
| `convertLeadV2Action` (V2, atomic) | `1414-1618` | Customer ("Account") + Contact + Deal ("Opportunity") + `OpportunityDetail`, with GSTIN validation and code generation | `"Qualified"`, `opportunityCode = OPP-YYYY-NNNNN` |

Both `convertLeadToDealAction` and `convertLeadV2Action` guard against double-conversion by
checking `lead.status === "Converted"` first (`app/actions/leads.ts:1140, 1446`), then run the
whole creation inside `prisma.$transaction`, then set `Lead.status = "Converted"` and populate
`convertedAccountId` / `convertedOpportunityId` on the Lead, plus a `LeadStatusHistory` row.
*Source: `app/actions/leads.ts:1552-1571` (V2 example).*

`convertLeadV2Action` additionally re-links existing `MarketingVisit`, `FollowUp`, `CallLog`,
`CommunicationLog` rows from the Lead to the new Customer inside the same transaction.

**Edge case**: Neither conversion action requires `lead.status === "SQL"` first — a Lead can be
converted directly from `"New"` if a user has the UI access to trigger it. There is no code-level
gate tying conversion eligibility to the BANT qualification step from Phase 2.

## The Deal status field has two different vocabularies

This is the single most important structural finding in this phase. `Deal.status`
(`prisma/schema.prisma:547`, a plain `String`, default `"Qualified"`) is written to by **two
functionally distinct sets of values**, both documented explicitly in `lib/module-status-config.ts`
as operating on the same field:

- **"Pipeline" module** (`lib/module-status-config.ts:32-34,216-223`): comment states *"Backend:
  Deal.status field, values from PipelineStageMaster + Lost"*, surfaced at `/sales-pipeline/pipeline-list`
  via `GET /api/opportunities?stage=`. Canonical values from `PIPELINE_STAGE_VALUES`
  (`lib/module-status-config.ts:41-48`): `Qualified, RequirementGathering, MeetingScheduled,
  DemoConducted, Rejected, Lost`.
- **"Deals" module** (`lib/module-status-config.ts:110-117, 224+`): comment states *"Backend:
  Deal.status field"*, surfaced via `/api/deals` (`getDealsAction`). Values from `DEALS_STATUS`:
  `Active, OnHold, Won, Lost`.

Concretely, different code paths write different vocabularies into the same field:
- `updateDealStatusAction` (`app/actions/deals.ts:446-517`) normalizes the target status through
  `normalizeStage()` from `lib/module-status-config.ts`, which **only accepts** the Pipeline
  vocabulary (`Qualified/RequirementGathering/MeetingScheduled/DemoConducted/Rejected/Lost`) —
  passing `"Active"` or `"Won"` here would fail normalization and return "Invalid stage" (`app/actions/deals.ts:493-495`).
- `POST /api/quotations/[id]/create-deal` (`app/api/quotations/[id]/create-deal/route.ts:59`)
  creates a brand-new Deal directly with `status: "Active"` — a value from the *Deals* vocabulary,
  bypassing `normalizeStage`/`transitionDealStatus` entirely (it uses a raw `tx.deal.create`, not
  `transitionDealStatus`).
- `lib/dealService.ts`'s `transitionDealStatus()` — the "centralized" state machine meant to be
  the single gateway for all transitions — itself references both vocabularies: it looks up
  `PipelineStageMaster` for stage ordering (Pipeline vocabulary) but also explicitly special-cases
  `toStatus === "Won"` (Deals vocabulary) for the accepted-quotation gate and customer-activation
  logic. *Source: `lib/dealService.ts:84-118, 192-216`.*
- `POST /api/quotations/[id]/accept` (`app/api/quotations/[id]/accept/route.ts:56-71`) sets a
  linked Deal directly to `status: "Won"` via a raw `tx.deal.update`, again bypassing
  `transitionDealStatus()`.

**Net effect**: a Deal's `status` can end up holding a Pipeline-vocabulary value
(e.g. `"DemoConducted"`) or a Deals-vocabulary value (e.g. `"Active"`, `"Won"`) depending on which
code path last touched it, and the two module UIs filter on mutually exclusive value sets — a
Deal moved to `"Active"` by the create-deal-from-quotation flow would not appear under any
Pipeline-module stage filter, and vice versa. This matches a previously logged product bug
(P10 in the existing bug ledger: *"Divergent stage vocabularies; deals defaults to Active bypassing
funnel"*). **This is a real, code-confirmed inconsistency, not a guess.**

## The pipeline stage machine (`transitionDealStatus`)

All transitions that go through `lib/dealService.ts:transitionDealStatus()` (called from
`updateDealStatusAction`, and from cron/system code) get:
- A `DealStageHistory` row (`fromStatus`, `toStatus`, `durationInPreviousStage` in days, a JSON `stageDataSnapshot`). *Source: `lib/dealService.ts:65-137`.*
- **Backward-stage gate**: if the target stage's `displayOrder` (from `PipelineStageMaster`) is
  lower than the current stage's, only `SalesManager`, `Admin`, or `SuperAdmin` may proceed —
  otherwise it throws `"Stage rollback requires Manager approval"`. *Source: `lib/dealService.ts:95-104`.*
- **Won gate**: transitioning to `"Won"` throws unless an `Accepted`, non-deleted `Quotation`
  exists with `dealId` pointing at this deal. *Source: `lib/dealService.ts:106-118`.*
- **RFQ auto-creation**: transitioning to `"DemoConducted"` with `deal.demoOutcome === "Accepted"`
  (a structured field set by the stage-change API/UI) auto-creates an `RFQ` (`rfqCode: RFQ-YYYY-NNNNN`,
  `status: "New"`) linked via `opportunityId`, if one doesn't already exist for that deal.
  *Source: `lib/dealService.ts:139-190`.*
- **Customer status sync**: on `Won`, the linked `Customer.status` is set to `"ActiveCustomer"`
  with an `AccountStatusHistory` row; if a Deal is reverted away from `Won` and the customer has
  no other `Won` deals or active `Subscription`s, the customer is reverted to `"Prospect"`.
  *Source: `lib/dealService.ts:192-262`.*
- **Notifications**: assigned user (if different from actor), and all `Admin`/`SalesManager` if
  `dealValue > 500000`. *Source: `lib/dealService.ts:272-299`.*

## Stage-entry validation (`updateDealStatusAction`)

Before calling `transitionDealStatus`, `updateDealStatusAction` (`app/actions/deals.ts:446-517`)
runs BRD-specific field-completeness checks (explicitly commented "BRD Variant 1 only"):
- Entering `"MeetingScheduled"` requires `OpportunityDetail.meetingDate`, `meetingType`,
  `meetingStatus` to already be filled. *Source: `app/actions/deals.ts:477-481`.*
- Entering `"ProposalSent"` requires `OpportunityDetail.proposedSolution`. *Source: `app/actions/deals.ts:482-486`.*
- No pre-validation is enforced for entering `"Negotiation"` (comment explicitly notes negotiation
  detail fields are filled *after* entering the stage). *Source: `app/actions/deals.ts:487-488`.*

## Negotiation entity

A `Negotiation` record is **not** created when a Deal enters a "Negotiation"-ish stage directly —
it is auto-created as a side effect of a **Quotation** transition:
- **Trigger**: `POST /api/quotations/[id]/negotiate` — moves the Quotation to `status: "UnderReview"`.
- If the quotation has a linked `dealId` and that deal isn't already `Negotiation`/`Won`/`Lost`,
  the deal is force-set to `status: "Negotiation"` via a raw `tx.deal.update` (again bypassing
  `transitionDealStatus`). *Source: `app/api/quotations/[id]/negotiate/route.ts:48-69`.*
- A `Negotiation` row is created (or reused if one already exists for that `quotationId`):
  `negotiationCode: NEG-NNNN`, `initialAmount` = quotation's `finalAmount`/`totalAmount`,
  `status: "Active"`, `assignedUserId` copied from the deal. *Source: `app/api/quotations/[id]/negotiate/route.ts:78-101`.*
- Negotiation's own status machine (`PUT /api/negotiations/[id]`, `app/api/negotiations/[id]/route.ts:6, 40-132`)
  has valid values `["Active", "PriceRevision", "CommercialDiscussion", "PendingApproval", "Won", "Lost"]`
  — a **third**, again distinct, vocabulary from either Deal vocabulary. Transitioning *out of*
  `"PendingApproval"` is blocked until the linked approval is resolved in the Approval Center.
  *Source: `app/api/negotiations/[id]/route.ts:65-70`.*
- `SalesRep` role can only modify negotiations assigned to them (`app/api/negotiations/[id]/route.ts:57-59`).
- Setting status to `"Won"`/`"Lost"` sets `outcome` and `closedAt`; no automatic cascade back to
  the Deal or Quotation status was found in this handler — **not found in code — needs
  confirmation** of whether closing a Negotiation as Won/Lost is expected to also update the
  linked Deal/Quotation (it does not appear to, based on this file alone).

## Who can advance/reject a deal

- `updateDealStatusAction`: `Admin`, `SalesManager`, `SalesExecutive` (`app/actions/deals.ts:449`).
- Backward stage moves inside `transitionDealStatus`: `SalesManager`/`Admin`/`SuperAdmin` only.
- `deleteDealAction` (soft-delete for most; hard-delete only for `SuperAdmin`): `Admin`/`SuperAdmin` (`app/actions/deals.ts:519-563`).
- Negotiation edits: any non-`Customer` role, with `SalesRep` restricted to their own assigned records.

## Discount approval on a Deal

`requestDiscountAction` / `resolveDiscountAction` / `createDiscountApprovalAction` exist in
`app/actions/deals.ts` (lines `602-999`) for deal-level discount approval, writing to
`Deal.discountPercent`, `discountStatus`, `discountApprovedById`, and `ApprovalHistory`. These
were located but not read line-by-line in this pass — **not found in code (full business rules) —
needs confirmation** of the exact discount-threshold and approver-role rules for this specific
action (as distinct from the Quotation-level 10% threshold documented in Phase 4, which *was*
confirmed in code).

## Edge cases

- A rolled-back ("Lost" → reopened) Deal is explicitly supported: `reversible: true` in
  `lib/workflow-config.ts`'s `PIPELINE_WORKFLOW`/`DEALS_WORKFLOW` configs, and `dealService.ts`
  has no blanket block on transitioning away from `Lost`.
- A Deal can be forced to `"Won"` by the Quotation-accept cascade (`POST /api/quotations/[id]/accept`)
  **without** passing through `transitionDealStatus`'s Won-gate check — meaning the "must have an
  Accepted quotation" rule is trivially satisfied in that path (since it's *triggered by* that
  quotation's acceptance) but the deal update itself skips `DealStageHistory` recording, audit
  logging via `logAudit("Deal", ...)`, and the high-value-deal manager notification that
  `transitionDealStatus` would otherwise produce.
