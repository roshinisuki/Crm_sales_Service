# STRICT PROMPT — Resolve 500 on GET /api/opportunities/[id]

## Objective
`GET /api/opportunities/669e1958-53cb-4f87-857c-66c23b9b7248` returns **500 Internal Server Error**. Fix it end-to-end. Do NOT return to me until the endpoint responds with `200` and valid JSON for this exact ID.

## Hard Rules (NON-NEGOTIABLE)
1. **NO partial fixes.** NO "try this and let me know." NO "this might work." Either it is fixed and verified, or keep working.
2. **NO guessing the root cause.** You MUST reproduce the actual error and read the real stack trace before touching code.
3. **NO deleting or weakening the query.** The response shape (deal + customer + assignedUser + opportunityDetail + opportunityContacts + stageHistories + quotations + tasks + lostReasonRef + _count + rfqs) MUST stay intact.
4. **NO schema changes** unless a field/relation is genuinely missing from `prisma/schema.prisma`. If you change the schema, you MUST run `npx prisma generate` and create+apply a migration.
5. **NO mock data.** NO hardcoded fallbacks. NO try/catch that swallows the error and returns empty data.
6. **ONE root cause, ONE fix.** Do not patch symptoms.
7. **Verify before reporting done.** You MUST curl the endpoint (or hit it in the browser) and paste the `200` response. No verification = not done.

## Step-by-Step (execute ALL, in order)

### Step 1 — Capture the real error
1. Start the dev server if not running: `npm run dev` (port 3000).
2. Open a second terminal and tail the server logs.
3. Hit the failing URL with curl (replace cookie with a valid logged-in session cookie):
   ```bash
   curl -i http://localhost:3000/api/opportunities/669e1958-53cb-4f87-857c-66c23b9b7248 -H "cookie: <your-auth-cookie>"
   ```
4. Read the full stack trace printed in the server terminal. Paste it into your answer. This is mandatory — the fix MUST target the real error, not an assumption.

### Step 2 — Diagnose against the actual code
The handler is at `app/api/opportunities/[id]/route.ts` lines 8–78. It runs:
```ts
prisma.deal.findFirst({
  where: { id, deletedAt: null, companyId: user.companyId },
  include: {
    customer, assignedUser, opportunityDetail, opportunityContacts,
    stageHistories, quotations, tasks, lostReasonRef, _count
  }
})
```
Then a second query: `prisma.rFQ.findMany({ where: { customerId: deal.customerId, deletedAt: null } })`.

Check each of these against `prisma/schema.prisma` (Deal model is at line 460):
- Every relation in `include` exists on the `Deal` model.
- `customer.customerCode`, `customer.city`, `customer.status` fields exist on `Customer`.
- `opportunityContacts.contact` relation + fields (`designation`, `company`) exist on `OpportunityContact`/`Contact`.
- `stageHistories.changedBy` exists on `DealStageHistory`.
- `quotations.quotationCode`, `quotations.finalAmount`, `quotations.validUntil`, `quotations.pdfUrl` exist on `Quotation`.
- `tasks` relation exists on Deal (line 503) and `title`, `priority`, `dueDate` on `Task`.
- `lostReasonRef` → `LossReason` model has `name`.
- `rFQ` model has `rfqCode`, `customerDueDate`, `priority`.

If ANY field/relation is missing from the schema → that is your root cause. Fix the schema, regenerate, migrate.

### Step 3 — Common root causes to check (in priority order)
1. **Prisma client out of sync** — run `npx prisma generate`. If the error disappears, that was it.
2. **Missing relation/field in schema** — add it, generate, migrate.
3. **`companyId` null on the user** — if `user.companyId` is null, `findFirst` with `companyId: null` may behave unexpectedly. Confirm the auth session returns a valid `companyId`.
4. **The specific Deal row has a FK pointing to a deleted/missing row** (e.g. `customerId` references a soft-deleted Customer, `lostReasonRefId` points to a deleted LossReason). This causes Prisma include errors on some DBs. Fix the data, not the code.
5. **`opportunityDetail` has multiple rows for one `dealId`** — schema says `@unique` on `dealId`, so this should be 1:1. Confirm no duplicate rows exist.
6. **MySQL strict mode / column type mismatch** — check the actual DB column types vs schema.

### Step 4 — Apply the fix
- Make the **minimal** change that resolves the real error.
- If it's a schema fix: edit `prisma/schema.prisma`, run `npx prisma generate`, then `npx prisma migrate dev --name <descriptive>`.
- If it's a data fix: write a one-off script in `scripts/` and run it. Do NOT leave orphan-fixing logic in the route handler.
- If it's a code fix: edit only `app/api/opportunities/[id]/route.ts`. Do not touch unrelated files.

### Step 5 — Verify (MANDATORY)
1. Re-run the exact curl from Step 1.
2. The response MUST be `HTTP/1.1 200` with `success: true` and a `data` object containing the deal + all relations.
3. Paste the full curl output (status line + first 20 lines of JSON) into your final answer.
4. If it's still 500, go back to Step 1. Do NOT report back until it's 200.

### Step 6 — Regression check
- Hit `GET /api/opportunities` (list) and confirm it still returns 200.
- Open the Opportunity Detail page in the browser for this ID and confirm it renders without errors.

## Done Definition (ALL must be true)
- [ ] Real stack trace captured and pasted.
- [ ] Root cause identified and stated in one sentence.
- [ ] Minimal fix applied.
- [ ] `curl` returns `200` for `669e1958-53cb-4f87-857c-66c23b9b7248`.
- [ ] List endpoint still works.
- [ ] No new errors introduced.

If ANY of these are false, you are not done. Keep working.
