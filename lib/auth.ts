import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export async function verifyAuth(): Promise<TokenPayload | null> {
  // Await the cookies() function in Next.js 15+ or resolve it generally
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    console.error("JWT Verification Error:", error);
    return null;
  }
}

export function requireRole(payload: TokenPayload | null, allowedRoles: string[]) {
  if (!payload) return false;
  return allowedRoles.includes(payload.role);
}
