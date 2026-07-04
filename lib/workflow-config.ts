/**
 * CRM Workflow Visualization Configuration
 * 
 * Defines workflow diagrams for modules with linear status progression.
 * Used by <WorkflowDiagram> component to render reference workflow diagrams.
 * 
 * Schema:
 * - module: Module identifier (matches module-status-config.ts)
 * - nodes: All possible status values in the workflow
 * - edges: Connections between statuses with type (positive/negative) and optional requiredFields
 * - reversible: Whether negative statuses can be reversed back to positive flow
 * - hasDiagram: Whether this module should render a workflow diagram (false for non-linear modules)
 */

export interface WorkflowEdge {
  from: string;
  to: string;
  type: "positive" | "negative";
  requiredFields?: string[];
}

export interface WorkflowConfig {
  module: string;
  nodes: string[];
  edges: WorkflowEdge[];
  reversible: boolean;
  hasDiagram: boolean;
}

// ─── 1. Pipeline (Sales Pipeline) ───────────────────────────────────────────────
export const PIPELINE_WORKFLOW: WorkflowConfig = {
  module: "pipeline",
  nodes: ["Qualified", "RequirementGathering", "MeetingScheduled", "DemoConducted", "Rejected", "Lost"],
  edges: [
    { from: "Qualified", to: "RequirementGathering", type: "positive" },
    { from: "RequirementGathering", to: "MeetingScheduled", type: "positive" },
    { from: "MeetingScheduled", to: "DemoConducted", type: "positive" },
    { from: "Qualified", to: "Lost", type: "negative", requiredFields: ["lostReasonRefId"] },
    { from: "RequirementGathering", to: "Lost", type: "negative", requiredFields: ["lostReasonRefId"] },
    { from: "MeetingScheduled", to: "Lost", type: "negative", requiredFields: ["lostReasonRefId"] },
    { from: "DemoConducted", to: "Lost", type: "negative", requiredFields: ["lostReasonRefId"] },
    { from: "RequirementGathering", to: "Rejected", type: "negative", requiredFields: ["lostReason"] },
    { from: "MeetingScheduled", to: "Rejected", type: "negative", requiredFields: ["lostReason"] },
    { from: "DemoConducted", to: "Rejected", type: "negative", requiredFields: ["lostReason"] },
  ],
  reversible: true, // Manager/Admin can reverse Lost/Rejected
  hasDiagram: true,
};

// ─── 2. Deals ───────────────────────────────────────────────────────────────────
export const DEALS_WORKFLOW: WorkflowConfig = {
  module: "deals",
  nodes: ["Active", "OnHold", "Won", "Lost"],
  edges: [
    { from: "Active", to: "Won", type: "positive" },
    { from: "Active", to: "OnHold", type: "positive" },
    { from: "OnHold", to: "Active", type: "positive" },
    { from: "Active", to: "Lost", type: "negative", requiredFields: ["lostReasonRefId"] },
    { from: "OnHold", to: "Lost", type: "negative", requiredFields: ["lostReasonRefId"] },
  ],
  reversible: true, // Lost can be reversed
  hasDiagram: true,
};

// ─── 3. Quotes (Quotations) ─────────────────────────────────────────────────────
export const QUOTES_WORKFLOW: WorkflowConfig = {
  module: "quotes",
  nodes: ["Draft", "Sent", "UnderReview", "Accepted", "Rejected", "Expired"],
  edges: [
    { from: "Draft", to: "Sent", type: "positive" },
    { from: "Sent", to: "UnderReview", type: "positive" },
    { from: "UnderReview", to: "Accepted", type: "positive" },
    { from: "Sent", to: "Rejected", type: "negative", requiredFields: ["rejectionReasonId", "rejectionReason"] },
    { from: "UnderReview", to: "Rejected", type: "negative", requiredFields: ["rejectionReasonId", "rejectionReason"] },
    { from: "Sent", to: "Expired", type: "negative", requiredFields: ["expiryDate"] },
    { from: "UnderReview", to: "Expired", type: "negative", requiredFields: ["expiryDate"] },
  ],
  reversible: true, // Rejected/Expired can be reversed
  hasDiagram: true,
};

// ─── 4. Orders (Purchase Orders) ──────────────────────────────────────────────
export const ORDERS_WORKFLOW: WorkflowConfig = {
  module: "orders",
  nodes: ["New", "UnderValidation", "Approved", "Rejected", "Closed"],
  edges: [
    { from: "New", to: "UnderValidation", type: "positive" },
    { from: "UnderValidation", to: "Approved", type: "positive" },
    { from: "Approved", to: "Closed", type: "positive" },
    { from: "New", to: "Rejected", type: "negative", requiredFields: ["rejectionReason"] },
    { from: "UnderValidation", to: "Rejected", type: "negative", requiredFields: ["rejectionReason"] },
  ],
  reversible: true, // Rejected can be reversed
  hasDiagram: true,
};

// ─── 5. Requests (RFQ) ───────────────────────────────────────────────────────────
export const REQUESTS_WORKFLOW: WorkflowConfig = {
  module: "requests",
  nodes: ["New", "UnderReview", "CostingPending", "QuotationCreated", "Closed"],
  edges: [
    { from: "New", to: "UnderReview", type: "positive" },
    { from: "UnderReview", to: "CostingPending", type: "positive" },
    { from: "CostingPending", to: "QuotationCreated", type: "positive" },
    { from: "QuotationCreated", to: "Closed", type: "positive" },
    { from: "New", to: "Closed", type: "negative", requiredFields: ["closureReason"] },
    { from: "UnderReview", to: "Closed", type: "negative", requiredFields: ["closureReason"] },
    { from: "CostingPending", to: "Closed", type: "negative", requiredFields: ["closureReason"] },
  ],
  reversible: true, // Closed can be reversed
  hasDiagram: true,
};

// ─── 6. Activity (Visits) ───────────────────────────────────────────────────────
export const ACTIVITY_WORKFLOW: WorkflowConfig = {
  module: "activity",
  nodes: ["PLANNED", "CHECKED_IN", "CHECKED_OUT", "COMPLETED", "MISSED", "CANCELLED"],
  edges: [
    { from: "PLANNED", to: "CHECKED_IN", type: "positive" },
    { from: "CHECKED_IN", to: "CHECKED_OUT", type: "positive" },
    { from: "CHECKED_OUT", to: "COMPLETED", type: "positive" },
    { from: "PLANNED", to: "MISSED", type: "negative", requiredFields: ["missedReason"] },
    { from: "PLANNED", to: "CANCELLED", type: "negative", requiredFields: ["cancellationReason"] },
    { from: "CHECKED_IN", to: "CANCELLED", type: "negative", requiredFields: ["cancellationReason"] },
  ],
  reversible: true, // Missed/Cancelled can be reversed
  hasDiagram: true,
};

// ─── 7. Catalog (Samples) ─────────────────────────────────────────────────────
export const CATALOG_WORKFLOW: WorkflowConfig = {
  module: "catalog",
  nodes: ["New", "UnderReview", "SentToCustomer", "Approved", "Rejected", "Revision"],
  edges: [
    { from: "New", to: "UnderReview", type: "positive" },
    { from: "UnderReview", to: "SentToCustomer", type: "positive" },
    { from: "SentToCustomer", to: "Approved", type: "positive" },
    { from: "Approved", to: "Revision", type: "positive" },
    { from: "Revision", to: "SentToCustomer", type: "positive" },
    { from: "UnderReview", to: "Rejected", type: "negative", requiredFields: ["rejectionReason"] },
    { from: "SentToCustomer", to: "Rejected", type: "negative", requiredFields: ["rejectionReason"] },
  ],
  reversible: true, // Rejected can be reversed
  hasDiagram: true,
};

// ─── 8. Planner (Tasks) ─────────────────────────────────────────────────────────
export const PLANNER_WORKFLOW: WorkflowConfig = {
  module: "planner",
  nodes: ["Open", "InProgress", "Done", "Overdue", "Cancelled"],
  edges: [
    { from: "Open", to: "InProgress", type: "positive" },
    { from: "InProgress", to: "Done", type: "positive" },
    { from: "Open", to: "Overdue", type: "negative" },
    { from: "InProgress", to: "Overdue", type: "negative" },
    { from: "Open", to: "Cancelled", type: "negative", requiredFields: ["cancellationReason"] },
    { from: "InProgress", to: "Cancelled", type: "negative", requiredFields: ["cancellationReason"] },
  ],
  reversible: true, // Cancelled can be reversed
  hasDiagram: true,
};

// ─── 9. Portfolio (Customers) ──────────────────────────────────────────────────
// No linear workflow - statuses are account states, not sequential stages
export const PORTFOLIO_WORKFLOW: WorkflowConfig = {
  module: "portfolio",
  nodes: ["ActiveCustomer", "Prospect", "Renewed", "Churned"],
  edges: [], // No sequential progression
  reversible: false,
  hasDiagram: false, // Do not render workflow diagram
};

// ─── 10. Directory (Contacts) ────────────────────────────────────────────────────
// No linear workflow - statuses are contact-role categories, not sequential stages
export const DIRECTORY_WORKFLOW: WorkflowConfig = {
  module: "directory",
  nodes: ["Primary", "Technical", "Purchase", "Finance", "Management", "Inactive"],
  edges: [], // No sequential progression
  reversible: false,
  hasDiagram: false, // Do not render workflow diagram
};

// ─── Full Registry ─────────────────────────────────────────────────────────────

export const WORKFLOW_CONFIG_REGISTRY: Record<string, WorkflowConfig> = {
  pipeline: PIPELINE_WORKFLOW,
  deals: DEALS_WORKFLOW,
  quotes: QUOTES_WORKFLOW,
  orders: ORDERS_WORKFLOW,
  requests: REQUESTS_WORKFLOW,
  activity: ACTIVITY_WORKFLOW,
  catalog: CATALOG_WORKFLOW,
  planner: PLANNER_WORKFLOW,
  portfolio: PORTFOLIO_WORKFLOW,
  directory: DIRECTORY_WORKFLOW,
};

/**
 * Get workflow config for a module
 */
export function getWorkflowConfig(moduleId: string): WorkflowConfig | null {
  return WORKFLOW_CONFIG_REGISTRY[moduleId] || null;
}

/**
 * Check if a module has a workflow diagram
 */
export function moduleHasDiagram(moduleId: string): boolean {
  const config = getWorkflowConfig(moduleId);
  return config ? config.hasDiagram : false;
}

/**
 * Get required fields for a specific status transition
 */
export function getRequiredFieldsForTransition(
  moduleId: string,
  fromStatus: string,
  toStatus: string
): string[] {
  const config = getWorkflowConfig(moduleId);
  if (!config) return [];

  const edge = config.edges.find(
    (e) => e.from === fromStatus && e.to === toStatus
  );
  return edge?.requiredFields || [];
}
