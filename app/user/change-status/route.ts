import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, logAudit } from '@/lib/auth';

// PUT /user/change-status — Admin only
export async function PUT(req: NextRequest) {
  const session = await requireRole(req, ['Admin']);
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });

  try {
    const { id, isActive } = await req.json();

    if (!id || typeof isActive !== 'boolean') {
      return NextResponse.json({ success: false, message: 'User ID and isActive (boolean) are required' }, { status: 400 });
    }

    const user = await db.user.update({
      where: { id },
      data: { isActive },
      select: { id: true, name: true, email: true, isActive: true },
    });

    await logAudit(session.userId, 'user', 'update', `Set user ${id} isActive=${isActive}`);

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error('[UserChangeStatus Error]', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
