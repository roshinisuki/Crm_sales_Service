export type Role = "SuperAdmin" | "Admin" | "SalesManager" | "SalesExecutive" | "Customer";

export type CustomerStatus = "Prospect" | "ActiveCustomer" | "Renewed" | "Churned";

export type LeadStatus = "New" | "Contacted" | "FollowUpDue" | "SQL" | "Qualified" | "Converted" | "Lost";

export type CommunicationChannel = "Email" | "WhatsApp" | "SMS";

export type CommunicationDirection = "Inbound" | "Outbound";

export type InvoiceStatus = "Paid" | "Unpaid" | "Overdue" | "Cancelled";

export type TicketPriority = "Low" | "Medium" | "High";

export type TicketStatus = "Open" | "InProgress" | "Resolved" | "Closed";

export type CustomerOnboardingStatus = "Pending" | "TrainingCompleted" | "FullyOnboarded";

export type SubscriptionStatus = "Active" | "Expired" | "Cancelled" | "Pending" | "Renewed";

export type FollowUpStatus = "Pending" | "Completed" | "Overdue" | "Cancelled";

export type SlaStatus = "Pending" | "Warning" | "Breached" | "Met";

export type LeadSource = "Website" | "Facebook" | "Instagram" | "LinkedIn" | "Referral" | "WalkIn" | "ColdCall" | "Partner";

export type OpportunityStage =
  | "Qualified"
  | "RequirementGathering"
  | "MeetingScheduled"
  | "DemoConducted"
  | "Rejected"
  | "Lost";

export type DealStatus = "Active" | "Won" | "Lost";
