# Sales CRM → Service CRM Handoff Workflow

## PO Acceptance → CustomerAsset Auto-Creation

---

## Step 1 — Audit Findings

### 1.1 Account vs Customer Model

**There is no separate `Account` model.** The system uses a single `Customer` model (`prisma/schema.prisma:139`) that serves as the "Account" entity in Sales CRM:

- **Model:** `Customer`
- **Status field:** `status` (default `"Prospect"`) — represents the Sales CRM account lifecycle
- **Account-type field:** `accountType` (default `"Prospect"`)
- **Lifecycle values observed:** `Prospect`, `ActiveCustomer`, `Inactive` (per navigation config filters in `lib/canonical-navigation-config.ts:96-98`)
- **Lead → Customer conversion:** `Customer.convertedFromLead` (String?, stores the lead ID/reference)

A Lead becomes a Customer (Account) when qualified/converted. This Customer record is the **same** record that Service CRM references — there is one unified customer table, no duplication.

### 1.2 Service CRM's Customer Dependency

Service CRM modules (`ServiceRequest`, `Complaint`, `Defect`, `Installation`, `WarrantyClaim`, `AMCContract`, `CustomerAsset`) all have a `customerId` foreign key pointing to the **same** `Customer` model. Confirmed via relation definitions on `Customer` at `prisma/schema.prisma:152-157` and `CustomerAsset.customer` at `prisma/schema.prisma:2485`.

### 1.3 What Happens Today When a PO Is Accepted

**Two paths lead to PO "Approved" status:**

1. **Direct PUT** (`app/api/purchase-orders/[id]/route.ts:64`) — Admin/SalesManager sets `status: "Approved"` directly
2. **Approval Center** (`app/api/approvals/[id]/route.ts:77`) — PO approval request is approved via PATCH

**Before this change:** Both paths only:
- Set `approvedById` / `approvedAt` on the PO
- Transitioned the linked Deal to `"Won"` status via `transitionDealStatus()`
- Sent notifications to the assigned user

**Nothing wrote to `CustomerAsset`.** No Service CRM data was created. The handoff was completely manual.

### 1.4 CustomerAsset Back-References (Before vs After)

| Field | Before | After |
|---|---|---|
| `customerId` | ✅ (FK to Customer) | ✅ (unchanged) |
| `serialNumber` | ✅ (unique) | ✅ (unchanged) |
| `productName` | ✅ | ✅ (unchanged) |
| `purchaseDate` | ✅ (nullable) | ✅ (unchanged) |
| `warrantyExpiryDate` | ✅ (nullable) | ✅ (unchanged) |
| `amcExpiryDate` | ✅ (nullable) | ✅ (unchanged) |
| `purchaseOrderId` | ❌ did not exist | ✅ **NEW** — FK to `PurchaseOrder` |
| `productId` | ❌ did not exist | ✅ **NEW** — FK to `Product` |
| `dealId` | ❌ did not exist | ✅ **NEW** — FK to `Deal` |

---

## Step 2 — Term Definitions

### Customer Account (Sales CRM side)

- **Represents:** A company/organization that Sales CRM is engaging with, from Lead qualification/conversion onward.
- **Model:** `Customer` (same model, no separate Account table)
- **Lifecycle:** Tracked by `Customer.status` — `Prospect` → `ActiveCustomer` → `Inactive`
- **Scope:** Can exist with zero, one, or many Deals/POs over its lifetime. Being a Customer/Account does NOT mean Service CRM has anything to do yet.

### Service-Active Customer (Service CRM side)

- **Represents:** A customer who has at least one **Approved PO** with a specific purchased product/asset, and is therefore now relevant to Service CRM.
- **Trigger event:** The exact moment a PO's status becomes `"Approved"`.
- **Scope:** Created per PO line item, not per Account. A single Customer Account may have multiple `CustomerAsset` records over time (one per approved PO product line). Service CRM tracks each purchased asset individually.
- **No new table:** `CustomerAsset` is the bridge record — it references the same `Customer` from Sales CRM, plus the specific product, PO, deal, purchase date, warranty expiry, and AMC expiry.

---

## Step 3 — Implemented Workflow

### Trigger Point

When a PO's status changes to `"Approved"` (from either path):

1. **Direct PUT** at `app/api/purchase-orders/[id]/route.ts:188`
2. **Approval Center PATCH** at `app/api/approvals/[id]/route.ts:98`

Both call `createCustomerAssetsFromPO(poId, userId)` from `lib/service-handoff.ts`.

### What the Trigger Does

For each `PurchaseOrderItem` on the approved PO:

1. **Checks** if a `CustomerAsset` already exists for the same `purchaseOrderId` + `productId` (idempotent)
2. **If exists:** Updates `productName`, `purchaseDate`, and `dealId`
3. **If new:** Creates a `CustomerAsset` with:

| Field | Value |
|---|---|
| `customerId` | From `PO.customerId` (same Sales CRM Customer) |
| `serialNumber` | Placeholder: `{poCode}-ITEM-{n}` (real serial assigned during Installation) |
| `productName` | From `PurchaseOrderItem.description` |
| `purchaseDate` | `PO.approvedAt` (or `PO.poDate` or `now()`) |
| `warrantyExpiryDate` | `null` (set manually or during Installation — no warranty-duration master data on `Product` today) |
| `amcExpiryDate` | `null` (set when AMC is purchased) |
| `status` | `"Active"` |
| `purchaseOrderId` | The approved PO's ID |
| `productId` | From `PurchaseOrderItem.productId` (if linked) |
| `dealId` | From `PO.dealId` (if linked) |

4. **Audit log:** Records the auto-creation with PO code, customer name, and counts.
5. **No other Service CRM module is triggered** — no Installation, Service Request, Complaint, or Visit is auto-created.

### Real-Time Guarantee

The `createCustomerAssetsFromPO()` function runs synchronously within the same request handler that sets the PO to "Approved". The `CustomerAsset` records are committed to the database before the API response is returned. No batch job, no queue, no manual sync — the asset is queryable immediately.

### What Is NOT Done

- ❌ No new duplicate Customer/Account table for Service CRM
- ❌ No auto-trigger of Installation, Service Request, or any other Service CRM workflow
- ❌ No changes to Sales CRM's existing Account status lifecycle or PO status lifecycle
- ❌ No changes to any UI beyond the Customer Assets page (now shows "Originating PO" column + detail)

---

## Step 4 — Files Changed

| File | Change |
|---|---|
| `prisma/schema.prisma` | Added `purchaseOrderId`, `productId`, `dealId` fields + relations + indexes to `CustomerAsset`; added back-reference relations on `PurchaseOrder`, `Product`, `Deal` |
| `lib/service-handoff.ts` | **NEW** — `createCustomerAssetsFromPO()` helper (idempotent, audited) |
| `app/api/purchase-orders/[id]/route.ts` | Import + trigger call after PO approval (line 188) |
| `app/api/approvals/[id]/route.ts` | Import + trigger call after Approval Center PO approval (line 98) |
| `app/api/service/assets/route.ts` | **NEW** — GET endpoint to list CustomerAssets with customer, PO, product, deal includes |
| `app/(dashboard)/service/assets/page.tsx` | Replaced mock data with real API fetch; added "Originating PO" column; detail view shows PO code + opportunity code; added refresh button |

---

## Step 5 — Test Plan

### Before/After Test: PO Acceptance → CustomerAsset Appears

**Prerequisites:**
- A Customer exists in Sales CRM
- A Deal (Opportunity) is linked to that Customer
- A Quotation has been Accepted and converted to a PO (or a PO was created directly)
- The PO has at least one line item with a product

**Test Steps:**

1. **Before:** Navigate to Service CRM → Customer Assets (`/service/assets`)
   - Confirm: No assets exist for this customer yet (or note existing count)

2. **Action:** Approve the PO
   - Path A: As Admin/SalesManager, edit the PO and set status to "Approved"
   - Path B: Submit a PO approval request via Approval Center, then approve it as Admin/SalesManager

3. **After:** Navigate back to Service CRM → Customer Assets
   - Click Refresh
   - **Confirm:** New `CustomerAsset` record(s) appear immediately
   - **Confirm:** Each record's `customer.name` matches the PO's customer
   - **Confirm:** `productName` matches the PO line item description
   - **Confirm:** `purchaseDate` equals the PO approval date
   - **Confirm:** "Originating PO" column shows the correct `poCode`
   - **Confirm:** Clicking "View Details" shows the PO code and opportunity code

4. **Idempotency test:** Re-approve the same PO (set status to "Approved" again)
   - **Confirm:** No duplicate `CustomerAsset` records are created
   - **Confirm:** Existing records are updated, not duplicated

5. **Zero manual entry:** At no point did the user need to manually create a Customer Asset in Service CRM — it appeared automatically upon PO approval.

---

## Migration Note

The schema changes add three nullable columns (`purchaseOrderId`, `productId`, `dealId`) to `CustomerAsset` and three new indexes. Since all are nullable, existing rows are unaffected.

**To apply:** Run `npx prisma migrate dev --name add_customerasset_sales_links` (requires shadow DB permissions — may need DBA assistance per P3014 constraint on SQL Server). Alternatively, the DBA can apply:

```sql
ALTER TABLE CustomerAsset ADD purchaseOrderId NVARCHAR(36) NULL;
ALTER TABLE CustomerAsset ADD productId NVARCHAR(36) NULL;
ALTER TABLE CustomerAsset ADD dealId NVARCHAR(36) NULL;
CREATE INDEX IX_CustomerAsset_purchaseOrderId ON CustomerAsset(purchaseOrderId);
CREATE INDEX IX_CustomerAsset_productId ON CustomerAsset(productId);
CREATE INDEX IX_CustomerAsset_dealId ON CustomerAsset(dealId);
```

After the schema is applied, run `npx prisma generate` to update the client.
