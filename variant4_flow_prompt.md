# Suki CRM — Variant 4: Post-Qualification Sample Flow
## Strict Implementation Prompt for Demo

---

## OBJECTIVE

Modify the **Variant 4** lead lifecycle flow so that after a lead is qualified (BANT checklist → SQL), the system prompts the user with a **"Is a sample required?"** dialog. The answer determines the downstream path:

```
Lead Qualified (SQL)
       │
       ▼
 ┌─────────────────────┐
 │ Sample Required?    │
 └─────────────────────┘
    │              │
   NO             YES
    │              │
    ▼              ▼
Sales Pipeline   Sample Management
                     │
                     ▼
                Sales Pipeline
                     │
                     ▼
                   RFQ
                     │
                     ▼
                Quotation
                     │
                     ▼
               Negotiation
```

---

## FLOW SPECIFICATION

### Step 1 — Lead Qualification (existing, unchanged)
- User completes BANT checklist on lead detail page
- `qualifyLeadAction` is called → lead status becomes `SQL`
- Toast: "Lead qualified as SQL via BANT checklist!"

### Step 2 — Sample Required Prompt (NEW — only Variant 4)
- Immediately after successful qualification, show a **modal dialog**
- Dialog title: **"Is a sample required for this lead?"**
- Dialog body: **"If the customer needs a product sample before proceeding, select Yes to move this lead to Sample Management. Otherwise, proceed directly to Sales Pipeline."**
- Two buttons:
  - **"Yes — Send to Sample Management"** (primary, brand color)
  - **"No — Go to Sales Pipeline"** (secondary, outline)
- This dialog appears ONLY for `activeVariant === 4`
- Variants 1, 2, 3: no dialog, existing behavior unchanged

### Step 3a — User answers NO
- Close dialog
- Show toast: "Lead qualified. Proceed to Sales Pipeline."
- Navigate to `/sales-pipeline` (or the existing sales pipeline route)
- Lead remains in `SQL` status, ready for conversion to opportunity

### Step 3b — User answers YES
- Close dialog
- Update lead: set a flag `sampleRequired = true` (if field exists) or status to `Qualified`
- Show toast: "Lead moved to Sample Management"
- Navigate to `/samples` (Sample Management module)
- Lead appears in Sample Management list

### Step 4 — Sample Management → Sales Pipeline (existing flow)
- In Sample Management, the sample is processed (sent, approved/rejected)
- Once sample is approved, show a **"Create Opportunity"** banner/button on the sample record
- Clicking "Create Opportunity" moves the lead/sample to Sales Pipeline
- This creates an Opportunity record and links it back to the lead

### Step 5 — Sales Pipeline → RFQ → Quotation → Negotiation (existing flow)
- From Sales Pipeline (Opportunity), the standard flow continues:
  - Opportunity → RFQ → Quotation → Negotiation → Deal Won/Lost
- No changes to this part of the flow

---

## FILES TO MODIFY

### 1. `app/(dashboard)/leads/[id]/page.tsx`
- **Add state:** `showSamplePrompt` (boolean)
- **Add variant check:** `activeVariant` derived from `user.variant` or `user.company.variant`
- **Modify `handleBANTQualify`:** After `res.success`, if `activeVariant === 4`, set `showSamplePrompt = true`
- **Modify `handleQualify`:** Same — after success, if V4, show prompt
- **Modify `handlePostCompleteQualify`:** Same — after success, if V4, show prompt
- **Add `handleSampleRequired(sampleNeeded: boolean)`:**
  - If `true`: update lead status, toast, navigate to `/samples`
  - If `false`: toast, navigate to `/sales-pipeline`
- **Add dialog JSX:** Modal overlay with the two buttons, rendered when `showSamplePrompt === true`

### 2. `app/(dashboard)/samples/page.tsx` (if exists)
- Ensure approved samples show a **"Create Opportunity"** banner
- Clicking it should navigate to sales pipeline or trigger opportunity creation

### 3. `prisma/schema.prisma` (ONLY if needed)
- If tracking `sampleRequired` on the Lead model is desired:
  ```
  sampleRequired   Boolean?  @default(false)
  sampleStatus     String?   // null, "Requested", "Sent", "Approved", "Rejected"
  ```
- Run `npx prisma db push` after schema change
- **Skip this if the flow works without persisting the flag** (demo can work with just navigation)

---

## STRICT RULES

1. **ONLY modify Variant 4 behavior.** Variants 1, 2, 3 must work exactly as before.
2. **The prompt dialog appears ONLY after successful qualification.** Not on page load, not on status change to anything other than SQL/Qualified.
3. **Do NOT change the BANT checklist logic, validation, or UI.**
4. **Do NOT change the qualification API or server action.**
5. **Do NOT rename, refactor, or restructure existing code.** Add only.
6. **The dialog must be dismissible only by clicking one of the two buttons.** No close-on-backdrop-click for this critical decision.
7. **If the user answers YES, they MUST be navigated to `/samples`.** Do not leave them on the lead detail page.
8. **If the user answers NO, they MUST be navigated to `/sales-pipeline`.** Do not leave them on the lead detail page.
9. **Test the full flow end-to-end before marking complete.**
10. **If any existing flow breaks, revert and report immediately.**

---

## VERIFICATION CHECKLIST

- [ ] BANT qualification in V4 shows the "Sample Required?" dialog
- [ ] BANT qualification in V1/V2/V3 does NOT show the dialog (unchanged behavior)
- [ ] Clicking "Yes" navigates to `/samples`
- [ ] Clicking "No" navigates to `/sales-pipeline`
- [ ] Dialog does not appear on page refresh or re-entry
- [ ] Dialog appears after all 3 qualification paths (BANT, regular Qualify, post-complete Qualify)
- [ ] No other sidebar items, pages, or flows are affected
- [ ] No TypeScript errors introduced
- [ ] No existing tests broken

---

## CONTEXT FOR THE AI AGENT

- **Tech stack:** Next.js 14 App Router, React, Prisma (SQL Server), TypeScript
- **Auth:** `useAuth()` hook provides `user` with `role`, `variant`, `company.variant`
- **Toast:** `useToast()` hook for notifications
- **Router:** `useRouter()` from `next/navigation` for navigation
- **Lead detail page:** `app/(dashboard)/leads/[id]/page.tsx` — contains BANT tab, qualification handlers
- **Existing qualification handlers:** `handleBANTQualify`, `handleQualify`, `handlePostCompleteQualify`
- **Sample model:** `SampleRequest` exists in `prisma/schema.prisma`
- **Samples route:** `/samples` or `/sample-management` (verify which exists)
- **Sales pipeline route:** `/sales-pipeline` or `/opportunities` (verify which exists)

---

## DO NOT

- ❌ Do not change Variants 1, 2, or 3 behavior
- ❌ Do not modify the BANT checklist UI or validation
- ❌ Do not change the `qualifyLeadAction` server action
- ❌ Do not add database migrations unless strictly necessary
- ❌ Do not rename existing functions or components
- ❌ Do not touch any other page, route, or sidebar item
- ❌ Do not add comments or documentation to existing code
- ❌ Do not create test files unless explicitly asked
