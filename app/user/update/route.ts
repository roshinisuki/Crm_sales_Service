import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, logAudit } from '@/lib/auth';

// PUT /user/update — Admin only
export async function PUT(req: NextRequest) {
  const session = await requireRole(req, ['Admin']);
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });

  try {
    const { id, name, email, role } = await req.json();

    if (!id) {
      return NextResponse.json({ success: false, message: 'User ID is required' }, { status: 400 });
    }

    const user = await db.user.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(email ? { email } : {}),
        ...(role ? { role } : {}),
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    await logAudit(session.userId, 'user', 'update', `Updated user ${id}`);

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error('[UserUpdate Error]', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
