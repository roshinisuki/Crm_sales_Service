import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, logAudit } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// POST /user/create — Admin only
export async function POST(req: NextRequest) {
  const session = await requireRole(req, ['Admin']);
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });

  try {
    const { email, name, password, role } = await req.json();

    if (!email || !name || !password || !role) {
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ success: false, message: 'Email already in use' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await db.user.create({
      data: { email, name, passwordHash, role },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });

    await logAudit(session.userId, 'user', 'create', `Created user ${email} with role ${role}`);

    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (error) {
    console.error('[UserCreate Error]', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
