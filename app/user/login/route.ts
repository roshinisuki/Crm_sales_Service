import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateToken, setAuthCookie, logAudit, getRoleRedirect } from '@/lib/auth';
import bcrypt from 'bcryptjs';

const ALLOWED_DOMAIN = '@sukisoftware.com';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Email and password are required' }, { status: 400 });
    }

    if (!email.endsWith(ALLOWED_DOMAIN)) {
      return NextResponse.json({ success: false, message: 'Only @sukisoftware.com accounts are allowed' }, { status: 403 });
    }

    const user = await db.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      return NextResponse.json({ success: false, message: 'Invalid credentials or inactive account' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }

    const token = generateToken({ userId: user.id, email: user.email, role: user.role });
    const redirectTo = getRoleRedirect(user.role);

    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      redirectTo,
    });

    setAuthCookie(response, token);
    await logAudit(user.id, 'auth', 'login', `User ${user.email} logged in`);

    return response;
  } catch (error) {
    console.error('[Login Error]', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
