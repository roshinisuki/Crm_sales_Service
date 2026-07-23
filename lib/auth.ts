import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is missing.");
}
const ALLOWED_DOMAINS = (process.env.ALLOWED_DOMAIN || "sukisoftware.com,sukisoft.com,apexindustries.com,bharatmetalworks.com")
  .split(",")
  .map((d) => d.trim().toLowerCase());

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  companyId?: string | null;
  variant?: number;
  enabledModules?: string;
  supportMode?: boolean;
  iat: number;
  exp: number;
}

/** Returns true if the email belongs to any of the allowed internal domains (or their subdomains) */
export function isInternalEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return ALLOWED_DOMAINS.some(d => domain === d || domain.endsWith("." + d));
}

/** Returns true if the role requires an internal (company) email */
export function requiresInternalEmail(role: string): boolean {
  return ["Admin", "SalesManager", "SalesExecutive"].includes(role);
}

export async function verifyAuth(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET as string) as any;
    if (decoded.userId && !decoded.id) {
      decoded.id = decoded.userId;
    }
    return decoded as TokenPayload;
  } catch (error) {
    console.error("JWT Verification Error:", error);
    return null;
  }
}

export function requireRole(payload: TokenPayload | null, allowedRoles: string[]) {
  if (!payload) return false;
  return allowedRoles.includes(payload.role);
}

/** Returns the dashboard URL for a given role */
export function getRoleRedirect(role: string): string {
  switch (role) {
    case "SuperAdmin":       return "/dashboard";
    case "Admin":            return "/dashboard";
    case "SalesManager":     return "/dashboard";
    case "SalesExecutive":   return "/dashboard";
    case "ServiceManager":   return "/service/dashboard/my";
    case "ServiceEngineer":  return "/service/my-visits";
    case "Customer":         return "/customer/portal";
    default:                 return "/dashboard";
  }
}

/** Checks if the user has delete permission for a specific module */
export async function requireDeletePermission(moduleName: string): Promise<TokenPayload> {
  const payload = await verifyAuth();
  if (!payload) throw new Error("Unauthorized");
  
  if (payload.role === "Admin" || payload.role === "SuperAdmin") {
    return payload;
  }
  
  const perm = await prisma.rolePermission.findUnique({
    where: { role_module: { role: payload.role, module: moduleName } }
  });
  
  if (!perm || !perm.canDelete) {
    throw new Error("You do not have permission to delete records in this module.");
  }
  
  return payload;
}
