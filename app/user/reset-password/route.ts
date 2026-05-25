import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logAudit } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { email, otp, newPassword } = await req.json();

    if (!email || !otp || !newPassword) {
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ success: false, message: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ success: false, message: 'Invalid request' }, { status: 400 });
    }

    const token = await db.passwordResetToken.findFirst({
      where: { userId: user.id, used: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!token || token.otp !== otp || token.expiresAt < new Date()) {
      return NextResponse.json({ success: false, message: 'Invalid or expired OTP' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { passwordHash } }),
      db.passwordResetToken.update({ where: { id: token.id }, data: { used: true } }),
    ]);

    await logAudit(user.id, 'auth', 'reset_password', `Password reset for ${user.email}`);

    return NextResponse.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('[ResetPassword Error]', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
