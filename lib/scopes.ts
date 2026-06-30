import { TokenPayload } from "./auth";

export interface ScopeFilter {
  deletedAt?: null | { not: null };
  companyId?: string | null;
  assignedUserId?: string;
  executiveId?: string;
  hostedBy?: string;
  userId?: string;
  [key: string]: any;
}

/**
 * Builds the standard scoping filter for queries based on the user's role and company.
 * Excludes soft-deleted records by default.
 */
export function buildScope(
  userPayload: TokenPayload,
  modelName: string,
  includeDeleted = false
): ScopeFilter {
  const filter: ScopeFilter = {};

  // 1. Soft Delete Filter
  if (!includeDeleted) {
    filter.deletedAt = null;
  }

  // 2. Tenant Isolation & SuperAdmin Support Mode check
  if (userPayload.role === "SuperAdmin") {
    if (!userPayload.supportMode || !userPayload.companyId) {
      throw new Error("Unauthorized: SuperAdmin must access business data via support/impersonation mode.");
    }
  }

  filter.companyId = userPayload.companyId || null;

  // 3. RBAC Scopes
  if (userPayload.role === "SalesExecutive") {
    switch (modelName) {
      case "Lead":
      case "Customer":
      case "Deal":
      case "FollowUp":
        filter.assignedUserId = userPayload.id;
        break;
      case "MarketingVisit":
        filter.executiveId = userPayload.id;
        break;
      case "CustomerVisit":
        filter.hostedBy = userPayload.id;
        break;
      case "AuditLog":
        filter.userId = userPayload.id;
        break;
      case "Note":
        filter.createdById = userPayload.id;
        break;
      default:
        break;
    }
  }

  // V4 modules: SalesExecutive has view-only access
  if (userPayload.role === "SalesExecutive") {
    switch (modelName) {
      case "Competitor":
      case "CompetitorProduct":
      case "LostDealAnalysis":
      case "LossReason":
      case "KeyAccount":
      case "Territory":
      case "TerritoryAccount":
      case "SalesTarget":
        // View-only: can read but not create/edit/delete
        // This is enforced at the action level, not here
        break;
      default:
        break;
    }
  }

  return filter;
}

/**
 * Enforces scope validation for a single record to prevent cross-tenant access.
 * Returns true if the user has access.
 */
export function checkRecordScope(
  userPayload: TokenPayload,
  record: { 
    companyId?: string | null; 
    assignedUserId?: string | null; 
    executiveId?: string | null; 
    hostedBy?: string | null; 
    userId?: string | null; 
    createdById?: string | null;
    customer?: { assignedUserId?: string | null } | null;
    deal?: { assignedUserId?: string | null } | null;
  },
  modelName: string
): boolean {
  // SuperAdmin has access only via supportMode and must match impersonated companyId
  if (userPayload.role === "SuperAdmin") {
    if (!userPayload.supportMode || !userPayload.companyId) return false;
    return record.companyId === userPayload.companyId;
  }

  // Enforce company isolation
  if (record.companyId !== userPayload.companyId) return false;

  // Enforce role-based access
  if (userPayload.role === "SalesExecutive") {
    switch (modelName) {
      case "Lead":
      case "Customer":
      case "Deal":
      case "FollowUp":
        return record.assignedUserId === userPayload.id;
      case "MarketingVisit":
        return record.executiveId === userPayload.id;
      case "CustomerVisit":
        return record.hostedBy === userPayload.id;
      case "AuditLog":
        return record.userId === userPayload.id;
      case "Note":
        return record.createdById === userPayload.id;
      default:
        return true;
    }
  }

  return true;
}
