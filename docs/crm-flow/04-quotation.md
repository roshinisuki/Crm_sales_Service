# Phase 4 — Quotation

## Entry points

### 1. Manual quotation
- **Route**: `POST /api/quotations` — `app/api/quotations/route.ts:40-216`.
- **UI**: `/quotations` list page + create form (`app/(dashboard)/quotations/`).
- Requires a non-`Customer` authenticated user. Requires `customerId`, a `validUntil` date that
  is not in the past, and at least 1 line item (either passed directly in `body.items`, or — if
  `rfqId` is provided and no items were passed — copied from that RFQ's `lineItems` using the
  latest submitted `computedUnitPrice`). *Source: `app/api/quotations/route.ts:47-99`.*
- All totals (`subtotal`, `taxAmount`, `discountAmount`, `finalAmount`/grand total) are
  **server-computed** from line items, never trusted from the client. *Source: `app/api/quotations/route.ts:101-133`.*
- Code format: `QT-YYYY-NNNNN` (per-company, per-year sequence). Starts at `status: "Draft"`,
  `revisionNumber: 1`. A `QuotationStatusHistory` row (`null → "Draft"`) is written in the same
  transaction. *Source: `app/api/quotations/route.ts:135-193`.*

### 2. Generated from an RFQ's costing sheet
- **RFQ flow leading up to this**: RFQ created (`POST /api/rfq`, `status: "New"`) → assigned to a
  costing owner (`POST /api/rfq/[id]/assign-costing`, requires ≥1 line item, sets
  `status: "CostingPending"`, restricted to non-`Customer` roles) → Costing Engineer/Admin submits
  a costing sheet (`POST /api/rfq/[id]/costing-sheet`, restricted to `CostingEngineer`/`Admin`
  roles; computes `unitPrice = (material+labour+freight+packaging+tooling+other) × (1+overhead%) × (1+margin%)`,
  rejects `computedUnitPrice <= 0`). *Source: `app/api/rfq/[id]/assign-costing/route.ts:11-52`, `app/api/rfq/[id]/costing-sheet/route.ts:55-178`.*
- **Route**: `POST /api/rfq/[id]/generate-quotation` — `app/api/rfq/[id]/generate-quotation/route.ts:7-193`.
- **Gate**: fails if the RFQ has zero submitted costing sheets. *Source: `app/api/rfq/[id]/generate-quotation/route.ts:29-35`.*
- Builds quotation line items from `RFQLineItem`s, resolving each item's unit price from its
  matching per-line-item costing sheet, falling back to an RFQ-level costing sheet (one with no
  `rfqLineItemId`) if present. Tax percent is looked up from `TaxMaster` by matching
  `product.productCode` against `TaxMaster.hsnCode` (default `18%` if no match). *Source: `app/api/rfq/[id]/generate-quotation/route.ts:86-124`.*
- On success, the RFQ is moved to `status: "QuotationCreated"` with an `RFQStatusHistory` row, in
  the same transaction as the quotation creation. Validity is set to **30 days** from generation.
  *Source: `app/api/rfq/[id]/generate-quotation/route.ts:60-62, 139-153`.*
- Notifies the RFQ's assigned user and (if present) its contact.

## Approval flow (discount-gated)

- **Threshold**: hardcoded `discountThreshold = 10` (10%) inside `POST /api/quotations/[id]/send`.
  *Source: `app/api/quotations/[id]/send/route.ts:44`.*
- If `quotation.discountPercent > 10` and there is no `QuotationApproval` row with
  `status === "Approved"`, sending is blocked with HTTP 402 and `requires_approval: true`.
  *Source: `app/api/quotations/[id]/send/route.ts:45-54`.*
- **Requesting approval**: `POST /api/quotations/[id]/request-approval` — only from `status: "Draft"`;
  defaults the approver to any active `SalesManager` in the same company if none is specified;
  blocks if a `Pending` approval already exists for the quotation. *Source: `app/api/quotations/[id]/request-approval/route.ts:22-45`.*
- **Deciding**: `PUT /api/quotations/[id]/approval` — restricted to `SalesManager`, `Admin`,
  `SuperAdmin` (SuperAdmin additionally must be in "support mode"); resolves the most recent
  `Pending` `QuotationApproval` row to `Approved`/`Rejected`, notifies the requester.
  *Source: `app/api/quotations/[id]/approval/route.ts:6-19, 28-77`.*
- **What happens on rejection**: only the `QuotationApproval.status` becomes `"Rejected"` and the
  requester is notified — the Quotation itself stays at `"Draft"`. There is no automatic re-route
  or escalation on rejection found in this handler.

## Status machine observed in code

`Draft → Sent → UnderReview ⇄ Sent → Accepted | Rejected | Expired`

| Transition | Endpoint | Gate | Side effects |
|---|---|---|---|
| `Draft → Sent` | `POST /api/quotations/[id]/send` | Must be `Draft`; ≥1 item; `validUntil >= today`; discount ≤10% or approved | Creates a `FollowUp` (Call, +2 days); notifies creator. *Source: `app/api/quotations/[id]/send/route.ts:26-100`.* |
| `Sent`/`UnderReview → UnderReview` | `POST /api/quotations/[id]/negotiate` | Must be `Sent` or already `UnderReview` | Moves linked Deal to `"Negotiation"` (if not `Won`/`Lost`); auto-creates/reuses a `Negotiation` record. See Phase 3. |
| `Sent`/`UnderReview → Accepted` | `POST /api/quotations/[id]/accept` | Must be `Sent` or `UnderReview` | Cascades: linked Deal → `"Won"`; Customer `Prospect` → `Active`; linked RFQ → `"Closed"`; cancels the customer's `Pending`/`Overdue` follow-ups (only if `dealId` set); notifies `SalesManager`s ("Deal Won!"), the creator, and `Admin`/`CostingEngineer` ("New Order"). *Source: `app/api/quotations/[id]/accept/route.ts:25-172`.* |
| `Sent`/`UnderReview → Rejected` | `POST /api/quotations/[id]/reject` | Must be `Sent` or `UnderReview`; `rejectionReasonId` required | No cascade to Deal/RFQ. |
| `Sent`/`UnderReview → Expired` | `GET /api/cron/quotations-expire` | `validUntil < now` | Notifies creator; also separately notifies creators of quotations expiring within 7 days (deduped to once per 24h). *Source: `app/api/cron/quotations-expire/route.ts:1-87`.* No dedicated schedule config found in the repo for this route — **not found in code — needs confirmation** of actual invocation frequency. |

## Versioning / revisions

- **`POST /api/quotations/[id]/clone`** (`app/api/quotations/[id]/clone/route.ts:6-145`) is the
  revision mechanism: snapshots the current quotation + items into `QuotationRevisionSnapshot.snapshotJson`,
  then creates a **new** `Quotation` row with a **new** `quotationCode` (`QT-YYYY-NNNNN`),
  `revisionNumber: existing.revisionNumber + 1`, `status: "Draft"`, validity reset to 30 days from
  now, copying customer/deal/RFQ links and all line items. The original quotation is left
  untouched (its own status is not changed by cloning).
- A separate, simpler **`POST /api/quotations/[id]/duplicate`** endpoint also exists
  (`app/api/quotations/[id]/duplicate/route.ts:5-58`), which creates a new quotation with a
  **different** code format (`QUO-NNNN`, not `QT-YYYY-NNNNN`) and does **not** write a
  `QuotationRevisionSnapshot` or increment `revisionNumber`. Two separate "copy this quotation"
  code paths exist with different semantics and different code formats — **flagging this as a
  likely source of confusion**, since both are plausible "Duplicate" or "Revise" UI actions.

## Converting an Accepted Quotation onward

- **To a Purchase Order**: `POST /api/quotations/[id]/create-po` — only from `status: "Accepted"`;
  blocks if a PO already exists for this quotation; copies line items, customer, contact, deal,
  linked negotiation (if any), payment/delivery terms; starts the PO at `status: "New"`. See Phase 5.
  *Source: `app/api/quotations/[id]/create-po/route.ts:9-153`.*
- **To a Deal** (if one doesn't already exist): `POST /api/quotations/[id]/create-deal` — only
  from `status: "Accepted"`; blocks if `quotation.dealId` is already set; creates the Deal at
  `status: "Active"` (Deals vocabulary — see Phase 3's discrepancy note) and links it back via
  `quotation.dealId`. *Source: `app/api/quotations/[id]/create-deal/route.ts:9-81`.*

## What UI pages the user sees

- List/create: `/quotations` (`app/(dashboard)/quotations/page.tsx`).
- Detail: `/quotations/{id}` (`app/(dashboard)/quotations/[id]/`), linked from nearly every
  notification produced in this phase.
- PDF export exists at `GET /api/quotations/[id]/pdf` (listed in the API directory but not read
  in this pass — **not found in code (content) — needs confirmation** of PDF template/fields).

## Edge cases found in code

- Approval rejection does not block re-requesting approval again — `request-approval` only checks
  for a currently-`Pending` approval, not for a prior `Rejected` one, so a rejected quotation can
  have approval re-requested indefinitely.
- `negotiate` and `accept` both directly mutate `Deal.status` with raw `tx.deal.update` calls,
  bypassing `transitionDealStatus()` — so Deal-side audit logs, `DealStageHistory` entries, and
  high-value-deal manager notifications from `lib/dealService.ts` are **not** produced for
  Deal transitions caused by Quotation events.
- Two distinct "copy" endpoints (`clone` vs `duplicate`) with different code formats and revision
  tracking, as noted above.
- `create-deal` will silently produce a Deal `dealName` of the form `"{customer} — {quotationCode}"`
  regardless of any richer opportunity naming used elsewhere in the app.
