import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, logAudit } from '@/lib/auth';

// GET /user/list — Admin only
export async function GET(req: NextRequest) {
  const session = await requireRole(req, ['Admin']);
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const role = searchParams.get('role') || undefined;
  const isActive = searchParams.get('isActive');

  const users = await db.user.findMany({
    where: {
      ...(role ? { role: role as any } : {}),
      ...(isActive !== null ? { isActive: isActive === 'true' } : {}),
    },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: users });
}

// POST /user/list is not needed; use GET with query params
