/**
 * Module Status Configuration Registry
 *
 * Maps each of the 10 CRM modules to their actual backend status values.
 * "Overview" (value: "") is NOT listed here — it's auto-prepended by StatusFilterBar.
 *
 * Per Section 5.1 of the spec: "The 'Overview' filter is not a backend status value —
 * it means 'no status filter applied.'"
 *
 * IMPORTANT: These values match the actual API/DB enum values, not the spec's
 * suggested display labels. The spec explicitly says "no changes to APIs, schema,
 * business logic" — so we use the real backend values.
 */

import type { StatusOption } from "@/components/shared/StatusFilterBar";

export interface ModuleStatusConfig {
  /** Module identifier */
  id: string;
  /** Display name for the module (used as page heading, never "Overview") */
  title: string;
  /** Route path */
  path: string;
  /** API endpoint for fetching list data */
  apiEndpoint: string;
  /** Status options (without "Overview" — auto-prepended) */
  statuses: StatusOption[];
  /** URL param key for status filtering */
  statusParamKey?: string;
}

// ─── 1. Pipeline ──────────────────────────────────────────────────────────────
// Backend: Deal.status field, values from PipelineStageMaster + Lost
// API: /api/opportunities?stage={value}

/**
 * Canonical pipeline stage values — SINGLE SOURCE OF TRUTH.
 * All frontend and backend code MUST import from here.
 * Do NOT define stage lists inline in route handlers or components.
 */
export const PIPELINE_STAGE_VALUES = [
  "Qualified",
  "RequirementGathering",
  "TechnicalDiscussion",   // Promoted from RG checkbox to its own real stage
  "MeetingScheduled",
  "DemoConducted",
  "DemoAccepted",          // End of forward pipeline
  "Won",                   // Deal won (PO approved or accepted quotation)
  "OnHold",                // Deal paused (quotation/PO no response)
  "Rejected",
  "Lost", // terminal — kept for legacy compatibility
] as const;

export type PipelineStage = (typeof PIPELINE_STAGE_VALUES)[number];

/** Stage display order (higher = further in pipeline) */
export const PIPELINE_STAGE_ORDER: Record<string, number> = {
  Qualified:              1,
  RequirementGathering:   2,
  TechnicalDiscussion:    3,
  MeetingScheduled:       4,
  DemoConducted:          5,
  DemoAccepted:           6,
  Won:                    7,
  OnHold:                 0,   // Not a pipeline progression — a pause state
  Rejected:               0,
  Lost:                   0,
};

/** Default probability percent per stage */
export const PIPELINE_STAGE_PROBABILITY: Record<string, number> = {
  Qualified:              20,
  RequirementGathering:   35,
  TechnicalDiscussion:    50,
  MeetingScheduled:       75,
  DemoConducted:          85,
  DemoAccepted:           100,
  Won:                   100,
  OnHold:                 0,
  Rejected:                0,
  Lost:                    0,
};

/** Terminal stages (no further pipeline progression) */
export const PIPELINE_CLOSED_STAGES = ["DemoAccepted", "Won", "Lost", "Rejected"];

/** High-level health statuses shown in the Status column */
export type DealHealthStatus = "Active" | "OnHold" | "Won" | "Lost";

/**
 * Derive a high-level health status from the deal's pipeline stage.
 * - Won/DemoAccepted → Won
 * - Lost/Rejected → Lost
 * - OnHold → OnHold
 * - All other stages → Active
 */
export function deriveHealthStatus(stage: string): DealHealthStatus {
  if (["Won", "DemoAccepted"].includes(stage)) return "Won";
  if (["Lost", "Rejected"].includes(stage)) return "Lost";
  if (stage === "OnHold") return "OnHold";
  return "Active";
}

/** Open stages eligible for overdue computation */
export const PIPELINE_OPEN_STAGES = ["Qualified", "RequirementGathering", "TechnicalDiscussion", "MeetingScheduled", "DemoConducted"];

/**
 * Normalize a stage string: trim whitespace and match exact case.
 * Returns the canonical stage value or null if invalid.
 */
export function normalizeStage(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const match = PIPELINE_STAGE_VALUES.find(
    (s) => s === trimmed || s.toLowerCase() === trimmed.toLowerCase()
  );
  return match ?? null;
}

/**
 * Validate that a stage value is a recognized pipeline stage.
 * Uses normalization (trim + case-insensitive match) to prevent
 * whitespace or casing differences from causing false rejections.
 */
export function isValidStage(raw: string): boolean {
  return normalizeStage(raw) !== null;
}

export const PIPELINE_STATUS: StatusOption[] = [
  { label: "Qualified", value: "Qualified" },
  { label: "Req. gathering", value: "RequirementGathering" },
  { label: "Tech. discussion", value: "TechnicalDiscussion" },
  { label: "Meeting scheduled", value: "MeetingScheduled" },
  { label: "Demo conducted", value: "DemoConducted" },
  { label: "Demo accepted", value: "DemoAccepted" },
  { label: "Overdue", value: "overdue" },
  { label: "Rejected", value: "Rejected" },
  { label: "Lost", value: "Lost" },
];

// ─── 2. Deals ─────────────────────────────────────────────────────────────────
// Backend: Deal.status field
// API: /api/deals (server action getDealsAction, client-side filter)
export const DEALS_STATUS: StatusOption[] = [
  { label: "Qualified", value: "Qualified" },
  { label: "Req. Gathering", value: "RequirementGathering" },
  { label: "Tech. Discussion", value: "TechnicalDiscussion" },
  { label: "Meeting Scheduled", value: "MeetingScheduled" },
  { label: "Demo Conducted", value: "DemoConducted" },
  { label: "Demo Accepted", value: "DemoAccepted" },
  { label: "On Hold", value: "OnHold" },
  { label: "Won", value: "Won" },
  { label: "Lost", value: "Lost" },
  { label: "Rejected", value: "Rejected" },
  { label: "At Risk", value: "risk" },
];

// ─── 3. Quotes (Quotations) ───────────────────────────────────────────────────
// Backend: Quotation.status field
// API: /api/quotations?status={value}
export const QUOTES_STATUS: StatusOption[] = [
  { label: "Draft", value: "Draft" },
  { label: "Sent", value: "Sent" },
  { label: "Under Review", value: "UnderReview" },
  { label: "Accepted", value: "Accepted" },
  { label: "Rejected", value: "Rejected" },
  { label: "Expired", value: "Expired" },
  { label: "On Hold", value: "OnHold" },
];

// ─── 4. Orders (Purchase Orders) ──────────────────────────────────────────────
// Backend: PurchaseOrder.status field
// API: /api/purchase-orders?status={value}
export const ORDERS_STATUS: StatusOption[] = [
  { label: "New", value: "New" },
  { label: "Under Validation", value: "UnderValidation" },
  { label: "On Hold", value: "OnHold" },
  { label: "Approved", value: "Approved" },
  { label: "Rejected", value: "Rejected" },
  { label: "Closed", value: "Closed" },
];

// ─── 5. Requests (RFQ) ────────────────────────────────────────────────────────
// Backend: RFQ.status field
// API: /api/rfq?status={value}
export const REQUESTS_STATUS: StatusOption[] = [
  { label: "New", value: "New" },
  { label: "Under Review", value: "UnderReview" },
  { label: "Costing Pending", value: "CostingPending" },
  { label: "Quotation Created", value: "QuotationCreated" },
  { label: "Closed", value: "Closed" },
];

// ─── 6. Activity (Visits) ─────────────────────────────────────────────────────
// Backend: Visit.status field
// API: /api/visits?status={value}
export const ACTIVITY_STATUS: StatusOption[] = [
  { label: "Planned", value: "PLANNED" },
  { label: "Checked In", value: "CHECKED_IN" },
  { label: "Checked Out", value: "CHECKED_OUT" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Missed", value: "MISSED" },
  { label: "Unavailable", value: "CUSTOMER_UNAVAILABLE" },
  { label: "Auto Checked Out", value: "AUTO_CHECKED_OUT" },
];

// ─── 7. Catalog (Samples) ─────────────────────────────────────────────────────
// Backend: Sample.status field
// API: /api/samples?status={value}
export const CATALOG_STATUS: StatusOption[] = [
  { label: "New", value: "New" },
  { label: "Under Review", value: "UnderReview" },
  { label: "Sent to Customer", value: "SentToCustomer" },
  { label: "Approved", value: "Approved" },
  { label: "Rejected", value: "Rejected" },
  { label: "Revision", value: "Revision" },
];

// ─── 8. Portfolio (Key Accounts / Customers) ──────────────────────────────────
// Backend: Customer.status field
// API: /api/customers?status={value} (via getCustomersAction)
export const PORTFOLIO_STATUS: StatusOption[] = [
  { label: "Active Customer", value: "ActiveCustomer" },
  { label: "Prospect", value: "Prospect" },
  { label: "Renewed", value: "Renewed" },
  { label: "Churned", value: "Churned" },
];

// ─── 9. Directory (Contacts) ──────────────────────────────────────────────────
// Backend: Contact.contactType field + isActive
// API: /api/contacts (via getContactsAction, filter by contactType)
// Note: "Primary" maps to isActive=true, "Inactive" maps to isActive=false
export const DIRECTORY_STATUS: StatusOption[] = [
  { label: "Primary", value: "Primary" },
  { label: "Technical", value: "Technical" },
  { label: "Purchase", value: "Purchase" },
  { label: "Finance", value: "Finance" },
  { label: "Management", value: "Management" },
  { label: "Inactive", value: "Inactive" },
];

// ─── 10. Planner (Tasks) ──────────────────────────────────────────────────────
// Backend: Task.status field
// API: /api/tasks (via getTasksAction, filter by status)
export const PLANNER_STATUS: StatusOption[] = [
  { label: "Open", value: "Open" },
  { label: "In Progress", value: "InProgress" },
  { label: "Done", value: "Done" },
  { label: "Overdue", value: "Overdue" },
  { label: "Cancelled", value: "Cancelled" },
];

// ─── Full Registry ────────────────────────────────────────────────────────────

export const MODULE_STATUS_REGISTRY: Record<string, ModuleStatusConfig> = {
  pipeline: {
    id: "pipeline",
    title: "Pipeline",
    path: "/sales-pipeline/pipeline-list",
    apiEndpoint: "/api/opportunities",
    statusParamKey: "stage",
    statuses: PIPELINE_STATUS,
  },
  deals: {
    id: "deals",
    title: "Deals",
    path: "/deals",
    apiEndpoint: "/api/deals",
    statuses: DEALS_STATUS,
  },
  quotes: {
    id: "quotes",
    title: "Quotes",
    path: "/quotations",
    apiEndpoint: "/api/quotations",
    statuses: QUOTES_STATUS,
  },
  orders: {
    id: "orders",
    title: "Orders",
    path: "/purchase-orders",
    apiEndpoint: "/api/purchase-orders",
    statuses: ORDERS_STATUS,
  },
  requests: {
    id: "requests",
    title: "Requests",
    path: "/rfq",
    apiEndpoint: "/api/rfq",
    statuses: REQUESTS_STATUS,
  },
  activity: {
    id: "activity",
    title: "Activity",
    path: "/visits",
    apiEndpoint: "/api/visits",
    statuses: ACTIVITY_STATUS,
  },
  catalog: {
    id: "catalog",
    title: "Catalog",
    path: "/samples",
    apiEndpoint: "/api/samples",
    statuses: CATALOG_STATUS,
  },
  portfolio: {
    id: "portfolio",
    title: "Portfolio",
    path: "/customer-master",
    apiEndpoint: "/api/customers",
    statuses: PORTFOLIO_STATUS,
  },
  directory: {
    id: "directory",
    title: "Directory",
    path: "/contacts",
    apiEndpoint: "/api/contacts",
    statuses: DIRECTORY_STATUS,
  },
  planner: {
    id: "planner",
    title: "Planner",
    path: "/tasks",
    apiEndpoint: "/api/tasks",
    statuses: PLANNER_STATUS,
  },
};
