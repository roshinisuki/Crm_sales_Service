export type Role = "Admin" | "MarketingLead" | "MarketingExecutive" | "Customer";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  isFirstLogin?: boolean;
  createdAt?: string;
  updatedAt?: string;
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
  assignedUser?: Partial<User>;
  createdAt?: string;
  updatedAt?: string;
  subscriptions?: any[];
}

export interface Subscription {
  id: string;
  customerId: string;
  customer?: Partial<Customer>;
  planName: string;
  startDate: string | Date;
  endDate: string | Date;
  status: "Active" | "Expired" | "Cancelled" | "Pending";
  notes: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/** MarketingVisit — field names matching the Prisma 'MarketingVisit' model */
export interface MarketingLog {
  id: string;
  executiveId: string;
  executive?: Partial<User>;
  customerId: string;
  customer?: Partial<Customer>;
  checkIn: string | Date;
  checkOut: string | Date | null;
  remarks: string | null;
  nextMeetingDate: string | Date | null;
  createdAt?: string | Date;

  // Alias getters
  checkInTime: string;
  checkOutTime: string | null;
  checkInLat: number;
  checkInLng: number;
  checkOutLat: number | null;
  checkOutLng: number | null;
  checkInPhoto: string | null;
  purpose: string | null;
  notes: string | null;
  userId?: string;
  user?: Partial<User>;
}

/** Visitor — field names matching the Prisma 'Visitor' model */
export interface Visitor {
  id: string;
  visitorName: string;
  company: string;
  visitorEmail: string | null;
  visitorPhone: string;
  purpose: string;
  inTime: string | Date;
  outTime: string | Date | null;
  hostUserId: string;
  host?: Partial<User>;
  createdAt?: string | Date;
  updatedAt?: string | Date;

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
  customer?: Partial<Customer>;
  assignedUserId: string;
  assignedUser?: Partial<User>;
  nextMeetingDate: string | Date;
  remarks: string | null;
  status: "Pending" | "Completed" | "Overdue";
  createdAt?: string | Date;
  updatedAt?: string | Date;

  // Aliases
  scheduledTime: string;
  notes: string | null;
  userId: string;
  user?: Partial<User>;
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
