# Phase 1 — Lead Generation

## Entry points

There are **three** distinct code paths that create a `Lead` record. They are not unified —
each has its own validation, own defaults, and (in two of the three) its own lead-code format.

### 1. Manual entry from the CRM UI
- **UI**: `/leads` page (`app/(dashboard)/leads/page.tsx`) — "New Lead" form/modal calls the server action.
- **Server action**: `createLeadAction()` in `app/actions/leads.ts:281-443`.
- Requires an authenticated, non-`Customer` user (`verifyAuth()` check). *Source: `app/actions/leads.ts:296-299`.*

### 2. Inbound API / website form submission
- **Route**: `POST /api/leads` — `app/api/leads/route.ts:6-260`.
- Protected by an API key header (`x-api-key`), checked against `SystemConfig` key `leads_api_key`, falling back to `process.env.LEADS_API_KEY`, and finally to the **hardcoded literal `"suki_secret_key_123"`** if neither is set. *Source: `app/api/leads/route.ts:12-17`.* This hardcoded fallback is a notable security concern worth flagging to the team, though out of scope to fix here (documentation-only task).
- Intended for external website/form integrations — no CRM session/user auth is required, only the API key.

### 3. Bulk CSV/Excel import
- **Route**: `POST /api/leads/import` — `app/api/leads/import/route.ts:72-367`.
- Requires an authenticated `Admin` or `SalesManager` role (`app/api/leads/import/route.ts:76-78`).
- Accepts `.csv`, `.xlsx`, `.xls` with a user-supplied column-to-field `mapping`.
- Runs a Zod schema (`LeadImportRowSchema`) per row and validates `status`/`leadSource` against fixed allow-lists (`VALID_STATUSES`, `VALID_SOURCES`). *Source: `app/api/leads/import/route.ts:8-9, 11-30`.*
- Duplicate rows (matched by email or phone against existing non-deleted leads) are either merged (`duplicateAction=update`) or the **existing** lead is flagged `status = "Duplicate"` (`duplicateAction=skip`, the default) — the import does **not** create a second row for a duplicate.

## Required fields and validation

| Path | Required fields | Source |
|---|---|---|
| `createLeadAction` (manual) | `name`, `phone`, `email`, `city`, `companyName` (all trimmed, non-empty); `estimatedValue` must be `>= 0` if provided | `app/actions/leads.ts:308-327` |
| `POST /api/leads` (inbound) | `name` only; email/phone/city are optional | `app/api/leads/route.ts:23-25` |
| `POST /api/leads/import` (bulk) | `name` (Zod `min(1)`); `email` must be valid format if present | `app/api/leads/import/route.ts:11-14` |

**Duplicate detection**:
- `createLeadAction` blocks creation outright if a non-deleted Lead with the same `email` exists in the same `companyId`. *Source: `app/actions/leads.ts:330-337`.*
- `POST /api/leads` blocks on duplicate `email` **or** `phone` (`prisma.lead.findUnique`/`findFirst`), globally (no `companyId` filter is applied to this specific duplicate check). *Source: `app/api/leads/route.ts:33-51`.*
- Additionally, `createLeadAction` runs a secondary, **non-blocking** `detectDuplicates()` pass after creation (fire-and-forget, errors swallowed). *Source: `app/actions/leads.ts:432`.* The implementation of `detectDuplicates()` itself was not read in this pass — **not found in code — needs confirmation** of exactly what heuristic it applies beyond exact email/phone match.

## Default values on creation

All three paths set:
- `status = "New"`
- `slaStatus = "Pending"`
- `slaResponseDeadline` = now + 15 minutes (`createLeadAction`: `app/actions/leads.ts:353-354`; inbound API: `app/api/leads/route.ts:122-123`)
- `escalationLevel = 0`

Lead code formats differ by path:
- `createLeadAction`: `LD-YYYY-NNNNN` via `generateLeadCode()` (per-company sequential). *Source: `app/actions/leads.ts:340`.*
- `POST /api/leads` (inbound): `LEAD-W<5 random digits>`, retried up to 10 times for uniqueness, falling back to a timestamp suffix. *Source: `app/api/leads/route.ts:108-119`.*
- `POST /api/leads/import`: `LD-YYYY-NNNNN`, same generator pattern as manual creation but offset per batch position. *Source: `app/api/leads/import/route.ts:35-43`.*

`createLeadAction` additionally computes a `leadScore` (0-100) via `calculateLeadScore()` based on `industryType`, `leadSource`, `designation`, `estimatedValue`, presence of email/phone. *Source: `app/actions/leads.ts:342-350`.* The bulk import path leaves `leadScore = 0` for every imported row (no scoring is run). *Source: `app/api/leads/import/route.ts:269`.*

## What gets created/updated

| Table (Prisma model) | Written by |
|---|---|
| `Lead` | All 3 paths |
| `LeadStatusHistory` (initial `null → "New"` or `null → status`) | `createLeadAction` (`app/actions/leads.ts:382`), bulk import (`app/api/leads/import/route.ts:275-277`). The inbound `POST /api/leads` path does **not** write an initial `LeadStatusHistory` row — only `AuditLog`. |
| `LeadOwnerHistory` (initial assignment) | `createLeadAction` (`app/actions/leads.ts:385-393`), inbound API (`app/api/leads/route.ts:162-172`). Bulk import does not write `LeadOwnerHistory`. |
| `FollowUp` (auto-created, `type = "Call"`, next business day 9am, `sourceType = "AUTO"`) | Only `createLeadAction` (`app/actions/leads.ts:395-416`). The equivalent block in `POST /api/leads` is explicitly commented out (`// DISABLED: Only SLA countdown should show...`, `app/api/leads/route.ts:174-195`) — **inbound leads do not get an auto follow-up task.** |
| `CallLog` | Only inbound API, and only if a `message` was submitted with the enquiry (`app/api/leads/route.ts:198-207`). |
| `AuditLog` | All 3 paths. |
| `Notification` | `createLeadAction` and inbound API notify the assigned user and (for `createLeadAction`) managers via `dispatchNotification`/`dispatchNotificationsToMany`. |

## Assignment / routing logic

- `createLeadAction`: assigns to `assignedUserId` param if given, else to the creating user (self-assignment). *Source: `app/actions/leads.ts:365`.*
- `POST /api/leads` (inbound) implements **workload-based round robin**: reads `SystemConfig` keys `leads_assignment_mode` (`ROUND_ROBIN` default or `DEFAULT_POOL`) and `leads_default_assignee_id`. In round-robin mode, it queries all active `SalesExecutive` users, counts each one's currently `New`/`Contacted` leads, and assigns to whichever has the fewest (least-busy-first). Falls back to `SalesManager` role if no executives exist, then to any `Admin`. *Source: `app/api/leads/route.ts:53-106`.*
- Bulk import: only assigns if an `assignedToEmail` column was mapped and resolves to an active user in the same company; otherwise the row is imported unassigned. *Source: `app/api/leads/import/route.ts:220-229, 242`.*

## Where the lead lands / who can see it

- After creation, all paths link back to `/leads/{id}` in notifications, meaning the Lead Detail page is `app/(dashboard)/leads/[id]/page.tsx`.
- The list view is `app/(dashboard)/leads/page.tsx`.
- `createLeadAction` specifically links to `/leads/{id}?action=contact` in the assignment notification, which auto-opens the Call Log modal on the detail page for the first interaction. *Source: `app/actions/leads.ts:427`.*
- Visibility is governed by `checkRecordScope()` from `lib/scopes.ts` (row-level security) — the inbound API path and manual creation path both filter by `companyId` (multi-tenant), and `SalesExecutive` visibility is further scoped (see `app/api/rfq/route.ts:27` for an example of the same pattern applied elsewhere — the Lead-specific scope function itself is in `lib/scopes.ts`, not re-read line-by-line in this pass — **not found in code (exact rules) — needs confirmation** of the full row-level-security matrix per role for Leads specifically).

## Edge cases found in code

- **Hardcoded API key fallback** (`"suki_secret_key_123"`) in `POST /api/leads` if no `SystemConfig`/env value is configured — anyone with this literal string can create leads. *Source: `app/api/leads/route.ts:14`.*
- **Duplicate-by-phone check in `POST /api/leads` is not company-scoped** (`prisma.lead.findFirst({ where: { phone: normalizedPhone } })` has no `companyId` filter), unlike the email check pattern used elsewhere — in a multi-tenant deployment this could block a legitimate lead in Company B because a lead with the same phone exists in Company A. *Source: `app/api/leads/route.ts:43-51`.*
- **Auto follow-up task is disabled for inbound leads** (commented out), so an inbound Lead's *only* time pressure is the 15-minute SLA countdown, with no follow-up task appearing in the Follow-Ups module until someone manually creates one.
- **Bulk import duplicate handling mutates the *existing* lead's status to `"Duplicate"`**, not the incoming row — this could silently change the status of an active, in-progress lead if it happens to share an email/phone with an imported row, without a value judgement on whether the existing one is genuinely a duplicate.
- Import validates `status` against a hardcoded list that does **not** include `"Duplicate"` or `"Converted"` (`VALID_STATUSES = ["New","Contacted","FollowUpDue","SQL","Qualified","Lost"]`) — importing a row with `status="Converted"` would fail validation, even though `"Converted"` is a valid runtime status elsewhere in the code.
