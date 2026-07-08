# Phase 6 — Fulfillment & ERP Sync

## What triggers the sync — manual only

There is exactly **one** ERP integration point in the entire codebase:

- **Route**: `POST /api/purchase-orders/[id]/sync-erp` — `app/api/purchase-orders/[id]/sync-erp/route.ts:1-222` (the file's own header comment explicitly describes this).
- **Trigger**: a user action (a button, presumably on the PO detail page `/purchase-orders/{id}`, though the specific button component was not read in this pass — the route itself is the confirmed trigger).
- **There is no**:
  - Cron job that syncs POs to ERP (no `app/api/cron/*sync*` or `*erp*` route exists).
  - Webhook receiver for inbound ERP callbacks (no route under `app/api` matching an ERP webhook pattern was found).
  - Event listener / database trigger tied to a PO status change that fires the sync automatically.
  - `**Not found in code — needs confirmation**` that this is intentional (i.e., that ERP push is
    meant to be a manual, human-initiated action rather than automatic) — but based on the code
    that exists today, that is the only mechanism.

## Precondition

- The PO must be `status === "Approved"` — any other status returns HTTP 400 with
  `"Purchase order must be in 'Approved' status before syncing to ERP"`. *Source: lines 40-46.*
- The ERP integration must be configured via two environment variables:
  - `SUKI_ERP_API_URL`
  - `SUKI_ERP_API_KEY`
  If either is missing, the endpoint returns HTTP 500 with an explicit configuration error rather
  than attempting the call. *Source: lines 48-56.*
- **Role gate**: any authenticated user except `role === "Customer"` may trigger this. *Source: lines 23-25.*

## What data is sent to ERP

The endpoint builds a JSON payload (`erpPayload`) from the PO plus its related `customer`,
`contact`, and `items` (with each item's `product`), shaped as follows (exact field names from
`app/api/purchase-orders/[id]/sync-erp/route.ts:59-102`):

```json
{
  "source": "SUKI-CRM",
  "poCode": "<PurchaseOrder.poCode>",
  "poNumber": "<PurchaseOrder.poNumber>",
  "poDate": "<PurchaseOrder.poDate>",
  "expectedDelivery": "<PurchaseOrder.expectedDelivery>",
  "customer": {
    "code": "<Customer.customerCode>",
    "name": "<Customer.name>",
    "email": "<Customer.email>",
    "phone": "<Customer.phone>",
    "address": "<PurchaseOrder.shippingAddress OR Customer.city>",
    "city": "<Customer.city>"
  },
  "contact": { "name": "...", "email": "...", "phone": "..." } | null,
  "lineItems": [
    {
      "productSku": "<Product.productCode>",
      "productName": "<Product.name OR item.description>",
      "description": "<PurchaseOrderItem.description>",
      "quantity": "<PurchaseOrderItem.quantity>",
      "unitPrice": "<PurchaseOrderItem.unitPrice>",
      "totalPrice": "<PurchaseOrderItem.totalPrice>",
      "unit": "<Product.unit>"
    }
  ],
  "totals": {
    "totalAmount": "<PurchaseOrder.totalAmount>",
    "discountPercent": "<PurchaseOrder.discountPercent>",
    "finalAmount": "<PurchaseOrder.finalAmount>"
  },
  "paymentTerms": "<PurchaseOrder.paymentTerms>",
  "deliveryTerms": "<PurchaseOrder.deliveryTerms>",
  "shippingAddress": "<PurchaseOrder.shippingAddress>",
  "billingAddress": "<PurchaseOrder.billingAddress>",
  "specialInstructions": "<PurchaseOrder.specialInstructions>",
  "notes": "<PurchaseOrder.notes>",
  "syncedAt": "<ISO timestamp, generated at send time>",
  "syncedBy": { "id": "<User.id>", "email": "<User.email>" }
}
```

- **Request**: `POST {SUKI_ERP_API_URL}/purchase-orders`, headers `Content-Type: application/json`,
  `Authorization: Bearer {SUKI_ERP_API_KEY}`, `X-Source: SUKI-CRM`. *Source: lines 116-125.*
- **Timeout**: 30 seconds, enforced via `AbortController`. *Source: line 114.*

## What comes back / how it's handled

1. **Before the call**: the PO is immediately set to `erpSyncStatus: "Pending"` and the outgoing
   payload is persisted to `PurchaseOrder.erpPayload` (as a JSON string), *before* the network
   call is made. *Source: lines 106-111.*
2. **On HTTP success (`erpResponse.ok`)**:
   - A reference number is extracted from the ERP's JSON response by trying, in order:
     `referenceNumber`, `erpReference`, `poReference`, `id`, `documentNumber` (first non-null wins;
     `null` if none of these keys are present). *Source: lines 139-145.*
   - `PurchaseOrder` is updated: `erpSyncStatus: "Synced"`, `erpReferenceNumber`, `erpSyncedAt: now`,
     `erpResponse` (the full raw JSON response, stringified).
   - An `AuditLog` entry (`module: "PurchaseOrder"`, `action: "ERPSync"`) is written.
   - Response to the CRM UI: `{ success: true, data: <updated PO>, message: "Successfully synced to ERP. Reference: {ref}" }`.
3. **On HTTP error status (ERP responded but not 2xx)**:
   - `erpSyncStatus: "Failed"`, `erpResponse` stores `{ status, body }` from the ERP's response.
   - `AuditLog` entry (`action: "ERPSyncFailed"`).
   - CRM UI receives HTTP 502 with `{ success: false, message: "ERP returned status {status}", error: <responseJson> }`.
4. **On network error / timeout**:
   - Same `erpSyncStatus: "Failed"` handling; `erpResponse` stores `{ error, type }` (where `type`
     is `"AbortError"` for a timeout, giving the message *"ERP request timed out (30s)"*).
   - CRM UI receives HTTP 502 with the error message.

## What the user sees in the CRM UI

- On success: the PO record now carries `erpSyncStatus: "Synced"` and `erpReferenceNumber` —
  the PO detail page presumably renders this (not confirmed in this pass since the frontend
  component for `/purchase-orders/[id]` was not read line-by-line — **not found in code (UI
  rendering) — needs confirmation** of exactly how the status/reference/retry button are displayed).
- On failure: `erpSyncStatus: "Failed"` is persisted, and the raw error is stored in `erpResponse`
  for later inspection — but the endpoint itself does not schedule or perform any automatic retry.
- **Retry**: because the route is idempotent by design (it can be called again on the same PO
  regardless of the previous `erpSyncStatus`, as long as the PO is still `"Approved"`), a user
  can manually re-trigger the sync by calling the endpoint again (presumably via a "Retry" button
  on the PO detail page). No backoff, rate-limiting, or retry-count field exists on `PurchaseOrder`
  to distinguish a first attempt from a retry.

## Edge cases found in code

- If the PO's status changes away from `"Approved"` after a prior failed sync (e.g. someone
  re-opens it via `PUT /api/purchase-orders/[id]` with `status: "UnderValidation"`), a retry would
  be blocked by the same `status !== "Approved"` guard — the user would need to re-approve the PO
  before retrying the ERP push.
- The reference-number extraction tries five different possible key names from the ERP's response
  — if the actual ERP integration uses a different key, `erpReferenceNumber` will silently be
  `null` even on a successful (`erpResponse.ok`) sync, and the UI message falls back to
  `"Successfully synced to ERP."` with no reference shown.
- `erpPayload` and `erpResponse` are both stored as raw JSON strings (`@db.NVarChar(Max)`) rather
  than structured/relational data — there is no `ERPSyncLog` history table, so only the **most
  recent** sync attempt's payload/response is retained per PO; a second sync attempt overwrites
  the first attempt's `erpPayload`/`erpResponse`, with only the `AuditLog` trail (`ERPSync`/`ERPSyncFailed`
  entries) preserving prior attempts (and only as a text summary, not the payload itself).
- No `Deal`, `Quotation`, `Negotiation`, or `Customer` field is updated as a result of a successful
  ERP sync — the sync's effect is scoped entirely to the `PurchaseOrder` row. **Not found in
  code — needs confirmation** of whether the customer/product/inventory data should also be
  expected to sync to ERP (e.g. for stock fulfillment tracking) — no such code exists today.
- There is no dedicated ERP "connection test" or health-check endpoint — configuration errors
  (missing env vars) only surface at the moment a real sync is attempted.
