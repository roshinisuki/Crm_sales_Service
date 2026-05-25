import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'suki-marketing-crm-super-secret-jwt-key';
const SESSION_DURATION = 30 * 60; // 30 minutes in seconds

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Validates the session JWT from the request cookie.
 */
export async function validateSession(req: NextRequest): Promise<JwtPayload | null> {
  const token = req.cookies.get('token')?.value;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Validates session AND checks that the caller has an allowed role.
 * Returns the decoded payload on success, or null on failure.
 */
export async function requireRole(
  req: NextRequest,
  allowedRoles: string[]
): Promise<JwtPayload | null> {
  const payload = await validateSession(req);
  if (!payload) return null;
  if (!allowedRoles.includes(payload.role)) return null;
  return payload;
}

/**
 * Generates a signed JWT with a 30-minute expiry.
 */
export function generateToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: SESSION_DURATION });
}

/**
 * Returns a NextResponse that clears the auth cookie (logout).
 */
export function clearAuthCookie(res: NextResponse): NextResponse {
  res.cookies.set('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
  return res;
}

/**
 * Attaches the auth cookie to a NextResponse.
 */
export function setAuthCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_DURATION,
    path: '/',
  });
  return res;
}

/**
 * Async helper to write an audit log entry. Fire-and-forget safe.
 */
export async function logAudit(
  userId: string | null,
  module: string,
  action: string,
  details?: string
) {
  try {
    await db.auditLog.create({
      data: { userId, module, action, details },
    });
  } catch (err) {
    console.error('[AuditLog Error]', err);
  }
}

/**
 * Role-based redirect path after login.
 */
export function getRoleRedirect(role: string): string {
  switch (role) {
    case 'Admin':            return '/admin';
    case 'MarketingLead':   return '/marketing-lead';
    case 'MarketingExecutive': return '/marketing-executive';
    case 'Customer':        return '/customer';
    default:                return '/dashboard';
  }
}
