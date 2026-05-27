import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || "sukisoftware.com";

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

/** Returns true if the email belongs to the allowed internal domain */
export function isInternalEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain === ALLOWED_DOMAIN.toLowerCase();
}

/** Returns true if the role requires an internal (company) email */
export function requiresInternalEmail(role: string): boolean {
  return ["Admin", "MarketingLead", "MarketingExecutive"].includes(role);
}

export async function verifyAuth(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
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
    case "Admin":               return "/dashboard";
    case "MarketingLead":       return "/dashboard";
    case "MarketingExecutive":  return "/dashboard";
    case "Customer":            return "/customer/portal";
    default:                    return "/login";
  }
}
