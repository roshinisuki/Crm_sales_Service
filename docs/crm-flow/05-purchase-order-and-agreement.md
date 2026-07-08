# Phase 5 — Purchase Order & Agreement

## Entry points

There are **two** ways a `PurchaseOrder` record is created:

### 1. From an Accepted Quotation (primary path)
- **Route**: `POST /api/quotations/[id]/create-po` — `app/api/quotations/[id]/create-po/route.ts:9-153`.
- **Gate**: quotation must be `status === "Accepted"`; blocked if a PO already exists for that
  `quotationId` (returns the existing PO's id instead of creating a duplicate). *Source: lines 39-53.*
- **Restricted to**: `Admin`, `SalesManager`, `SalesExecutive` roles. *Source: line 17-19.*
- **Data copied automatically from the Quotation** (no manual re-entry required):
  - `customerId`, `contactId`, `dealId` — copied as-is.
  - `negotiationId` — looked up separately (`Negotiation.findFirst({ quotationId })`) and linked
    if one exists.
  - Line items — mapped 1:1 from `QuotationItem` → `PurchaseOrderItem` (`productId`, `description`,
    `quantity`, `unitPrice`, `totalPrice`).
  - `paymentTerms`, `deliveryTerms` — copied verbatim.
  - `billingAddress` — copied from `Customer.billingAddress`.
  - `discountPercent` — copied from the quotation; `totalAmount`/`finalAmount` recomputed from the
    copied items (not blindly copied from the quotation's totals).
- **Data that must be entered manually at this step** (not derivable from the quotation):
  - `expectedDelivery` (optional, from request body).
  - `assignedUserId` (defaults to the creating user if not provided).
  - `notes` (appended to an auto-generated note: `"Created from Quotation {code}. {notes}"`).
- PO code format: `PO-NNNN` (4-digit, per-company sequential — note this differs from the
  `QT-YYYY-NNNNN` / `LD-YYYY-NNNNN` year-prefixed formats used elsewhere). Starts at `status: "New"`.
  *Source: lines 61-108.*
- Notifies the assigned user (if different from creator) and all `Admin`/`SalesManager` in the company.

### 2. Direct manual creation
- **Route**: `POST /api/purchase-orders` — `app/api/purchase-orders/route.ts:51-80+` (creation
  continues beyond the read window but requires `customerId` and ≥1 line item; same `PO-NNNN`
  code generator).
- Not gated on any Quotation or Deal state — a PO can exist with no upstream quotation at all.
- **Not found in code — needs confirmation** of whether this manual path is actually surfaced in
  the `/purchase-orders` UI or is only used internally/by API integrations — the presence of both
  a quotation-derived and a fully-manual creation path was confirmed, but which is the primary
  user-facing flow was not verified against the frontend component in this pass.

## What UI page(s) the user sees

- List: `/purchase-orders` (`app/(dashboard)/purchase-orders/page.tsx`).
- Detail: `/purchase-orders/{id}` (`app/(dashboard)/purchase-orders/[id]/page.tsx`) — this is
  where the "Sync to ERP" action lives (see Phase 6), and where notifications from this phase link.

## Status machine

`VALID_STATUSES = ["New", "UnderValidation", "Approved", "Rejected", "Closed"]`
*Source: `app/api/purchase-orders/[id]/route.ts:7`.*

Edited via `PUT /api/purchase-orders/[id]` (`app/api/purchase-orders/[id]/route.ts:36-194`):

| Transition | Rule |
|---|---|
| Any → `Approved` (direct, not via existing `Approved`) | Only `Admin`/`SalesManager` may set this directly. If a `Pending` `ApprovalHistory` row already exists for `entityType: "PurchaseOrder"` + this PO's id, the direct update is **blocked** — "Resolve it in the Approval Center first." *Source: lines 61-74.* |
| Any → `Approved` (via Approval Center) | `POST /api/approvals` creates a generic `ApprovalHistory` row (`entityType`, `entityId`, `approvalType`, `status: "Pending"`); resolution happens through `app/api/approvals/[id]` (not read in this pass — **not found in code — needs confirmation** of the exact resolve endpoint's cascade back to `PurchaseOrder.status`). |
| → `Approved` (either path) | Sets `approvedById = user.id`, `approvedAt = now`, clears `rejectionReason`. |
| → `Rejected` | If `body.rejectionReason` provided, it is stored. |
| → `Closed` | If `actualDelivery` isn't already set, it is auto-set to `now`. |
| Line-item edits | If `body.items` array is provided, **all** existing `PurchaseOrderItem`s are deleted and replaced (`deleteMany: {} + create: newItems`), and totals are recomputed server-side. |

- **Row-level restriction**: `SalesRep` role can only modify a PO assigned to them
  (`existing.assignedUserId !== user.id` → 403). *Source: lines 52-55.*
- On any status change, the assigned user is notified. *Source: lines 182-191.*
- Soft-delete only (`deletedAt`/`deletedById`) — `DELETE /api/purchase-orders/[id]` never hard-deletes.

## Signature / approval steps

- No electronic-signature capture code (e.g. signature pad, DocuSign-style integration) was found
  for the PO itself. The schema has `poDocumentUrl` (a stored file URL) and `validationChecklist`
  (a free-text field) on `PurchaseOrder`, suggesting the "signature" step is a manual
  upload-a-signed-PDF workflow rather than an in-app e-signature flow. **Not found in code —
  needs confirmation** of what UI writes to `poDocumentUrl`/`validationChecklist` and whether any
  external e-signature service is integrated (no such integration code was found in `app/api` or `lib`).
- Approval is role-gated (Admin/SalesManager, or via the generic Approval Center) as described above,
  but this is a status-field approval, not a document-signature approval.

## Linking a Deal to a PO (alternate branch)

`POST /api/quotations/[id]/create-deal` (covered in Phase 4) can create a Deal from an Accepted
Quotation independently of PO creation — a Deal and a PO can both trace back to the same
Quotation via `quotation.dealId`/`purchaseOrder.quotationId`, but neither creation of one forces
creation of the other.

## Edge cases found in code

- Creating a PO from an already-PO'd Quotation returns the **existing** PO's id rather than
  erroring silently or creating a duplicate — this is a deliberate idempotency guard.
- A PO's `negotiationId` link is opportunistic (`findFirst` by `quotationId`) — if multiple
  Negotiation records ever exist for the same quotation (the `negotiate` endpoint in Phase 4 only
  prevents duplicates when quotationId matches exactly), the PO would link to whichever one the
  `findFirst` query happens to return first (no explicit ordering was specified in the query).
- Manual PO creation (`POST /api/purchase-orders`) has none of the "copy from quotation" guards —
  a manually-created PO's `quotationId`/`dealId`/`negotiationId` fields would be null unless
  explicitly passed in the request body, meaning it would not appear correctly cross-linked in the
  Quotation or Deal detail views' "related records" sections.
- `PUT /api/purchase-orders/[id]` allows recomputing totals from a fresh `items` array at the same
  time as a status change in a single request — there is no lock preventing someone from both
  changing the line items *and* approving the PO in one call, which could let a PO be approved
  with items that were never separately reviewed at the new prices.
