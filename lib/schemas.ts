import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .email("Invalid email format")
    .endsWith("@sukisoftware.com", "Must use an official @sukisoftware.com email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const userSchema = z.object({
  email: z
    .string()
    .email("Invalid email format")
    .endsWith("@sukisoftware.com", "Must use an official @sukisoftware.com email address"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
  role: z.enum(["Admin", "MarketingLead", "MarketingExecutive"]),
  isActive: z.boolean().default(true),
});

export type UserFormValues = z.infer<typeof userSchema>;

export const customerSchema = z.object({
  customerCode: z
    .string()
    .min(3, "Code must be at least 3 characters")
    .regex(/^[a-zA-Z0-9-]+$/, "Only letters, numbers, and hyphens allowed"),
  name: z.string().min(2, "Company name must be at least 2 characters"),
  email: z.string().email("Invalid email format").nullable().or(z.literal("")).transform(v => v === "" ? null : v),
  phone: z
    .string()
    .regex(/^\+?[0-9\s-]{10,15}$/, "Invalid phone format")
    .nullable()
    .or(z.literal(""))
    .transform(v => v === "" ? null : v),
  city: z.string().min(2, "City name must be at least 2 characters").nullable().or(z.literal("")).transform(v => v === "" ? null : v),
  status: z.enum(["Active", "Inactive", "Prospect"]).default("Prospect"),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;

export const subscriptionSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  planName: z.string().min(2, "Plan name must be at least 2 characters"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  status: z.enum(["Active", "Expired", "Cancelled", "Pending"]).default("Active"),
  notes: z.string().optional(),
});

export type SubscriptionFormValues = z.infer<typeof subscriptionSchema>;

export const visitorSchema = z.object({
  name: z.string().min(2, "Visitor name must be at least 2 characters"),
  email: z.string().email("Invalid email format").nullable().or(z.literal("")).transform(v => v === "" ? null : v),
  phone: z.string().regex(/^\+?[0-9\s-]{10,15}$/, "Invalid phone format"),
  company: z.string().min(2, "Company name must be at least 2 characters").nullable().or(z.literal("")).transform(v => v === "" ? null : v),
  purpose: z.string().min(3, "Please specify a clear purpose"),
  hostName: z.string().min(2, "Host name must be at least 2 characters"),
});

export type VisitorFormValues = z.infer<typeof visitorSchema>;

export const checkInSchema = z.object({
  customerId: z.string().min(1, "Customer selection is required"),
  purpose: z.string().min(3, "Visit purpose is required"),
  notes: z.string().optional(),
  latitude: z.number({ message: "GPS coordinates are required to check in" }),
  longitude: z.number({ message: "GPS coordinates are required to check in" }),
  photo: z.string().min(1, "A photo check-in is required"),
});

export type CheckInFormValues = z.infer<typeof checkInSchema>;
