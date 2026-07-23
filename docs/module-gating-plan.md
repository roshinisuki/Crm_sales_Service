# In-Page Module Gating — Implementation Plan

## Rules
- **Variant 4 is NEVER touched** — all modules, all features, full flow as-is
- **V1/V2/V3** see only their modules' features
- **Base pipeline never breaks** — all variants can complete lead → deal without add-ons
- **Add-ons enrich, never block** — missing modules hide/lock features but don't stop pipeline progression

## Module → Variant Mapping

| Module | V1 | V2 | V3 | V4 |
|---|---|---|---|---|
| manager_dashboard | ❌ | ✅ | ✅ | ✅ |
| customer_visits | ❌ | ✅ | ✅ | ✅ |
| product_catalogue | ❌ | ✅ | ✅ | ✅ |
| rfq | ❌ | ✅ | ✅ | ✅ |
| sample_management | ❌ | ❌ | ✅ | ✅ |
| negotiation | ❌ | ❌ | ✅ | ✅ |
| documents | ❌ | ❌ | ✅ | ✅ |
| approval_center | ❌ | ❌ | ✅ | ✅ |
| competitors | ❌ | ❌ | ❌ | ✅ |
| deals | ❌ | ❌ | ❌ | ✅ |
| purchase_orders | ❌ | ❌ | ❌ | ✅ |
| customer_assets | ❌ | ❌ | ❌ | ✅ |
| key_accounts | ❌ | ❌ | ❌ | ✅ |
| territories | ❌ | ❌ | ❌ | ✅ |
| targets | ❌ | ❌ | ❌ | ✅ |
| forecast | ❌ | ❌ | ❌ | ✅ |

---

## Phase A: Create Reusable Components

### A1. `<ModuleGate>` component
**File:** `components/ModuleGate.tsx`

A wrapper component that:
- Accepts `moduleKey` prop (e.g. `MODULE_KEYS.SAMPLE_MANAGEMENT`)
- Accepts `fallback` prop (optional — what to show if module is missing)
- If user has module → renders children normally
- If user lacks module → renders lock icon overlay with upsell text

```
<ModuleGate module={MODULE_KEYS.COMPETITORS}>
  <CompetitorIntelligenceTab ... />
</ModuleGate>
```

**Lock state UI:**
- 🔒 icon
- Text: "Available in [Module Name] module"
- "Upgrade" link → redirects to Settings page
- Same dimensions as the section would be (no layout shift)

### A2. `<LockedSection>` component
**File:** `components/ModuleGate.tsx` (same file, exported)

A variant for collapsible sections:
- Shows the section header (title, icon) so user knows the feature exists
- Body is replaced with lock overlay instead of content
- Clicking the locked body → tooltip or redirect to Settings

### A3. Helper: `useHasModule` hook
**File:** `lib/modules.ts` (already exists as `hasModule`)

Already available — components will use:
```typescript
const { user } = useAuth();
const hasMod = (key: ModuleKey) => hasModule(user, key);
```

---

## Phase B: Opportunity Detail Page

**File:** `app/(dashboard)/sales-pipeline/[id]/opportunity-detail/page.tsx`

### B1. Qualified Stage — Sample Management

**Current:** If `requiresSamples === "yes"`, shows full sample panel for everyone, holds pipeline.

**Change:**
- "Samples required?" Yes/No dropdown → **stays for all variants** (base data field)
- Sample creation form (product, quantity, specs) → **gate with `sample_management`**
- Sample status tracking (New → UnderReview → SentToCustomer → Approved/Rejected) → **gate with `sample_management`**
- Stage hold logic → **only hold if company has `sample_management`**

```
{rgForm.requiresSamples === "yes" && hasMod(MODULE_KEYS.SAMPLE_MANAGEMENT) && (
  <FullSamplePanel />
)}
{rgForm.requiresSamples === "yes" && !hasMod(MODULE_KEYS.SAMPLE_MANAGEMENT) && (
  <InfoNote text="Sample request noted. Upgrade to Sample Management to track sample lifecycle." />
)}
```

**Stage advance change (line ~902):**
```
// BEFORE:
if (requiresSamples === "yes" && toStage === "RequirementGathering") { hold; return; }

// AFTER:
if (requiresSamples === "yes" && hasMod(MODULE_KEYS.SAMPLE_MANAGEMENT) && toStage === "RequirementGathering") { hold; return; }
// Without module → advance normally
```

### B2. Requirement Gathering Stage — Product Catalogue & RFQ

**Current:** Product requirement table allows manual entry for all. Catalogue picker and RFQ shown for all.

**Change:**
- Manual product requirement entry → **stays for all** (base)
- "Pick from catalogue" button → **gate with `product_catalogue`**
- "Generate RFQ" button → **gate with `rfq`**
- RFQ Summary Card → **gate with `rfq`**
- Document upload in RG → **gate with `documents`**

### B3. Technical Discussion / Meeting Stage — Customer Visits

**Current:** Visit logging available for all.

**Change:**
- Meeting notes/demo outcome → **stays for all** (base)
- "Log Customer Visit" button → **gate with `customer_visits`**
- Visit compliance (check-in/check-out) → **gate with `customer_visits`**
- Demo document upload → **gate with `documents`**

### B4. Competitor Intelligence Section (bottom of page)

**Current:** `<CollapsibleSection title="Competitor Intelligence">` shown for all.

**Change:**
- Wrap in `<ModuleGate module={MODULE_KEYS.COMPETITORS}>`
- Without module → show `<LockedSection>` with lock icon + "Available in Competitors module"

### B5. Documents Section (bottom of page)

**Current:** `<CollapsibleSection title="Documents">` with `<EntityDocumentTab>` shown for all.

**Change:**
- Wrap in `<ModuleGate module={MODULE_KEYS.DOCUMENTS}>`
- Without module → show `<LockedSection>` with lock icon + "Available in Document Management module"

---

## Phase C: Quotation Detail Page

**File:** `app/(dashboard)/quotations/[id]/page.tsx`

### C1. Tab System Gating

**Current tabs:** `items`, `history`, `revisions`, `approvals`, `documents`, `timeline`

**Change:** Build tab array conditionally:
```typescript
const tabs = [
  { id: "items", label: "Items" },        // base — all
  { id: "history", label: "History" },     // base — all
  { id: "revisions", label: "Revisions" }, // base — all
  ...(hasMod(MODULE_KEYS.APPROVAL_CENTER) ? [{ id: "approvals", label: "Approvals" }] : []),
  ...(hasMod(MODULE_KEYS.DOCUMENTS) ? [{ id: "documents", label: "Documents" }] : []),
  { id: "timeline", label: "Timeline" },   // base — all
];
```

### C2. Action Buttons

| Button | Gate |
|---|---|
| Edit items | None — base |
| Send quotation | None — base |
| Accept / Reject | None — base |
| Clone | None — base |
| Delete | None — base |
| **Negotiate** | `negotiation` |
| **Request Approval** | `approval_center` |
| **Approve / Reject** (manager) | `approval_center` |
| **Create Purchase Order** | `purchase_orders` |
| **Generate PDF** | None — base |

### C3. Negotiation Modal

**Current:** "Start Negotiation" modal shown for all when quotation is Sent/UnderReview.

**Change:**
- "Negotiate" button → **gate with `negotiation`**
- Without module → hide button (no lock needed — it's an action, not a section)

### C4. Approval Workflow

**Current:** Margin trigger shows "Request Approval" for all. Approval tab visible for all.

**Change:**
- "Request Approval" button → **gate with `approval_center`**
- Approve/Reject buttons → **gate with `approval_center`**
- "Approvals" tab → **gate with `approval_center`** (already handled in C1)
- Without module → margin warnings still show (informational) but no approval action

### C5. Documents Tab

**Current:** Documents tab with `<EntityDocumentTab>` visible for all.

**Change:**
- "Documents" tab → **gate with `documents`** (already handled in C1)

---

## Phase D: Deal Detail Page

**File:** `app/(dashboard)/deals/[id]/page.tsx`

### D1. Discount Request Button

**Current:** Gated by `isVariant2` only.

**Change:**
- "Request Discount" button → **gate with `approval_center`** instead of `isVariant2`
- Discount approval modal → **gate with `approval_center`**

### D2. Documents Section

**Current:** `<CollapsibleSection title="Documents">` shown for all.

**Change:**
- Wrap in `<ModuleGate module={MODULE_KEYS.DOCUMENTS}>`
- Without module → `<LockedSection>`

### D3. Competitor Intelligence Section

**Current:** Not present on deal page (only on opportunity page).

**Change:** None — already absent.

### D4. Resulting Assets

**Current:** Shown when `deal.status === "Won"` and assets exist.

**Change:**
- Gate with `customer_assets`
- Without module → hide section entirely (no lock needed — it's a post-sale feature)

---

## Phase E: Customer Master / Account Pages

**File:** `app/(dashboard)/customer-master/[id]/page.tsx`

### E1. Account Detail Tabs/Sections

| Section | Gate |
|---|---|
| Account info | None — base |
| Contacts | None — base |
| Activities | None — base |
| Follow-ups | None — base |
| **Documents** | `documents` |
| **Key Account** badge/section | `key_accounts` |
| **Territory** assignment | `territories` |
| **Customer Assets** | `customer_assets` |
| **Visits** | `customer_visits` |
| **RFQs** | `rfq` |

### E2. Account Sub-Routes

Already guarded at API level. UI needs:
- `/accounts/[id]/rfqs` link → **gate with `rfq`**
- `/accounts/[id]/visits` link → **gate with `customer_visits`**
- `/accounts/[id]/documents` link → **gate with `documents`**

---

## Phase F: Sidebar (Already Done — Verify Only)

**File:** `app/(dashboard)/layout.tsx`

Already gated in Phase 7. Just verify:
- Module-gated items use `hasMod(MODULE_KEYS.X)`
- `isVariantX` still used for sub-item depth (not module access)
- No regression for V4

---

## Phase G: Server-Side Stage Advance Logic

**File:** `app/api/opportunities/[id]/stage-change/route.ts` (or equivalent)

### G1. Sample Hold Logic

**Current:** Server holds opportunity at Qualified if `requiresSamples === "yes"`.

**Change:**
- Only hold if company has `sample_management` module
- Without module → allow advance to RequirementGathering regardless of sample flag

---

## Implementation Order

| Step | Phase | Priority | Est. Effort |
|---|---|---|---|
| 1 | A1-A3: Create ModuleGate + LockedSection components | High | 1 hour |
| 2 | B1: Sample flow gating + stage hold fix | High | 30 min |
| 3 | B4-B5: Competitor + Documents sections on opportunity | High | 15 min |
| 4 | B2-B3: Catalogue/RFQ/Visits gating on opportunity | Medium | 30 min |
| 5 | C1-C5: Quotation page gating | High | 45 min |
| 6 | D1-D4: Deal page gating | Medium | 30 min |
| 7 | E1-E2: Customer master gating | Medium | 30 min |
| 8 | G1: Server-side stage advance fix | High | 15 min |
| 9 | F: Verify sidebar | Low | 5 min |
| 10 | TypeScript compile check | High | 5 min |

**Total estimated effort: ~4 hours**

---

## Testing Checklist

- [ ] V1 company: Lead → Qualify → RG (manual) → Quotation → Send → Accept → Deal → Won (full flow, no add-ons)
- [ ] V1 company: "Samples required? Yes" → deal advances normally (no hold)
- [ ] V2 company: Catalogue picker works, RFQ generation works, no sample panel
- [ ] V2 company: Customer visit tracking works, no negotiation/approval buttons
- [ ] V3 company: Sample panel works, negotiation works, approval works, no competitor section
- [ ] V4 company: Everything works exactly as before (no changes)
- [ ] Lock icon shows on locked sections with correct module name
- [ ] No TypeScript errors
- [ ] No layout shift when sections are locked vs unlocked
