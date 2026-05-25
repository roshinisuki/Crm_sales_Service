export type Role = "Admin" | "MarketingLead" | "MarketingExecutive" | "Customer";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  customerCode: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  status: "Active" | "Inactive" | "Prospect";
  assignedUserId: string | null;
  assignedUser?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  customerId: string;
  customer?: Customer;
  planName: string;
  startDate: string;
  endDate: string;
  status: "Active" | "Expired" | "Cancelled" | "Pending";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** MarketingVisit — field names matching the Prisma 'MarketingVisit' model */
export interface MarketingLog {
  id: string;
  executiveId: string;
  executive?: User;
  customerId: string;
  customer?: Customer;
  checkIn: string;         // was checkInTime
  checkOut: string | null; // was checkOutTime
  remarks: string | null;  // was notes
  nextMeetingDate: string | null;
  createdAt: string;

  // Alias getters — kept for backward compat with page components
  checkInTime: string;
  checkOutTime: string | null;
  checkInLat: number;
  checkInLng: number;
  checkOutLat: number | null;
  checkOutLng: number | null;
  checkInPhoto: string | null;
  purpose: string | null;
  notes: string | null;
}

/** Visitor — field names matching the Prisma 'Visitor' model */
export interface Visitor {
  id: string;
  visitorName: string;   // was name
  company: string;
  visitorEmail: string | null;  // was email
  visitorPhone: string; // was phone
  purpose: string;
  inTime: string;         // was checkInTime
  outTime: string | null; // was checkOutTime
  hostUserId: string;
  host?: User;
  createdAt: string;
  updatedAt: string;

  // Aliases for backward compat
  name: string;
  email: string | null;
  phone: string;
  hostName: string | null;
  checkInTime: string;
  checkOutTime: string | null;
}

/** FollowUp — field names matching the Prisma 'FollowUp' model */
export interface FollowUp {
  id: string;
  customerId: string;
  customer?: Customer;
  assignedUserId: string;
  assignedUser?: User;
  nextMeetingDate: string;   // was scheduledTime
  remarks: string | null;    // was notes
  status: "Pending" | "Completed" | "Overdue";
  createdAt: string;
  updatedAt: string;

  // Aliases for backward compat
  scheduledTime: string;
  notes: string | null;
  userId: string;
  user?: User;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  user?: User;
  module: string;
  action: string;
  details: string | null;
  timestamp: string;

  // Aliases
  createdAt?: string;
  userEmail?: string | null;
  performedBy?: string | null;
  entityId?: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}
