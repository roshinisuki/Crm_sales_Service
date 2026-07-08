# Phase 2 — Lead Qualification & Follow-Up

## Status values observed in code

The `Lead.status` field (`prisma/schema.prisma:754`, default `"New"`) is a free-text `String`,
not a Prisma enum. Observed values actually written by code:

`New` → `Contacted` → `SQL` → `Converted`, with `Lost` and `Duplicate` as side-exits.
(`lib/crm-pipeline.ts:3` separately types a `LeadStatus` union of `"New" | "Contacted" | "FollowUpDue" | "SQL" | "Qualified" | "Converted" | "Lost"` — note it lists `"Qualified"` as a distinct value from `"SQL"`, but no lead action in `app/actions/leads.ts` was found that sets `status = "Qualified"` on a Lead; `qualifyLeadAction` sets `"SQL"`. **Not found in code — needs confirmation** of whether `"Qualified"`/`"FollowUpDue"` are ever actually written to `Lead.status` anywhere outside `lib/crm-pipeline.ts`'s type declaration.)

## New → Contacted

- **Entry point**: User logs a call from the Lead Detail page (`/leads/{id}`), typically via the `?action=contact` auto-opened modal.
- **Action**: `contactLeadAction(leadId, callData)` — `app/actions/leads.ts:747-913`.
- **Gate**: only allowed when `lead.status === "New"` (returns an error otherwise); `callData.content` (call notes) is **mandatory** — "no silent status updates" is enforced by design. *Source: `app/actions/leads.ts:778-785`.*
- **What gets written**:
  - A `CommunicationLog` row (`channel: "Call"`) is created **first**.
  - Only after that succeeds is `Lead.status` set to `"Contacted"`, plus `lastInteractionAt = now`.
  - If this is the first response (`!lead.firstRespondedAt`), `slaStatus = "Met"` and `firstRespondedAt = now` are also set — i.e., the 15-minute SLA clock is satisfied by this action. *Source: `app/actions/leads.ts:826-834`.*
  - The auto-created `FollowUp` (from Phase 1, `type: "Call"`, `sourceType: "AUTO"`) is marked `status: "Completed"`. *Source: `app/actions/leads.ts:838-850`.*
- **Notifications**: assigned user + all `Admin`/`SalesManager` in the same company. *Source: `app/actions/leads.ts:873-899`.*
- **Edge case**: if `lead.status !== "New"` the action fails outright with a message — there is no path to log a *second* call through this specific action; later calls presumably go through a different generic activity-logging action (not traced in this pass — **not found in code — needs confirmation**).

## Qualification: BANT → SQL

- **Entry point**: BANT checklist form on the Lead Detail page.
- **Action**: `qualifyLeadAction(leadId, { hasBudget, hasAuthority, hasNeed, timelineMonths })` — `app/actions/leads.ts:1281-1343`.
- **Business rule**: `hasBudget && hasAuthority && hasNeed` must all be `true`, and `timelineMonths > 0`, or the action returns a validation error without touching the record. *Source: `app/actions/leads.ts:1291-1296`.*
- **Edge case — no status guard**: unlike `contactLeadAction`, this action does **not** check the Lead's current `status` before transitioning — it can be called on a Lead in `"New"`, `"Contacted"`, or any other non-terminal state, and will still force `status = "SQL"`. There is no enforcement that a Lead must be `"Contacted"` first.
- **What gets written**: `status = "SQL"`, `budgetAsked` and `timelineAsked` overwritten with derived text, `isGenuine = hasNeed`; a `LeadStatusHistory` row; notification to all `Admin`/`SalesManager`.

## Mark Lost

- **Action**: `markLeadLostAction(leadId, lossReasonId, notes?)` — `app/actions/leads.ts:1349-1408`.
- **Required**: `lossReasonId` referencing a `LossReason` record — action fails without it. *Source: `app/actions/leads.ts:1356-1358`.*
- **Cascading effect**: all `Pending` `FollowUp` rows for that lead are bulk-updated to `status: "Cancelled"`. *Source: `app/actions/leads.ts:1382-1386`.*
- Writes `Lead.status = "Lost"`, `lostReason` (text), `lostReasonRefId`; a `LeadStatusHistory` row; notifies the assigned user.
- No lower-bound status check exists here either — a Lead in any status can be marked Lost.

## Follow-up creation, reminders, and escalation

- **Creation on lead creation**: covered in Phase 1 — only `createLeadAction` auto-creates the first `FollowUp` (`type: "Call"`, next business day 9am).
- **Manual creation**: `createFollowUpAction()` — `app/actions/followUps.ts:263-379` (used broadly across modules, not lead-specific).
- **Overdue sweep + escalation**: `checkAndUpdateOverdueFollowUps(companyId?)` — `app/actions/followUps.ts:34-154`.
  - Finds `Pending` follow-ups whose `nextMeetingDate` has passed → sets `status = "Overdue"`.
  - Of those, if `nextMeetingDate` is more than **48 hours** in the past, also sets `escalationLevel = 1` immediately.
  - Separately re-scans existing `Overdue` follow-ups still at `escalationLevel = 0` whose `nextMeetingDate` is >48h past, and escalates them too.
  - On escalation: writes an `AuditLog` (`module: "follow-up"`, `action: "escalate"`) and notifies all `Admin`/`SalesManager` in the company via `dispatchNotificationsToMany`. *Source: `app/actions/followUps.ts:96-153`.*
- **Trigger for this sweep function — not a dedicated cron route**: `checkAndUpdateOverdueFollowUps` is called from `app/actions/visits.ts`, `app/api/reports/followups/route.ts`, and the standalone script `scripts/email-scheduler.ts` (see below) — i.e. it appears to run **on-demand** whenever those code paths execute (e.g., when a user loads the Follow-Ups report), not on a fixed schedule inside the Next.js app itself. **Not found in code — needs confirmation** of whether there is additionally a dedicated `/api/cron/*` route for this (no `app/api/cron/follow-ups*` directory exists in the repo).
- **Standalone scheduled process**: `scripts/email-scheduler.ts` uses `node-cron` and explicitly schedules:
  - `cron.schedule("0 8 * * *", sendOverdueSummaries)` — daily at 8:00 AM, calls `checkAndUpdateOverdueFollowUps()` then emails a summary of `Overdue` follow-ups to each assigned user via `nodemailer`. *Source: `scripts/email-scheduler.ts:17-22, 120-122`.*
  - `cron.schedule("*/30 * * * *", runVisitsAutoCheckout)` — every 30 minutes.
  - This script is **not** part of the Next.js request lifecycle — it must be run as its own long-lived Node process (e.g. `node scripts/email-scheduler.ts` or a PM2/systemd unit). **Not found in code — needs confirmation** of how/whether this script is actually started in the deployed environment.
- **Rescheduling**: `rescheduleFollowUpAction()` resets `escalationLevel = 0` if the new date is in the future (`app/actions/followUps.ts:840`), otherwise leaves status as `"Overdue"`.

## Scoring / routing recap (from Phase 1, restated for completeness)

- Lead scoring (`calculateLeadScore`) only runs at manual creation via `createLeadAction`; it is not re-computed as qualification data changes (e.g. `qualifyLeadAction` does not recompute `leadScore` even though it collects budget/timeline/need signals).
- Routing/assignment logic is one-time at creation (Phase 1); no reassignment/round-robin re-balancing was found triggered by qualification events. A manual `reassignFollowUpAction` exists (`app/actions/followUps.ts:865-938`) for follow-ups specifically, but not for the Lead's `assignedUserId` itself outside of `LeadOwnerHistory`-tracked manual reassignment (not traced further in this pass).

## Edge cases

- A Lead can jump straight from `"New"` to `"SQL"` (skipping `"Contacted"`) because `qualifyLeadAction` has no status precondition.
- A Lead already `"Converted"` can still be run through `qualifyLeadAction` or `markLeadLostAction` — neither of those two actions checks for `status === "Converted"` (only the convert actions themselves guard against double-conversion; see Phase 3).
- Follow-ups belonging to a Lost lead are cancelled, but follow-ups already `Completed` are left untouched (only `Pending` ones are bulk-cancelled).
