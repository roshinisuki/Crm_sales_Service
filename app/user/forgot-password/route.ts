import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logAudit } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ success: false, message: 'Email is required' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email } });

    // Always return 200 to prevent email enumeration
    if (!user || !user.isActive) {
      return NextResponse.json({ success: true, message: 'If this email exists, an OTP has been sent' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await db.passwordResetToken.deleteMany({ where: { userId: user.id } });

    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        otp,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
      },
    });

    // TODO: Send via email (Nodemailer/Resend). Console log for dev:
    console.log(`[OTP for ${email}]: ${otp}`);

    await logAudit(user.id, 'auth', 'forgot_password', `OTP requested for ${email}`);

    return NextResponse.json({ success: true, message: 'If this email exists, an OTP has been sent' });
  } catch (error) {
    console.error('[ForgotPassword Error]', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
