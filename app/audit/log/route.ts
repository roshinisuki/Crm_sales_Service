import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';

// GET /audit/log — Admin only
export async function GET(req: NextRequest) {
  const session = await requireRole(req, ['Admin']);
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const module  = searchParams.get('module')  || undefined;
  const userId  = searchParams.get('userId')  || undefined;
  const from    = searchParams.get('from')    || undefined;
  const to      = searchParams.get('to')      || undefined;

  const logs = await db.auditLog.findMany({
    where: {
      ...(module ? { module }   : {}),
      ...(userId ? { userId }   : {}),
      ...(from || to ? {
        timestamp: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to   ? { lte: new Date(to) }   : {}),
        },
      } : {}),
    },
    include: { user: { select: { name: true, email: true, role: true } } },
    orderBy: { timestamp: 'desc' },
    take: 500, // Limit result size
  });

  return NextResponse.json({ success: true, data: logs });
}
