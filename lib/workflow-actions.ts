/**
 * Centralized CRM Workflow Action Config
 *
 * Returns the visible/disabled buttons for a given lead/deal stage.
 * This ensures buttons are always synced with the actual workflow state.
 */

export type LeadStatus = "New" | "Contacted" | "FollowUpDue" | "SQL" | "Qualified" | "Converted" | "Lost";

export interface WorkflowState {
  leadStatus: LeadStatus;
  hasPendingFollowUp: boolean;
  hasCompletedFollowUp: boolean;
  activityLogged: boolean;
  qualificationComplete: boolean;
  isConverted: boolean;
  isLost: boolean;
}

export interface WorkflowAction {
  id: string;
  label: string;
  variant: "primary" | "secondary" | "danger";
  icon?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export interface WorkflowActions {
  primary: WorkflowAction | null;
  secondary: WorkflowAction[];
  danger: WorkflowAction | null;
  stage: string;
  stageDescription: string;
}

export function getLeadWorkflowActions(state: WorkflowState): WorkflowActions {
  const { leadStatus, hasPendingFollowUp, hasCompletedFollowUp, activityLogged, qualificationComplete, isConverted, isLost } = state;

  // STEP G — CONVERTED LEAD
  if (isConverted || leadStatus === "Converted") {
    return {
      stage: "Converted",
      stageDescription: "Lead has been converted to a Deal. View the opportunity.",
      primary: { id: "view-opportunity", label: "View Opportunity", variant: "primary", icon: "Briefcase" },
      secondary: [
        { id: "view-account", label: "View Account", variant: "secondary", icon: "Building2" },
        { id: "view-contact", label: "View Contact", variant: "secondary", icon: "User" },
      ],
      danger: null,
    };
  }

  // LOST
  if (isLost || leadStatus === "Lost") {
    return {
      stage: "Lost",
      stageDescription: "This lead has been marked as Lost.",
      primary: null,
      secondary: [],
      danger: null,
    };
  }

  // STEP A — NEW LEAD
  if (leadStatus === "New") {
    return {
      stage: "New",
      stageDescription: "Respond to this lead within 15 min to meet SLA. Log a call to change status to Contacted.",
      primary: { id: "log-first-call", label: "Log First Call", variant: "primary", icon: "PhoneCall" },
      secondary: [],
      danger: { id: "mark-lost", label: "Mark Lost", variant: "danger", icon: "XCircle" },
    };
  }

  // STEP B — CONTACTED LEAD (no pending follow-up yet)
  if (leadStatus === "Contacted" && !hasPendingFollowUp && !hasCompletedFollowUp) {
    return {
      stage: "Contacted",
      stageDescription: "Keep the conversation going — schedule a follow-up call or meeting, or start qualification.",
      primary: { id: "create-followup", label: "Create Follow-Up", variant: "primary", icon: "CalendarClock" },
      secondary: [
        { id: "start-qualification", label: "Start Qualification", variant: "secondary", icon: "CheckCircle2" },
      ],
      danger: { id: "mark-lost", label: "Mark Lost", variant: "danger", icon: "XCircle" },
    };
  }

  // STEP C — FOLLOW-UP CREATED (PENDING)
  if (hasPendingFollowUp && !hasCompletedFollowUp) {
    return {
      stage: "FollowUpPending",
      stageDescription: "A follow-up is pending. Log the corresponding activity to complete it.",
      primary: { id: "log-followup-activity", label: "Log Follow-Up Activity", variant: "primary", icon: "PhoneCall" },
      secondary: [
        { id: "reschedule-followup", label: "Reschedule Follow-Up", variant: "secondary", icon: "CalendarClock" },
      ],
      danger: { id: "mark-lost", label: "Mark Lost", variant: "danger", icon: "XCircle" },
    };
  }

  // STEP D — FOLLOW-UP COMPLETED + ACTIVITY LOGGED
  if (hasCompletedFollowUp && activityLogged && leadStatus === "Contacted") {
    return {
      stage: "FollowUpDone",
      stageDescription: "Follow-up completed and activity logged. Ready for next steps.",
      primary: { id: "add-followup", label: "Add Another Follow-Up", variant: "primary", icon: "CalendarClock" },
      secondary: [
        { id: "start-qualification", label: "Start Qualification", variant: "secondary", icon: "CheckCircle2" },
      ],
      danger: { id: "mark-lost", label: "Mark Lost", variant: "danger", icon: "XCircle" },
    };
  }

  // STEP E — QUALIFICATION DISCUSSION (Contacted with engagement)
  if ((leadStatus === "Contacted" || leadStatus === "FollowUpDue") && !qualificationComplete) {
    return {
      stage: "Qualification",
      stageDescription: "Fill in qualification details (Budget, Timeline) to mark as SQL.",
      primary: {
        id: "mark-sql",
        label: "Mark as SQL",
        variant: "primary",
        icon: "CheckCircle2",
        disabled: !qualificationComplete,
        disabledReason: "Fill Budget and Timeline first",
      },
      secondary: [
        { id: "add-activity", label: "Add More Activities", variant: "secondary", icon: "FileText" },
      ],
      danger: { id: "mark-lost", label: "Mark Lost", variant: "danger", icon: "XCircle" },
    };
  }

  // STEP F — SQL LEAD
  if (leadStatus === "SQL") {
    return {
      stage: "SQL",
      stageDescription: "This lead is a Sales Qualified Lead. Convert to create a Deal.",
      primary: { id: "convert-lead", label: "Convert Lead", variant: "primary", icon: "Briefcase" },
      secondary: [
        { id: "add-sql-activity", label: "Add SQL Activity", variant: "secondary", icon: "FileText" },
        { id: "view-sql-leads", label: "View SQL Leads", variant: "secondary", icon: "Users" },
      ],
      danger: { id: "mark-lost", label: "Mark Lost", variant: "danger", icon: "XCircle" },
    };
  }

  // QUALIFIED — ready to convert
  if (leadStatus === "Qualified") {
    return {
      stage: "Qualified",
      stageDescription: "Ready to convert! Click Convert Lead to create a Deal.",
      primary: { id: "convert-lead", label: "Convert Lead", variant: "primary", icon: "Briefcase" },
      secondary: [],
      danger: { id: "mark-lost", label: "Mark Lost", variant: "danger", icon: "XCircle" },
    };
  }

  // FollowUpDue — follow-up is overdue/due
  if (leadStatus === "FollowUpDue") {
    return {
      stage: "FollowUpDue",
      stageDescription: "A follow-up is due. Complete it to progress this lead.",
      primary: { id: "log-followup-activity", label: "Log Follow-Up Activity", variant: "primary", icon: "PhoneCall" },
      secondary: [
        { id: "reschedule-followup", label: "Reschedule Follow-Up", variant: "secondary", icon: "CalendarClock" },
      ],
      danger: { id: "mark-lost", label: "Mark Lost", variant: "danger", icon: "XCircle" },
    };
  }

  // Fallback
  return {
    stage: "Unknown",
    stageDescription: "",
    primary: null,
    secondary: [],
    danger: null,
  };
}

/**
 * Compute derived state for the workflow from lead + follow-ups data.
 */
export function computeWorkflowState(lead: any, followups: any[]): WorkflowState {
  const hasPendingFollowUp = followups.some(f => f.status === "Pending" || f.status === "Overdue");
  const hasCompletedFollowUp = followups.some(f => f.status === "Completed");
  const activityLogged = (lead.communicationLogs?.length ?? 0) > 0 || (lead.callLogs?.length ?? 0) > 0;

  const qualificationComplete =
    !!lead.budgetAsked?.trim() &&
    !!lead.timelineAsked?.trim();

  return {
    leadStatus: lead.status,
    hasPendingFollowUp,
    hasCompletedFollowUp,
    activityLogged,
    qualificationComplete,
    isConverted: lead.status === "Converted",
    isLost: lead.status === "Lost",
  };
}
